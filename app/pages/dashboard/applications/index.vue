<script setup lang="ts">
import { FileText, ChevronDown, X, Check, Briefcase, Clock, Search, MapPin, Mail } from 'lucide-vue-next'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'require-org'],
})

useSeoMeta({
  title: 'Applications — Applirank',
  description: 'Manage applications across all jobs',
})

const router = useRouter()

// ── Search ────────────────────────────────────────────────────────────────────

const searchInput = ref('')
const debouncedSearch = ref<string | undefined>(undefined)

let debounceTimer: ReturnType<typeof setTimeout>
watch(searchInput, (val) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debouncedSearch.value = val.trim() || undefined
  }, 300)
})

// ── Filters ───────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected'] as const
type Status = typeof STATUS_OPTIONS[number]

const selectedStatuses = useState<Status[]>('app-filter-statuses', () => [])
const selectedJobId = useState<string | undefined>('app-filter-job', () => undefined)
const scoreMin = useState<number | undefined>('app-filter-score-min', () => undefined)
const scoreMax = useState<number | undefined>('app-filter-score-max', () => undefined)

const statusFilter = computed(() =>
  selectedStatuses.value.length === 1 ? selectedStatuses.value[0] : undefined,
)

const { applications, total, fetchStatus, error, refresh } = useApplications({
  status: statusFilter,
  jobId: computed(() => selectedJobId.value),
  search: debouncedSearch,
})

const { jobs } = useJobs()

function toggleStatus(s: Status) {
  if (selectedStatuses.value.includes(s)) {
    selectedStatuses.value = selectedStatuses.value.filter(x => x !== s)
  }
  else {
    selectedStatuses.value = [...selectedStatuses.value, s]
  }
}

// ── Dropdowns ─────────────────────────────────────────────────────────────────

const statusDropdownOpen = ref(false)
const statusDropdownRef = ref<HTMLElement | null>(null)
const jobDropdownOpen = ref(false)
const jobDropdownRef = ref<HTMLElement | null>(null)
const scoreDropdownOpen = ref(false)
const scoreDropdownRef = ref<HTMLElement | null>(null)
const sortDropdownOpen = ref(false)
const sortDropdownRef = ref<HTMLElement | null>(null)

function handleOutsideClick(e: MouseEvent) {
  if (statusDropdownRef.value && !statusDropdownRef.value.contains(e.target as Node))
    statusDropdownOpen.value = false
  if (jobDropdownRef.value && !jobDropdownRef.value.contains(e.target as Node))
    jobDropdownOpen.value = false
  if (scoreDropdownRef.value && !scoreDropdownRef.value.contains(e.target as Node))
    scoreDropdownOpen.value = false
  if (sortDropdownRef.value && !sortDropdownRef.value.contains(e.target as Node))
    sortDropdownOpen.value = false
}
onMounted(() => document.addEventListener('mousedown', handleOutsideClick))
onUnmounted(() => document.removeEventListener('mousedown', handleOutsideClick))

const activeFilterCount = computed(() => {
  let n = selectedStatuses.value.length
  if (selectedJobId.value) n++
  if (scoreMin.value != null) n++
  if (scoreMax.value != null) n++
  return n
})

// ── Sorting ───────────────────────────────────────────────────────────────────

type SortKey = 'candidate' | 'job' | 'score' | 'status' | 'createdAt'
type SortDir = 'asc' | 'desc'

const sortKey = useState<SortKey>('app-sort-key', () => 'createdAt')
const sortDir = useState<SortDir>('app-sort-dir', () => 'desc')

const sortOptions: { key: SortKey, dir: SortDir, label: string }[] = [
  { key: 'createdAt', dir: 'desc', label: 'Newest first' },
  { key: 'createdAt', dir: 'asc', label: 'Oldest first' },
  { key: 'score', dir: 'desc', label: 'Highest score' },
  { key: 'score', dir: 'asc', label: 'Lowest score' },
  { key: 'candidate', dir: 'asc', label: 'Name A–Z' },
  { key: 'candidate', dir: 'desc', label: 'Name Z–A' },
]

const currentSortLabel = computed(() => {
  const match = sortOptions.find(o => o.key === sortKey.value && o.dir === sortDir.value)
  return match?.label ?? 'Newest first'
})

function setSort(key: SortKey, dir: SortDir) {
  sortKey.value = key
  sortDir.value = dir
  sortDropdownOpen.value = false
}

const sorted = computed(() => {
  return [...applications.value]
    .filter((app) => {
      if (selectedStatuses.value.length > 1 && !selectedStatuses.value.includes(app.status as Status)) return false
      if (scoreMin.value != null && (app.score ?? 0) < scoreMin.value) return false
      if (scoreMax.value != null && (app.score ?? 0) > scoreMax.value) return false
      return true
    })
    .sort((a, b) => {
      let cmp = 0
      switch (sortKey.value) {
        case 'candidate':
          cmp = `${a.candidateFirstName} ${a.candidateLastName}`.localeCompare(`${b.candidateFirstName} ${b.candidateLastName}`)
          break
        case 'job':
          cmp = a.jobTitle.localeCompare(b.jobTitle)
          break
        case 'score':
          cmp = (a.score ?? -1) - (b.score ?? -1)
          break
        case 'status':
          cmp = a.status.localeCompare(b.status)
          break
        case 'createdAt':
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
      }
      return sortDir.value === 'asc' ? cmp : -cmp
    })
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(date: string | Date) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(date).toLocaleDateString()
}

function candidateInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

function scoreClass(score: number) {
  if (score >= 75) return 'bg-success-50 text-success-700 dark:bg-success-950 dark:text-success-400'
  if (score >= 40) return 'bg-warning-50 text-warning-700 dark:bg-warning-950 dark:text-warning-400'
  return 'bg-danger-50 text-danger-700 dark:bg-danger-950 dark:text-danger-400'
}

const statusBadgeClasses: Record<string, string> = {
  new: 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-400',
  screening: 'bg-info-50 text-info-700 dark:bg-info-950 dark:text-info-400',
  interview: 'bg-warning-50 text-warning-700 dark:bg-warning-950 dark:text-warning-400',
  offer: 'bg-success-50 text-success-700 dark:bg-success-950 dark:text-success-400',
  hired: 'bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-300',
  rejected: 'bg-surface-100 text-surface-500 dark:bg-surface-800 dark:text-surface-400',
}

const statusLabels: Record<Status, string> = {
  new: 'New',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
}

function clearFilters() {
  selectedStatuses.value = []
  selectedJobId.value = undefined
  scoreMin.value = undefined
  scoreMax.value = undefined
}
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-50">Applications</h1>
        <p class="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Track candidates through your hiring pipeline.
        </p>
      </div>
    </div>

    <!-- Search bar -->
    <div class="relative mb-4">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-surface-400" />
      <input
        v-model="searchInput"
        type="text"
        placeholder="Search all applications by name, email, or job title…"
        class="w-full rounded-lg border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 pl-10 pr-3 py-2.5 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
      />
    </div>

    <!-- Filter bar -->
    <div class="flex items-center gap-3 flex-wrap mb-5">
      <!-- Job dropdown -->
      <div ref="jobDropdownRef" class="relative">
        <button
          class="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors cursor-pointer"
          :class="selectedJobId
            ? 'border-brand-300 dark:border-brand-700 bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300'
            : 'border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 text-surface-700 dark:text-surface-300 hover:border-surface-300 dark:hover:border-surface-700'"
          @click="jobDropdownOpen = !jobDropdownOpen"
        >
          Job
          <ChevronDown class="size-4 opacity-50" />
        </button>

        <div
          v-if="jobDropdownOpen"
          class="absolute left-0 top-full mt-1.5 z-30 w-64 max-h-64 overflow-y-auto rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 shadow-lg py-1.5"
        >
          <button
            class="w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer"
            :class="!selectedJobId
              ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950 font-medium'
              : 'text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800'"
            @click="selectedJobId = undefined; jobDropdownOpen = false"
          >
            All jobs
          </button>
          <button
            v-for="j in jobs"
            :key="j.id"
            class="w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer truncate"
            :class="selectedJobId === j.id
              ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950 font-medium'
              : 'text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800'"
            @click="selectedJobId = j.id; jobDropdownOpen = false"
          >
            {{ j.title }}
          </button>
        </div>
      </div>

      <!-- Status dropdown -->
      <div ref="statusDropdownRef" class="relative">
        <button
          class="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors cursor-pointer"
          :class="selectedStatuses.length > 0
            ? 'border-brand-300 dark:border-brand-700 bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300'
            : 'border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 text-surface-700 dark:text-surface-300 hover:border-surface-300 dark:hover:border-surface-700'"
          @click="statusDropdownOpen = !statusDropdownOpen"
        >
          Stage
          <span
            v-if="selectedStatuses.length > 0"
            class="inline-flex items-center justify-center size-5 rounded-full bg-brand-500 text-white text-[10px] font-semibold"
          >
            {{ selectedStatuses.length }}
          </span>
          <ChevronDown class="size-4 opacity-50" />
        </button>

        <div
          v-if="statusDropdownOpen"
          class="absolute left-0 top-full mt-1.5 z-30 w-56 rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 shadow-lg py-1.5"
        >
          <label
            v-for="s in STATUS_OPTIONS"
            :key="s"
            class="flex items-center gap-2.5 px-3 py-2 cursor-pointer select-none hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
          >
            <input type="checkbox" class="sr-only" :checked="selectedStatuses.includes(s)" @change="toggleStatus(s)" />
            <span
              class="size-4 shrink-0 rounded border flex items-center justify-center transition-colors"
              :class="selectedStatuses.includes(s)
                ? 'bg-brand-500 border-brand-500'
                : 'bg-white dark:bg-surface-800 border-surface-300 dark:border-surface-600'"
            >
              <Check v-if="selectedStatuses.includes(s)" class="size-3 text-white" :stroke-width="3" />
            </span>
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize"
              :class="statusBadgeClasses[s]"
            >
              {{ statusLabels[s] }}
            </span>
          </label>
        </div>
      </div>

      <!-- Score dropdown -->
      <div ref="scoreDropdownRef" class="relative">
        <button
          class="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors cursor-pointer"
          :class="(scoreMin != null || scoreMax != null)
            ? 'border-brand-300 dark:border-brand-700 bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300'
            : 'border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 text-surface-700 dark:text-surface-300 hover:border-surface-300 dark:hover:border-surface-700'"
          @click="scoreDropdownOpen = !scoreDropdownOpen"
        >
          Score
          <ChevronDown class="size-4 opacity-50" />
        </button>

        <div
          v-if="scoreDropdownOpen"
          class="absolute left-0 top-full mt-1.5 z-30 w-60 rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 shadow-lg p-3"
        >
          <p class="text-xs font-medium text-surface-500 dark:text-surface-400 mb-2">Score range (0–100)</p>
          <div class="flex items-center gap-2">
            <input
              v-model.number="scoreMin"
              type="number"
              min="0"
              max="100"
              placeholder="Min"
              class="w-full rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-1.5 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span class="text-surface-400 text-xs shrink-0">to</span>
            <input
              v-model.number="scoreMax"
              type="number"
              min="0"
              max="100"
              placeholder="Max"
              class="w-full rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-1.5 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
        </div>
      </div>

      <!-- Active filter pills -->
      <template v-if="selectedStatuses.length > 0">
        <span
          v-for="s in selectedStatuses"
          :key="s"
          class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium capitalize cursor-pointer hover:opacity-80 transition-opacity"
          :class="statusBadgeClasses[s]"
          @click="toggleStatus(s as Status)"
        >
          {{ statusLabels[s] }}
          <X class="size-3" />
        </span>
      </template>
      <span
        v-if="selectedJobId"
        class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 cursor-pointer hover:opacity-80 transition-opacity"
        @click="selectedJobId = undefined"
      >
        {{ jobs.find(j => j.id === selectedJobId)?.title ?? 'Job' }}
        <X class="size-3" />
      </span>
      <span
        v-if="scoreMin != null || scoreMax != null"
        class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 cursor-pointer hover:opacity-80 transition-opacity"
        @click="scoreMin = undefined; scoreMax = undefined"
      >
        Score {{ scoreMin ?? '0' }}–{{ scoreMax ?? '100' }}
        <X class="size-3" />
      </span>

      <!-- Clear all -->
      <button
        v-if="activeFilterCount > 0"
        class="text-xs text-surface-400 hover:text-danger-600 dark:hover:text-danger-400 transition-colors cursor-pointer"
        @click="clearFilters"
      >
        Clear all
      </button>
    </div>

    <!-- Loading -->
    <div v-if="fetchStatus === 'pending'" class="text-center py-16 text-surface-400">
      Loading applications…
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="rounded-xl border border-danger-200 dark:border-danger-800 bg-danger-50 dark:bg-danger-950 p-4 text-sm text-danger-700 dark:text-danger-400"
    >
      Failed to load applications. Please try again.
      <button class="underline ml-1" @click="refresh()">Retry</button>
    </div>

    <!-- Empty -->
    <div
      v-else-if="applications.length === 0 && !debouncedSearch && activeFilterCount === 0"
      class="rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-16 text-center"
    >
      <FileText class="size-10 text-surface-300 dark:text-surface-600 mx-auto mb-3" />
      <h3 class="text-base font-semibold text-surface-700 dark:text-surface-200 mb-1">No applications yet</h3>
      <p class="text-sm text-surface-500 dark:text-surface-400">
        Applications will appear here when candidates apply to your jobs or when you manually link candidates.
      </p>
    </div>

    <!-- No results for search/filter -->
    <div
      v-else-if="sorted.length === 0"
      class="rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-16 text-center"
    >
      <Search class="size-10 text-surface-300 dark:text-surface-600 mx-auto mb-3" />
      <h3 class="text-base font-semibold text-surface-700 dark:text-surface-200 mb-1">No applications found</h3>
      <p class="text-sm text-surface-500 dark:text-surface-400 mb-4">
        Try adjusting your search or filters.
      </p>
      <button
        class="text-sm text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
        @click="clearFilters(); searchInput = ''; debouncedSearch = undefined"
      >
        Clear all filters
      </button>
    </div>

    <!-- Application list -->
    <div v-else>
      <!-- Results bar -->
      <div class="flex items-center justify-between mb-0 px-1">
        <p class="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
          {{ sorted.length }} application{{ sorted.length === 1 ? '' : 's' }}
        </p>

        <!-- Sort dropdown -->
        <div ref="sortDropdownRef" class="relative">
          <button
            class="inline-flex items-center gap-1.5 text-sm text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 transition-colors cursor-pointer"
            @click="sortDropdownOpen = !sortDropdownOpen"
          >
            {{ currentSortLabel }}
            <ChevronDown class="size-3.5" />
          </button>

          <div
            v-if="sortDropdownOpen"
            class="absolute right-0 top-full mt-1.5 z-30 w-44 rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 shadow-lg py-1.5"
          >
            <button
              v-for="opt in sortOptions"
              :key="`${opt.key}-${opt.dir}`"
              class="w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer"
              :class="sortKey === opt.key && sortDir === opt.dir
                ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950 font-medium'
                : 'text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800'"
              @click="setSort(opt.key, opt.dir)"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- Column headers -->
      <div class="grid grid-cols-[1fr_1fr] border-b border-surface-200 dark:border-surface-800 mt-3 px-5 pb-2.5">
        <span class="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">Candidate Information</span>
        <span class="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">Job Details</span>
      </div>

      <!-- Card list -->
      <div class="divide-y divide-surface-100 dark:divide-surface-800 rounded-b-xl border-x border-b border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-950">
        <div
          v-for="app in sorted"
          :key="app.id"
          class="grid grid-cols-[1fr_1fr] gap-6 px-5 py-4 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-900 transition-colors group"
          @click="router.push(`/dashboard/applications/${app.id}`)"
        >
          <!-- Left: Candidate info -->
          <div class="flex items-start gap-3 min-w-0">
            <!-- Avatar initials -->
            <div class="size-10 shrink-0 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center">
              <span class="text-sm font-semibold text-brand-700 dark:text-brand-300">
                {{ candidateInitials(app.candidateFirstName, app.candidateLastName) }}
              </span>
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="text-sm font-semibold text-surface-900 dark:text-surface-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors truncate">
                {{ app.candidateFirstName }} {{ app.candidateLastName }}
              </h3>
              <div class="flex items-center gap-1.5 mt-1 text-xs text-surface-400 dark:text-surface-500">
                <Mail class="size-3 shrink-0" />
                <span class="truncate">{{ app.candidateEmail }}</span>
              </div>
              <div class="flex items-center gap-1.5 mt-0.5 text-xs text-surface-400 dark:text-surface-500">
                <Clock class="size-3 shrink-0" />
                <span>Applied {{ timeAgo(app.createdAt) }}</span>
              </div>
            </div>
          </div>

          <!-- Right: Job details + status + score -->
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <Briefcase class="size-3.5 text-surface-400 dark:text-surface-500 shrink-0" />
              <span class="text-sm font-semibold text-surface-900 dark:text-surface-100 truncate">{{ app.jobTitle }}</span>
            </div>
            <div v-if="app.jobLocation" class="flex items-center gap-1.5 mt-1 text-xs text-surface-400 dark:text-surface-500">
              <MapPin class="size-3 shrink-0" />
              <span class="truncate">{{ app.jobLocation }}</span>
            </div>
            <div class="flex items-center gap-2 mt-2">
              <span
                class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize"
                :class="statusBadgeClasses[app.status] ?? 'bg-surface-100 text-surface-600'"
              >
                {{ statusLabels[app.status as Status] ?? app.status }}
              </span>
              <span v-if="app.score != null" class="text-surface-300 dark:text-surface-600">&middot;</span>
              <span
                v-if="app.score != null"
                class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums"
                :class="scoreClass(app.score)"
              >
                {{ app.score }}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="mt-3 px-1">
        <p class="text-xs text-surface-400 dark:text-surface-500">
          Showing {{ sorted.length }} of {{ total }} application{{ total === 1 ? '' : 's' }}
        </p>
      </div>
    </div>
  </div>
</template>
