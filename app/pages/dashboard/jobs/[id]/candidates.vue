<script setup lang="ts">
import { Table2, Filter, Users } from 'lucide-vue-next'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'require-org'],
})

const route = useRoute()
const jobId = route.params.id as string

// ─────────────────────────────────────────────
// Fetch job info for page header
// ─────────────────────────────────────────────

const { data: jobData, status: jobFetchStatus, error: jobError } = useFetch(
  () => `/api/jobs/${jobId}`,
  {
    key: `candidates-job-${jobId}`,
    headers: useRequestHeaders(['cookie']),
  },
)

useSeoMeta({
  title: computed(() =>
    jobData.value ? `Candidates — ${jobData.value.title} — Applirank` : 'Candidates — Applirank',
  ),
})

// ─────────────────────────────────────────────
// Fetch applications for this job
// ─────────────────────────────────────────────

const statusFilter = ref<string | undefined>(undefined)

const { data: appData, status: appFetchStatus, error: appError, refresh: refreshApps } = useFetch('/api/applications', {
  key: `candidates-table-apps-${jobId}`,
  query: computed(() => ({
    jobId,
    limit: 100,
    ...(statusFilter.value && { status: statusFilter.value }),
  })),
  headers: useRequestHeaders(['cookie']),
})

const applications = computed(() => appData.value?.data ?? [])
const total = computed(() => appData.value?.total ?? 0)

// ─────────────────────────────────────────────
// Status filter options
// ─────────────────────────────────────────────

const statuses = [
  { value: undefined, label: 'All Statuses' },
  { value: 'new', label: 'New' },
  { value: 'screening', label: 'Screening' },
  { value: 'interview', label: 'Interview' },
  { value: 'offer', label: 'Offer' },
  { value: 'hired', label: 'Hired' },
  { value: 'rejected', label: 'Rejected' },
]

const statusBadgeClasses: Record<string, string> = {
  new: 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-400',
  screening: 'bg-info-50 text-info-700 dark:bg-info-950 dark:text-info-400',
  interview: 'bg-warning-50 text-warning-700 dark:bg-warning-950 dark:text-warning-400',
  offer: 'bg-success-50 text-success-700 dark:bg-success-950 dark:text-success-400',
  hired: 'bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-300',
  rejected: 'bg-surface-100 text-surface-500 dark:bg-surface-800 dark:text-surface-400',
}

// ─────────────────────────────────────────────
// Row selection → sidebar
// ─────────────────────────────────────────────

const selectedAppId = ref<string | null>(null)
const sidebarOpen = computed(() => Boolean(selectedAppId.value))

function selectRow(appId: string) {
  selectedAppId.value = appId
}

function closeSidebar() {
  selectedAppId.value = null
}

async function handleSidebarUpdated() {
  await refreshApps()
}

// ─────────────────────────────────────────────
// Computed
// ─────────────────────────────────────────────

const isLoading = computed(() => jobFetchStatus.value === 'pending' || appFetchStatus.value === 'pending')
</script>

<template>
  <div>
    <!-- Loading -->
    <div v-if="isLoading" class="text-center py-12 text-surface-400">
      Loading candidates…
    </div>

    <!-- Error -->
    <div
      v-else-if="jobError || appError"
      class="rounded-lg border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700"
    >
      {{ jobError ? 'Job not found or failed to load.' : 'Failed to load candidates.' }}
      <NuxtLink to="/dashboard/jobs" class="underline ml-1">Back to Jobs</NuxtLink>
    </div>

    <template v-else-if="jobData">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
          <Table2 class="size-5 text-surface-500 dark:text-surface-400" />
          <div>
            <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-50">
              {{ jobData.title }}
            </h1>
            <p class="text-sm text-surface-500 dark:text-surface-400">
              {{ total }} candidate{{ total === 1 ? '' : 's' }} applied
            </p>
          </div>
        </div>

        <!-- Status filter -->
        <div class="relative">
          <Filter class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-surface-400" />
          <select
            v-model="statusFilter"
            class="rounded-lg border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 pl-9 pr-8 py-2 text-sm text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors appearance-none"
          >
            <option v-for="s in statuses" :key="String(s.value)" :value="s.value">
              {{ s.label }}
            </option>
          </select>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-if="applications.length === 0"
        class="rounded-lg border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-12 text-center"
      >
        <Users class="size-10 text-surface-300 dark:text-surface-600 mx-auto mb-3" />
        <h3 class="text-base font-semibold text-surface-700 dark:text-surface-200 mb-1">
          {{ statusFilter ? 'No candidates match this filter' : 'No candidates yet' }}
        </h3>
        <p class="text-sm text-surface-500 dark:text-surface-400">
          {{ statusFilter
            ? 'Try changing the status filter.'
            : 'Candidates will appear here when they apply to this job or when you link candidates from the Overview tab.'
          }}
        </p>
      </div>

      <!-- Data table -->
      <div
        v-else
        class="rounded-lg border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 overflow-hidden"
      >
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-950">
                <th class="text-left px-4 py-3 text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide">
                  Name
                </th>
                <th class="text-left px-4 py-3 text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide">
                  Email
                </th>
                <th class="text-left px-4 py-3 text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide">
                  Status
                </th>
                <th class="text-left px-4 py-3 text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide">
                  Score
                </th>
                <th class="text-left px-4 py-3 text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide">
                  Applied
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-surface-100 dark:divide-surface-800">
              <tr
                v-for="app in applications"
                :key="app.id"
                class="cursor-pointer transition-colors"
                :class="selectedAppId === app.id
                  ? 'bg-brand-50 dark:bg-brand-950/50'
                  : 'hover:bg-surface-50 dark:hover:bg-surface-950'"
                @click="selectRow(app.id)"
              >
                <td class="px-4 py-3 font-medium text-surface-900 dark:text-surface-100 whitespace-nowrap">
                  {{ app.candidateFirstName }} {{ app.candidateLastName }}
                </td>
                <td class="px-4 py-3 text-surface-600 dark:text-surface-300 whitespace-nowrap">
                  {{ app.candidateEmail }}
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <span
                    class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize"
                    :class="statusBadgeClasses[app.status] ?? 'bg-surface-100 text-surface-600'"
                  >
                    {{ app.status }}
                  </span>
                </td>
                <td class="px-4 py-3 text-surface-600 dark:text-surface-300 whitespace-nowrap">
                  {{ app.score ?? '—' }}
                </td>
                <td class="px-4 py-3 text-surface-500 dark:text-surface-400 whitespace-nowrap">
                  {{ new Date(app.createdAt).toLocaleDateString() }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Footer / count -->
        <div class="border-t border-surface-200 dark:border-surface-800 px-4 py-2.5 text-xs text-surface-400 bg-surface-50 dark:bg-surface-950">
          {{ total }} candidate{{ total === 1 ? '' : 's' }} total
        </div>
      </div>
    </template>

    <!-- Detail sidebar -->
    <CandidateDetailSidebar
      v-if="selectedAppId"
      :application-id="selectedAppId"
      :open="sidebarOpen"
      @close="closeSidebar"
      @updated="handleSidebarUpdated"
    />
  </div>
</template>
