<script setup lang="ts">
import { Briefcase, Plus, MapPin } from 'lucide-vue-next'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'require-org'],
})

useSeoMeta({
  title: 'Jobs — Applirank',
  description: 'Manage your job postings',
})

const statusFilter = ref<string | undefined>(undefined)
const { jobs, total, fetchStatus, error, refresh } = useJobs({ status: statusFilter })

const statusTabs = [
  { label: 'All', value: undefined },
  { label: 'Draft', value: 'draft' },
  { label: 'Open', value: 'open' },
  { label: 'Closed', value: 'closed' },
  { label: 'Archived', value: 'archived' },
] as const

const statusBadgeClasses: Record<string, string> = {
  draft: 'bg-surface-100 text-surface-600',
  open: 'bg-success-50 text-success-700',
  closed: 'bg-warning-50 text-warning-700',
  archived: 'bg-surface-100 text-surface-400',
}

const typeLabels: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
}
</script>

<template>
  <div class="max-w-4xl">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-surface-900">Jobs</h1>
        <p class="text-sm text-surface-500 mt-1">
          Manage your open positions and job postings.
        </p>
      </div>
      <NuxtLink
        to="/dashboard/jobs/new"
        class="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
      >
        <Plus class="size-4" />
        Create Job
      </NuxtLink>
    </div>

    <!-- Status filter tabs -->
    <div class="flex gap-1 mb-6 border-b border-surface-200">
      <button
        v-for="tab in statusTabs"
        :key="tab.label"
        class="px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px"
        :class="statusFilter === tab.value
          ? 'border-brand-600 text-brand-600'
          : 'border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300'"
        @click="statusFilter = tab.value"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="fetchStatus === 'pending'" class="text-center py-12 text-surface-400">
      Loading jobs…
    </div>

    <!-- Error state -->
    <div
      v-else-if="error"
      class="rounded-lg border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700"
    >
      Failed to load jobs. Please try again.
      <button class="underline ml-1" @click="refresh()">Retry</button>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="jobs.length === 0"
      class="rounded-lg border border-surface-200 bg-white p-12 text-center"
    >
      <Briefcase class="size-10 text-surface-300 mx-auto mb-3" />
      <h3 class="text-base font-semibold text-surface-700 mb-1">No jobs yet</h3>
      <p class="text-sm text-surface-500 mb-4">
        Create your first job posting to start building your recruitment pipeline.
      </p>
      <NuxtLink
        to="/dashboard/jobs/new"
        class="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
      >
        <Plus class="size-4" />
        Create Job
      </NuxtLink>
    </div>

    <!-- Job list -->
    <div v-else class="space-y-2">
      <NuxtLink
        v-for="j in jobs"
        :key="j.id"
        :to="`/dashboard/jobs/${j.id}`"
        class="flex items-center justify-between rounded-lg border border-surface-200 bg-white px-4 py-3 hover:border-surface-300 hover:shadow-sm transition-all group"
      >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 mb-1">
            <h3 class="text-sm font-semibold text-surface-900 group-hover:text-brand-600 transition-colors truncate">
              {{ j.title }}
            </h3>
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0"
              :class="statusBadgeClasses[j.status] ?? 'bg-surface-100 text-surface-600'"
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
            <span>{{ new Date(j.createdAt).toLocaleDateString() }}</span>
          </div>
        </div>
      </NuxtLink>

      <!-- Total count -->
      <p class="text-xs text-surface-400 pt-2">
        {{ total }} job{{ total === 1 ? '' : 's' }} total
      </p>
    </div>
  </div>
</template>
