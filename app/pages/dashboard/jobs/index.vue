<script setup lang="ts">
import {
  Briefcase, Bell, Plus, Kanban, MapPin, Search, SlidersHorizontal, X,
  List, LayoutGrid, Table as TableIcon,
  ArrowUp, ArrowDown, ArrowUpDown, Users, Calendar,
} from 'lucide-vue-next'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'require-org'],
})

useSeoMeta({
  title: 'My Jobs — Reqcore',
  description: 'Your active job postings',
})

const { activeOrg } = useCurrentOrg()
const localePath = useLocalePath()

// ─────────────────────────────────────────────
// Stage / status / type config
// ─────────────────────────────────────────────

const stageConfig = [
  { key: 'new', label: 'New', textColor: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-950/40' },
  { key: 'screening', label: 'Screening', textColor: 'text-violet-600 dark:text-violet-400', bgColor: 'bg-violet-50 dark:bg-violet-950/40' },
  { key: 'interview', label: 'Interview', textColor: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-950/40' },
  { key: 'offer', label: 'Offer', textColor: 'text-teal-600 dark:text-teal-400', bgColor: 'bg-teal-50 dark:bg-teal-950/40' },
  { key: 'hired', label: 'Hired', textColor: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-950/40' },
  { key: 'rejected', label: 'Rejected', textColor: 'text-surface-500 dark:text-surface-400', bgColor: 'bg-surface-100 dark:bg-surface-800' },
] as const

function getStageCount(pipeline: any, key: string): number {
  return pipeline?.[key] ?? 0
}

const statusBadgeClasses: Record<string, string> = {
  draft: 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400',
  open: 'bg-success-50 text-success-700 dark:bg-success-950 dark:text-success-400',
  closed: 'bg-warning-50 text-warning-700 dark:bg-warning-950 dark:text-warning-400',
  archived: 'bg-surface-100 text-surface-400 dark:bg-surface-800 dark:text-surface-500',
}

const typeLabels: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
}

const experienceLabels: Record<string, string> = {
  junior: 'Junior',
  mid: 'Mid',
  senior: 'Senior',
  lead: 'Lead',
}

const remoteLabels: Record<string, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
}

// ─────────────────────────────────────────────
// Fetch jobs
// ─────────────────────────────────────────────

const { jobs, total, fetchStatus, error, refresh } = useJobs()

// ─────────────────────────────────────────────
// Filters & sort & view-mode state
// ─────────────────────────────────────────────

type StatusFilter = 'open' | 'draft' | 'closed' | 'archived'
type TypeFilter = 'full_time' | 'part_time' | 'contract' | 'internship'
type ExperienceFilter = 'junior' | 'mid' | 'senior' | 'lead'
type RemoteFilter = 'remote' | 'hybrid' | 'onsite'
type ViewMode = 'list' | 'gallery' | 'table'
type SortKey = 'priority' | 'title' | 'status' | 'type' | 'created' | 'updated' | 'newApps' | 'totalActive'
type SortDir = 'asc' | 'desc'

const search = ref('')
const statusFilter = ref<StatusFilter[]>([])
const typeFilter = ref<TypeFilter[]>([])
const experienceFilter = ref<ExperienceFilter[]>([])
const remoteFilter = ref<RemoteFilter[]>([])
const sortKey = ref<SortKey>('priority')
const sortDir = ref<SortDir>('desc')
const viewMode = ref<ViewMode>('list')

const statusOptions: { value: StatusFilter, label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'draft', label: 'Draft' },
  { value: 'closed', label: 'Closed' },
  { value: 'archived', label: 'Archived' },
]
const typeOptions: { value: TypeFilter, label: string }[] = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
]
const experienceOptions: { value: ExperienceFilter, label: string }[] = [
  { value: 'junior', label: 'Junior' },
  { value: 'mid', label: 'Mid' },
  { value: 'senior', label: 'Senior' },
  { value: 'lead', label: 'Lead' },
]
const remoteOptions: { value: RemoteFilter, label: string }[] = [
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
]

function toggleIn<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]
}

const drawerActiveCount = computed(() =>
  statusFilter.value.length
  + typeFilter.value.length
  + experienceFilter.value.length
  + remoteFilter.value.length,
)

const hasActiveFilters = computed(() =>
  drawerActiveCount.value > 0 || search.value.trim().length > 0,
)

function clearAllFilters() {
  search.value = ''
  statusFilter.value = []
  typeFilter.value = []
  experienceFilter.value = []
  remoteFilter.value = []
}

// ─────────────────────────────────────────────
// Filter + sort
// ─────────────────────────────────────────────

const statusPriority: Record<string, number> = {
  open: 0,
  draft: 1,
  closed: 2,
  archived: 3,
}

function totalActive(pipeline: any) {
  return (pipeline?.new ?? 0) + (pipeline?.screening ?? 0) + (pipeline?.interview ?? 0) + (pipeline?.offer ?? 0) + (pipeline?.hired ?? 0)
}

const filteredJobs = computed(() => {
  const q = search.value.trim().toLowerCase()
  return jobs.value.filter((j: any) => {
    if (q) {
      const hay = `${j.title ?? ''} ${j.location ?? ''} ${j.description ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (statusFilter.value.length && !statusFilter.value.includes(j.status)) return false
    if (typeFilter.value.length && !typeFilter.value.includes(j.type)) return false
    if (experienceFilter.value.length) {
      if (!j.experienceLevel || !experienceFilter.value.includes(j.experienceLevel)) return false
    }
    if (remoteFilter.value.length) {
      if (!j.remoteStatus || !remoteFilter.value.includes(j.remoteStatus)) return false
    }
    return true
  })
})

const sortedJobs = computed(() => {
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...filteredJobs.value].sort((a: any, b: any) => {
    switch (sortKey.value) {
      case 'title':
        return dir * String(a.title ?? '').localeCompare(String(b.title ?? ''))
      case 'status':
        return dir * String(a.status ?? '').localeCompare(String(b.status ?? ''))
      case 'type':
        return dir * String(a.type ?? '').localeCompare(String(b.type ?? ''))
      case 'created':
        return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      case 'updated':
        return dir * (new Date(a.updatedAt ?? a.createdAt).getTime() - new Date(b.updatedAt ?? b.createdAt).getTime())
      case 'newApps':
        return dir * ((a.pipeline?.new ?? 0) - (b.pipeline?.new ?? 0))
      case 'totalActive':
        return dir * (totalActive(a.pipeline) - totalActive(b.pipeline))
      case 'priority':
      default: {
        // Default smart ordering: open w/ new apps first, then status priority, then new, then active, then date
        const aPriority = statusPriority[a.status] ?? 9
        const bPriority = statusPriority[b.status] ?? 9
        if (aPriority !== bPriority) return aPriority - bPriority
        const aNew = a.pipeline?.new ?? 0
        const bNew = b.pipeline?.new ?? 0
        if (aNew !== bNew) return bNew - aNew
        const aActive = totalActive(a.pipeline)
        const bActive = totalActive(b.pipeline)
        if (aActive !== bActive) return bActive - aActive
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
    }
  })
})

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = (key === 'created' || key === 'updated' || key === 'newApps' || key === 'totalActive') ? 'desc' : 'asc'
  }
}

// ─────────────────────────────────────────────
// "Needs attention" grouping (list view only,
// only when using the default smart sort)
// ─────────────────────────────────────────────

const useSmartGrouping = computed(() => viewMode.value === 'list' && sortKey.value === 'priority')

const jobsNeedingAttention = computed(() =>
  useSmartGrouping.value
    ? sortedJobs.value.filter((j: any) => j.status === 'open' && (j.pipeline?.new ?? 0) > 0)
    : [],
)

const otherJobs = computed(() =>
  useSmartGrouping.value
    ? sortedJobs.value.filter((j: any) => !(j.status === 'open' && (j.pipeline?.new ?? 0) > 0))
    : sortedJobs.value,
)

const isEmpty = computed(() => jobs.value.length === 0)
const noResults = computed(() => !isEmpty.value && filteredJobs.value.length === 0)

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatDate(date: string | Date) {
  const diff = Date.now() - new Date(date).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days < 1) return 'Today'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return new Date(date).toLocaleDateString()
}

// ─────────────────────────────────────────────
// Column visibility (table view)
// ─────────────────────────────────────────────

const COLUMNS_STORAGE_KEY = 'reqcore:columns:jobs'

const defaultColumnVisibility = {
  status: true,
  type: true,
  location: true,
  experience: true,
  remote: false,
  newApps: true,
  totalActive: true,
  created: true,
}

const visibleColumns = ref<Record<string, boolean>>({ ...defaultColumnVisibility })

const jobColumns = [
  { key: 'title', label: 'Title', required: true },
  { key: 'status', label: 'Status' },
  { key: 'type', label: 'Type' },
  { key: 'location', label: 'Location' },
  { key: 'experience', label: 'Experience' },
  { key: 'remote', label: 'Remote' },
  { key: 'newApps', label: 'New apps' },
  { key: 'totalActive', label: 'Total active' },
  { key: 'created', label: 'Created' },
]

onMounted(() => {
  try {
    const raw = window.localStorage.getItem(COLUMNS_STORAGE_KEY)
    if (raw) visibleColumns.value = { ...defaultColumnVisibility, ...JSON.parse(raw) }
  } catch {}
})

watch(visibleColumns, (val) => {
  try { window.localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(val)) } catch {}
}, { deep: true })

// ─────────────────────────────────────────────
// Drawer + Saved Views
// ─────────────────────────────────────────────

type JobsViewSettings = {
  status: StatusFilter[]
  type: TypeFilter[]
  experience: ExperienceFilter[]
  remote: RemoteFilter[]
  sortKey: SortKey
  sortDir: SortDir
  viewMode: ViewMode
  visibleColumns: Record<string, boolean>
}

const defaultSettings: JobsViewSettings = {
  status: [],
  type: [],
  experience: [],
  remote: [],
  sortKey: 'priority',
  sortDir: 'desc',
  viewMode: 'list',
  visibleColumns: { ...defaultColumnVisibility },
}

const drawerOpen = ref(false)

const currentSettings = computed<JobsViewSettings>(() => ({
  status: [...statusFilter.value],
  type: [...typeFilter.value],
  experience: [...experienceFilter.value],
  remote: [...remoteFilter.value],
  sortKey: sortKey.value,
  sortDir: sortDir.value,
  viewMode: viewMode.value,
  visibleColumns: { ...visibleColumns.value },
}))

function applySettings(s: JobsViewSettings) {
  statusFilter.value = [...(s.status ?? [])]
  typeFilter.value = [...(s.type ?? [])]
  experienceFilter.value = [...(s.experience ?? [])]
  remoteFilter.value = [...(s.remote ?? [])]
  sortKey.value = s.sortKey ?? 'priority'
  sortDir.value = s.sortDir ?? 'desc'
  viewMode.value = s.viewMode ?? 'list'
  visibleColumns.value = { ...defaultColumnVisibility, ...(s.visibleColumns ?? {}) }
}

const {
  views,
  activeViewId,
  applyView,
  saveView,
  updateView,
  deleteView,
  setDefault,
  clearActive,
} = useSavedViews<JobsViewSettings>('jobs', defaultSettings)

onMounted(() => {
  nextTick(() => {
    if (activeViewId.value) {
      const s = applyView(activeViewId.value)
      if (s) applySettings(s)
    }
  })
})

function arrEqual<T>(a: T[], b: T[]) {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((v, i) => v === sb[i])
}

function colsEqual(a: Record<string, boolean>, b: Record<string, boolean>) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) if (Boolean(a[k]) !== Boolean(b[k])) return false
  return true
}

function settingsEqual(a: JobsViewSettings, b: JobsViewSettings) {
  return arrEqual(a.status, b.status)
    && arrEqual(a.type, b.type)
    && arrEqual(a.experience, b.experience)
    && arrEqual(a.remote, b.remote)
    && a.sortKey === b.sortKey
    && a.sortDir === b.sortDir
    && a.viewMode === b.viewMode
    && colsEqual(a.visibleColumns, b.visibleColumns)
}

const isDirty = computed(() => {
  const view = views.value.find(v => v.id === activeViewId.value)
  if (!view) return false
  return !settingsEqual(currentSettings.value, { ...defaultSettings, ...view.settings })
})

function onSelectView(id: string | null) {
  if (id == null) {
    clearActive()
    applySettings(defaultSettings)
    return
  }
  const s = applyView(id)
  if (s) applySettings(s)
}

function onSaveView(name: string) {
  saveView(name, currentSettings.value)
}

function onUpdateView(id: string) {
  updateView(id, { settings: currentSettings.value })
}

const viewModeOptions: { value: ViewMode, label: string, icon: any }[] = [
  { value: 'list', label: 'List', icon: List },
  { value: 'gallery', label: 'Gallery', icon: LayoutGrid },
  { value: 'table', label: 'Table', icon: TableIcon },
]
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <!-- ─── Header ─── -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-50">My Jobs</h1>
        <p v-if="activeOrg" class="text-sm text-surface-500 dark:text-surface-400 mt-1">
          {{ activeOrg.name }}
        </p>
      </div>
      <NuxtLink
        :to="$localePath('/dashboard/jobs/new')"
        class="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors no-underline"
      >
        <Plus class="size-4" />
        New Job
      </NuxtLink>
    </div>

    <!-- ─── Loading ─── -->
    <div v-if="fetchStatus === 'pending'">
      <div class="space-y-4">
        <div
          v-for="i in 3"
          :key="i"
          class="rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-5 animate-pulse"
        >
          <div class="flex items-center justify-between mb-4">
            <div class="h-5 w-48 bg-surface-200 dark:bg-surface-700 rounded" />
            <div class="h-5 w-16 bg-surface-200 dark:bg-surface-700 rounded-full" />
          </div>
          <div class="h-2 w-full bg-surface-200 dark:bg-surface-700 rounded mb-3" />
        </div>
      </div>
    </div>

    <!-- ─── Error ─── -->
    <div
      v-else-if="error"
      class="rounded-lg border border-danger-200 dark:border-danger-900 bg-danger-50 dark:bg-danger-950 p-4 text-sm text-danger-700 dark:text-danger-400"
    >
      Failed to load jobs.
      <button class="underline ml-1 cursor-pointer" @click="refresh()">Retry</button>
    </div>

    <!-- ─── Empty state (no jobs at all) ─── -->
    <div v-else-if="isEmpty" class="flex flex-col items-center justify-center py-20">
      <div class="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-10 text-center max-w-md">
        <Briefcase class="size-12 text-brand-400 mx-auto mb-4" />
        <h2 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">
          Welcome to Reqcore
        </h2>
        <p class="text-sm text-surface-500 dark:text-surface-400 mb-6 leading-relaxed">
          Create your first job posting to start receiving and managing candidates.
        </p>
        <NuxtLink
          :to="$localePath('/dashboard/jobs/new')"
          class="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors no-underline"
        >
          <Plus class="size-4" />
          Create Your First Job
        </NuxtLink>
      </div>
    </div>

    <!-- ─── Jobs content ─── -->
    <template v-else>
      <!-- Search + Views + Columns + Filters + View-mode -->
      <div class="flex flex-wrap items-center gap-2 mb-4">
        <div class="relative flex-1 min-w-[220px]">
          <Search class="size-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            v-model="search"
            type="search"
            placeholder="Search jobs by title, location, or description"
            class="w-full rounded-lg border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 pl-9 pr-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
          />
        </div>

        <SavedViewsMenu
          :views="views"
          :active-view-id="activeViewId"
          :is-dirty="isDirty"
          @select="onSelectView"
          @save="onSaveView"
          @update="onUpdateView"
          @delete="deleteView"
          @set-default="setDefault"
        />

        <ColumnsMenu
          v-if="viewMode === 'table'"
          v-model="visibleColumns"
          :columns="jobColumns"
        />

        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors cursor-pointer"
          :class="drawerActiveCount > 0
            ? 'border-surface-400 bg-surface-100 text-surface-800 dark:border-surface-500 dark:bg-surface-800 dark:text-surface-200'
            : 'border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800'"
          @click="drawerOpen = true"
        >
          <SlidersHorizontal class="size-4" />
          Filters
          <span
            v-if="drawerActiveCount > 0"
            class="inline-flex items-center justify-center min-w-[1rem] h-4 px-1 rounded-full bg-surface-700 dark:bg-surface-300 text-white dark:text-surface-900 text-[10px] font-semibold"
          >{{ drawerActiveCount }}</span>
        </button>

        <!-- View mode switcher -->
        <div
          class="inline-flex rounded-lg border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-0.5"
          role="tablist"
          aria-label="View mode"
        >
          <button
            v-for="opt in viewModeOptions"
            :key="opt.value"
            type="button"
            role="tab"
            :aria-selected="viewMode === opt.value"
            :title="`${opt.label} view`"
            class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer"
            :class="viewMode === opt.value
              ? 'bg-surface-900 text-white dark:bg-surface-100 dark:text-surface-900'
              : 'text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'"
            @click="viewMode = opt.value"
          >
            <component :is="opt.icon" class="size-3.5" />
            <span class="hidden sm:inline">{{ opt.label }}</span>
          </button>
        </div>

        <button
          v-if="hasActiveFilters"
          class="inline-flex items-center gap-1 text-xs text-surface-400 hover:text-danger-600 transition-colors cursor-pointer"
          @click="clearAllFilters"
        >
          <X class="size-3" />
          Clear
        </button>
      </div>

      <!-- ─── Filter drawer ─── -->
      <FilterDrawer
        v-model="drawerOpen"
        title="Filter jobs"
        description="Customize your view, then save it for quick access."
        :active-count="drawerActiveCount"
        saveable
        :default-save-name="`View ${views.length + 1}`"
        @reset="applySettings(defaultSettings)"
        @save-view="onSaveView"
      >
        <div class="space-y-6">
          <!-- Status -->
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400 mb-2">Status</label>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="opt in statusOptions"
                :key="opt.value"
                type="button"
                class="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                :class="statusFilter.includes(opt.value)
                  ? 'bg-surface-900 text-white dark:bg-surface-100 dark:text-surface-900'
                  : 'bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'"
                @click="statusFilter = toggleIn(statusFilter, opt.value)"
              >{{ opt.label }}</button>
            </div>
          </div>

          <!-- Employment type -->
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400 mb-2">Employment type</label>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="opt in typeOptions"
                :key="opt.value"
                type="button"
                class="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                :class="typeFilter.includes(opt.value)
                  ? 'bg-surface-900 text-white dark:bg-surface-100 dark:text-surface-900'
                  : 'bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'"
                @click="typeFilter = toggleIn(typeFilter, opt.value)"
              >{{ opt.label }}</button>
            </div>
          </div>

          <!-- Experience -->
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400 mb-2">Experience</label>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="opt in experienceOptions"
                :key="opt.value"
                type="button"
                class="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                :class="experienceFilter.includes(opt.value)
                  ? 'bg-surface-900 text-white dark:bg-surface-100 dark:text-surface-900'
                  : 'bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'"
                @click="experienceFilter = toggleIn(experienceFilter, opt.value)"
              >{{ opt.label }}</button>
            </div>
          </div>

          <!-- Work arrangement -->
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400 mb-2">Work arrangement</label>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="opt in remoteOptions"
                :key="opt.value"
                type="button"
                class="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                :class="remoteFilter.includes(opt.value)
                  ? 'bg-surface-900 text-white dark:bg-surface-100 dark:text-surface-900'
                  : 'bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'"
                @click="remoteFilter = toggleIn(remoteFilter, opt.value)"
              >{{ opt.label }}</button>
            </div>
          </div>

          <!-- Sort -->
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400 mb-2">Sort by</label>
            <div class="flex gap-2">
              <select
                v-model="sortKey"
                class="flex-1 rounded-lg border border-surface-300 dark:border-surface-700 px-3 py-2 text-sm bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
              >
                <option value="priority">Smart (needs attention first)</option>
                <option value="title">Title</option>
                <option value="status">Status</option>
                <option value="type">Employment type</option>
                <option value="newApps">New applications</option>
                <option value="totalActive">Total active candidates</option>
                <option value="created">Created date</option>
                <option value="updated">Updated date</option>
              </select>
              <select
                v-model="sortDir"
                class="w-32 rounded-lg border border-surface-300 dark:border-surface-700 px-3 py-2 text-sm bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          </div>

          <!-- Default view mode -->
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400 mb-2">Default view mode</label>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="opt in viewModeOptions"
                :key="opt.value"
                type="button"
                class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                :class="viewMode === opt.value
                  ? 'bg-surface-900 text-white dark:bg-surface-100 dark:text-surface-900'
                  : 'bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'"
                @click="viewMode = opt.value"
              >
                <component :is="opt.icon" class="size-3.5" />
                {{ opt.label }}
              </button>
            </div>
            <p class="text-[11px] text-surface-400 dark:text-surface-500 mt-2">
              Saved with this view so it opens the way you like.
            </p>
          </div>
        </div>
      </FilterDrawer>

      <!-- ─── No-results state ─── -->
      <div
        v-if="noResults"
        class="rounded-xl border border-dashed border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-10 text-center"
      >
        <Search class="size-8 text-surface-300 dark:text-surface-600 mx-auto mb-3" />
        <p class="text-sm text-surface-600 dark:text-surface-300 mb-1">No jobs match your search</p>
        <p class="text-xs text-surface-400 dark:text-surface-500 mb-3">Try a different keyword or clear your filters.</p>
        <button
          class="text-sm text-brand-600 hover:text-brand-700 font-medium transition-colors"
          @click="clearAllFilters"
        >
          Clear all filters
        </button>
      </div>

      <!-- ════════════════════════════════════════════ -->
      <!--                 LIST VIEW                    -->
      <!-- ════════════════════════════════════════════ -->
      <template v-else-if="viewMode === 'list'">
        <!-- Needs attention section -->
        <div v-if="jobsNeedingAttention.length > 0" class="mb-8">
          <div class="flex items-center gap-2 mb-3 px-1">
            <Bell class="size-4 text-warning-500" />
            <h2 class="text-sm font-semibold text-surface-900 dark:text-surface-100">
              Needs your attention
            </h2>
            <span class="text-xs text-surface-400 dark:text-surface-500">
              {{ jobsNeedingAttention.length }} job{{ jobsNeedingAttention.length === 1 ? '' : 's' }}
            </span>
          </div>

          <div class="space-y-3">
            <div
              v-for="j in jobsNeedingAttention"
              :key="j.id"
              class="rounded-xl border border-warning-200 dark:border-warning-900/50 bg-white dark:bg-surface-900 overflow-hidden"
            >
              <div class="px-5 pt-4 pb-3">
                <div class="flex items-start justify-between mb-2">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2.5 mb-1">
                      <NuxtLink
                        :to="localePath(`/dashboard/jobs/${j.id}`)"
                        class="text-base font-semibold text-surface-900 dark:text-surface-100 hover:text-brand-600 dark:hover:text-brand-400 transition-colors truncate no-underline"
                      >
                        {{ j.title }}
                      </NuxtLink>
                      <span
                        class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 capitalize"
                        :class="statusBadgeClasses[j.status]"
                      >
                        {{ j.status }}
                      </span>
                    </div>
                    <div class="flex items-center gap-3 text-xs text-surface-400">
                      <span>{{ typeLabels[j.type] ?? j.type }}</span>
                      <span v-if="j.location" class="inline-flex items-center gap-1">
                        <MapPin class="size-3" />
                        {{ j.location }}
                      </span>
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-3">
                  <NuxtLink
                    v-for="stage in stageConfig"
                    :key="stage.key"
                    :to="localePath(`/dashboard/jobs/${j.id}?stage=${stage.key}`)"
                    class="rounded-lg px-2 py-1.5 text-center transition-colors no-underline hover:ring-1 hover:ring-brand-300 dark:hover:ring-brand-700"
                    :class="[stage.bgColor, getStageCount(j.pipeline, stage.key) > 0 ? 'cursor-pointer' : 'opacity-60']"
                  >
                    <div class="text-sm font-bold tabular-nums" :class="stage.textColor">
                      {{ getStageCount(j.pipeline, stage.key) }}
                    </div>
                    <div class="text-[10px] font-medium text-surface-500 dark:text-surface-400">
                      {{ stage.label }}
                    </div>
                  </NuxtLink>
                </div>
              </div>

              <div class="flex items-center gap-2 px-5 py-3 bg-warning-50/50 dark:bg-warning-950/20 border-t border-warning-100 dark:border-warning-900/30">
                <span class="text-xs font-medium text-warning-700 dark:text-warning-400 mr-auto">
                  {{ j.pipeline.new }} new application{{ j.pipeline.new === 1 ? '' : 's' }} to review
                </span>
                <NuxtLink
                  :to="$localePath(`/dashboard/jobs/${j.id}`)"
                  class="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 transition-colors no-underline"
                >
                  <Kanban class="size-3" />
                  Review in Pipeline
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>

        <!-- All other jobs -->
        <div>
          <div v-if="jobsNeedingAttention.length > 0" class="flex items-center gap-2 mb-3 px-1">
            <Briefcase class="size-4 text-surface-400" />
            <h2 class="text-sm font-semibold text-surface-900 dark:text-surface-100">
              All jobs
            </h2>
            <span class="text-xs text-surface-400 dark:text-surface-500">
              {{ otherJobs.length }} job{{ otherJobs.length === 1 ? '' : 's' }}
            </span>
          </div>

          <div class="space-y-3">
            <div
              v-for="j in otherJobs"
              :key="j.id"
              class="rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 px-5 py-4 hover:border-surface-300 dark:hover:border-surface-700 hover:shadow-sm transition-all"
            >
              <div class="flex items-center gap-2.5 mb-1">
                <NuxtLink
                  :to="localePath(`/dashboard/jobs/${j.id}`)"
                  class="text-sm font-semibold text-surface-900 dark:text-surface-100 hover:text-brand-600 dark:hover:text-brand-400 transition-colors truncate no-underline"
                >
                  {{ j.title }}
                </NuxtLink>
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 capitalize"
                  :class="statusBadgeClasses[j.status] ?? 'bg-surface-100 text-surface-600'"
                >
                  {{ j.status }}
                </span>
              </div>
              <div class="flex items-center gap-3 text-xs text-surface-400 mb-3">
                <span>{{ typeLabels[j.type] ?? j.type }}</span>
                <span v-if="j.location" class="inline-flex items-center gap-1">
                  <MapPin class="size-3" />
                  {{ j.location }}
                </span>
                <span v-if="j.status === 'draft'" class="text-surface-400 italic">
                  Not published yet
                </span>
              </div>

              <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
                <NuxtLink
                  v-for="stage in stageConfig"
                  :key="stage.key"
                  :to="localePath(`/dashboard/jobs/${j.id}?stage=${stage.key}`)"
                  class="rounded-lg px-2 py-1.5 text-center transition-colors no-underline hover:ring-1 hover:ring-brand-300 dark:hover:ring-brand-700"
                  :class="[stage.bgColor, getStageCount(j.pipeline, stage.key) > 0 ? 'cursor-pointer' : 'opacity-60']"
                >
                  <div class="text-sm font-bold tabular-nums" :class="stage.textColor">
                    {{ getStageCount(j.pipeline, stage.key) }}
                  </div>
                  <div class="text-[10px] font-medium text-surface-500 dark:text-surface-400">
                    {{ stage.label }}
                  </div>
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- ════════════════════════════════════════════ -->
      <!--                GALLERY VIEW                  -->
      <!-- ════════════════════════════════════════════ -->
      <template v-else-if="viewMode === 'gallery'">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <NuxtLink
            v-for="j in sortedJobs"
            :key="j.id"
            :to="localePath(`/dashboard/jobs/${j.id}`)"
            class="group flex flex-col rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 overflow-hidden hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-md transition-all no-underline"
          >
            <!-- Banner -->
            <div
              class="h-20 px-4 py-3 flex items-start justify-between"
              :class="(j.pipeline?.new ?? 0) > 0
                ? 'bg-gradient-to-br from-warning-50 to-warning-100 dark:from-warning-950/40 dark:to-warning-900/20'
                : 'bg-gradient-to-br from-brand-50 to-brand-100/50 dark:from-brand-950/40 dark:to-brand-900/20'"
            >
              <Briefcase
                class="size-5"
                :class="(j.pipeline?.new ?? 0) > 0 ? 'text-warning-600 dark:text-warning-400' : 'text-brand-600 dark:text-brand-400'"
              />
              <span
                class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize"
                :class="statusBadgeClasses[j.status] ?? 'bg-surface-100 text-surface-600'"
              >
                {{ j.status }}
              </span>
            </div>

            <div class="flex-1 px-4 py-3">
              <h3 class="text-sm font-semibold text-surface-900 dark:text-surface-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors line-clamp-2 mb-1">
                {{ j.title }}
              </h3>
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-surface-500 dark:text-surface-400 mb-3">
                <span>{{ typeLabels[j.type] ?? j.type }}</span>
                <span v-if="j.location" class="inline-flex items-center gap-1 truncate max-w-[150px]">
                  <MapPin class="size-3 shrink-0" />
                  <span class="truncate">{{ j.location }}</span>
                </span>
                <span v-if="j.experienceLevel">{{ experienceLabels[j.experienceLevel] }}</span>
                <span v-if="j.remoteStatus">{{ remoteLabels[j.remoteStatus] }}</span>
              </div>

              <!-- Pipeline strip -->
              <div class="grid grid-cols-6 gap-1 mb-3">
                <div
                  v-for="stage in stageConfig"
                  :key="stage.key"
                  :title="`${stage.label}: ${getStageCount(j.pipeline, stage.key)}`"
                  class="rounded px-1 py-1 text-center"
                  :class="[stage.bgColor, getStageCount(j.pipeline, stage.key) > 0 ? '' : 'opacity-50']"
                >
                  <div class="text-xs font-bold tabular-nums leading-none" :class="stage.textColor">
                    {{ getStageCount(j.pipeline, stage.key) }}
                  </div>
                </div>
              </div>
            </div>

            <div class="px-4 py-2.5 border-t border-surface-100 dark:border-surface-800 flex items-center justify-between text-[11px] text-surface-500 dark:text-surface-400">
              <span class="inline-flex items-center gap-1">
                <Users class="size-3" />
                {{ totalActive(j.pipeline) }} active
              </span>
              <span class="inline-flex items-center gap-1">
                <Calendar class="size-3" />
                {{ formatDate(j.createdAt) }}
              </span>
            </div>
          </NuxtLink>
        </div>
      </template>

      <!-- ════════════════════════════════════════════ -->
      <!--                 TABLE VIEW                   -->
      <!-- ════════════════════════════════════════════ -->
      <template v-else-if="viewMode === 'table'">
        <div class="overflow-x-auto rounded-lg border border-surface-200 dark:border-surface-800">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-surface-50 dark:bg-surface-800/50 border-b border-surface-200 dark:border-surface-800">
                <th class="text-left px-4 py-3 font-medium text-surface-500 dark:text-surface-400">
                  <button class="inline-flex items-center gap-1 hover:text-surface-900 dark:hover:text-surface-100 transition-colors" @click="toggleSort('title')">
                    Title
                    <ArrowUp v-if="sortKey === 'title' && sortDir === 'asc'" class="size-3.5" />
                    <ArrowDown v-else-if="sortKey === 'title' && sortDir === 'desc'" class="size-3.5" />
                    <ArrowUpDown v-else class="size-3.5 opacity-40" />
                  </button>
                </th>
                <th v-if="visibleColumns.status" class="text-left px-4 py-3 font-medium text-surface-500 dark:text-surface-400">
                  <button class="inline-flex items-center gap-1 hover:text-surface-900 dark:hover:text-surface-100 transition-colors" @click="toggleSort('status')">
                    Status
                    <ArrowUp v-if="sortKey === 'status' && sortDir === 'asc'" class="size-3.5" />
                    <ArrowDown v-else-if="sortKey === 'status' && sortDir === 'desc'" class="size-3.5" />
                    <ArrowUpDown v-else class="size-3.5 opacity-40" />
                  </button>
                </th>
                <th v-if="visibleColumns.type" class="text-left px-4 py-3 font-medium text-surface-500 dark:text-surface-400 hidden md:table-cell">
                  <button class="inline-flex items-center gap-1 hover:text-surface-900 dark:hover:text-surface-100 transition-colors" @click="toggleSort('type')">
                    Type
                    <ArrowUp v-if="sortKey === 'type' && sortDir === 'asc'" class="size-3.5" />
                    <ArrowDown v-else-if="sortKey === 'type' && sortDir === 'desc'" class="size-3.5" />
                    <ArrowUpDown v-else class="size-3.5 opacity-40" />
                  </button>
                </th>
                <th v-if="visibleColumns.location" class="text-left px-4 py-3 font-medium text-surface-500 dark:text-surface-400 hidden lg:table-cell">
                  Location
                </th>
                <th v-if="visibleColumns.experience" class="text-left px-4 py-3 font-medium text-surface-500 dark:text-surface-400 hidden lg:table-cell">
                  Experience
                </th>
                <th v-if="visibleColumns.remote" class="text-left px-4 py-3 font-medium text-surface-500 dark:text-surface-400 hidden xl:table-cell">
                  Remote
                </th>
                <th v-if="visibleColumns.newApps" class="text-center px-4 py-3 font-medium text-surface-500 dark:text-surface-400">
                  <button class="inline-flex items-center gap-1 hover:text-surface-900 dark:hover:text-surface-100 transition-colors" @click="toggleSort('newApps')">
                    New
                    <ArrowUp v-if="sortKey === 'newApps' && sortDir === 'asc'" class="size-3.5" />
                    <ArrowDown v-else-if="sortKey === 'newApps' && sortDir === 'desc'" class="size-3.5" />
                    <ArrowUpDown v-else class="size-3.5 opacity-40" />
                  </button>
                </th>
                <th v-if="visibleColumns.totalActive" class="text-center px-4 py-3 font-medium text-surface-500 dark:text-surface-400 hidden sm:table-cell">
                  <button class="inline-flex items-center gap-1 hover:text-surface-900 dark:hover:text-surface-100 transition-colors" @click="toggleSort('totalActive')">
                    Active
                    <ArrowUp v-if="sortKey === 'totalActive' && sortDir === 'asc'" class="size-3.5" />
                    <ArrowDown v-else-if="sortKey === 'totalActive' && sortDir === 'desc'" class="size-3.5" />
                    <ArrowUpDown v-else class="size-3.5 opacity-40" />
                  </button>
                </th>
                <th v-if="visibleColumns.created" class="text-left px-4 py-3 font-medium text-surface-500 dark:text-surface-400 hidden md:table-cell">
                  <button class="inline-flex items-center gap-1 hover:text-surface-900 dark:hover:text-surface-100 transition-colors" @click="toggleSort('created')">
                    Created
                    <ArrowUp v-if="sortKey === 'created' && sortDir === 'asc'" class="size-3.5" />
                    <ArrowDown v-else-if="sortKey === 'created' && sortDir === 'desc'" class="size-3.5" />
                    <ArrowUpDown v-else class="size-3.5 opacity-40" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-surface-100 dark:divide-surface-800">
              <tr
                v-for="j in sortedJobs"
                :key="j.id"
                class="group bg-white dark:bg-surface-900 hover:bg-surface-50 dark:hover:bg-surface-800/60 transition-colors cursor-pointer"
                @click="$router.push(localePath(`/dashboard/jobs/${j.id}`))"
              >
                <td class="px-4 py-3">
                  <NuxtLink
                    :to="localePath(`/dashboard/jobs/${j.id}`)"
                    class="font-semibold text-surface-900 dark:text-surface-100 group-hover:text-brand-600 transition-colors no-underline"
                    @click.stop
                  >
                    {{ j.title }}
                  </NuxtLink>
                </td>
                <td v-if="visibleColumns.status" class="px-4 py-3">
                  <span
                    class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize whitespace-nowrap"
                    :class="statusBadgeClasses[j.status] ?? 'bg-surface-100 text-surface-600'"
                  >
                    {{ j.status }}
                  </span>
                </td>
                <td v-if="visibleColumns.type" class="px-4 py-3 text-surface-600 dark:text-surface-300 hidden md:table-cell whitespace-nowrap">
                  {{ typeLabels[j.type] ?? j.type }}
                </td>
                <td v-if="visibleColumns.location" class="px-4 py-3 text-surface-500 dark:text-surface-400 hidden lg:table-cell">
                  <span v-if="j.location" class="inline-flex items-center gap-1.5 truncate max-w-[200px]">
                    <MapPin class="size-3.5 shrink-0" />
                    <span class="truncate">{{ j.location }}</span>
                  </span>
                  <span v-else class="text-surface-300 dark:text-surface-600">—</span>
                </td>
                <td v-if="visibleColumns.experience" class="px-4 py-3 text-surface-600 dark:text-surface-300 hidden lg:table-cell capitalize whitespace-nowrap">
                  {{ j.experienceLevel ? experienceLabels[j.experienceLevel] : '—' }}
                </td>
                <td v-if="visibleColumns.remote" class="px-4 py-3 text-surface-600 dark:text-surface-300 hidden xl:table-cell whitespace-nowrap">
                  {{ j.remoteStatus ? remoteLabels[j.remoteStatus] : '—' }}
                </td>
                <td v-if="visibleColumns.newApps" class="px-4 py-3 text-center">
                  <span
                    v-if="(j.pipeline?.new ?? 0) > 0"
                    class="inline-flex items-center justify-center min-w-[1.5rem] rounded-full px-2 py-0.5 text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                  >
                    {{ j.pipeline.new }}
                  </span>
                  <span v-else class="text-surface-300 dark:text-surface-600">0</span>
                </td>
                <td v-if="visibleColumns.totalActive" class="px-4 py-3 text-center hidden sm:table-cell tabular-nums text-surface-700 dark:text-surface-300">
                  {{ totalActive(j.pipeline) }}
                </td>
                <td v-if="visibleColumns.created" class="px-4 py-3 text-surface-500 dark:text-surface-400 hidden md:table-cell whitespace-nowrap">
                  {{ formatDate(j.createdAt) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- Total count -->
      <p v-if="!noResults" class="text-xs text-surface-400 pt-4 px-1">
        <template v-if="hasActiveFilters">
          Showing {{ filteredJobs.length }} of {{ total }} job{{ total === 1 ? '' : 's' }}
        </template>
        <template v-else>
          {{ total }} job{{ total === 1 ? '' : 's' }} total
        </template>
      </p>
    </template>
  </div>
</template>
