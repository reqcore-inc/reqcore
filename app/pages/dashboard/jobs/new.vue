<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'
import { z } from 'zod'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'require-org'],
})

useSeoMeta({
  title: 'Create Job — Applirank',
  description: 'Create a new job posting',
})

const { createJob } = useJobs()

// Form state
const form = ref({
  title: '',
  description: '',
  location: '',
  type: 'full_time' as 'full_time' | 'part_time' | 'contract' | 'internship',
})

const isSubmitting = ref(false)
const errors = ref<Record<string, string>>({})
const submitError = ref<string | null>(null)

const formSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
  description: z.string().optional(),
  location: z.string().optional(),
  type: z.enum(['full_time', 'part_time', 'contract', 'internship']),
})

function validate(): boolean {
  const result = formSchema.safeParse(form.value)
  if (!result.success) {
    errors.value = {}
    for (const issue of result.error.issues) {
      const field = issue.path[0]?.toString()
      if (field) errors.value[field] = issue.message
    }
    return false
  }
  errors.value = {}
  return true
}

async function handleSubmit() {
  submitError.value = null
  if (!validate()) return

  isSubmitting.value = true
  try {
    await createJob({
      title: form.value.title,
      description: form.value.description || undefined,
      location: form.value.location || undefined,
      type: form.value.type,
    })
    await navigateTo('/dashboard/jobs')
  } catch (err: any) {
    submitError.value = err.data?.statusMessage ?? 'Something went wrong'
  } finally {
    isSubmitting.value = false
  }
}

const typeOptions = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
]
</script>

<template>
  <div class="max-w-2xl">
    <!-- Back link -->
    <NuxtLink
      to="/dashboard/jobs"
      class="inline-flex items-center gap-1 text-sm text-surface-500 hover:text-surface-700 mb-6 transition-colors"
    >
      <ArrowLeft class="size-4" />
      Back to Jobs
    </NuxtLink>

    <h1 class="text-2xl font-bold text-surface-900 mb-6">Create Job</h1>

    <!-- Server error -->
    <div
      v-if="submitError"
      class="rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700 mb-4"
    >
      {{ submitError }}
    </div>

    <form class="space-y-5" @submit.prevent="handleSubmit">
      <!-- Title -->
      <div>
        <label for="title" class="block text-sm font-medium text-surface-700 mb-1">
          Title <span class="text-danger-500">*</span>
        </label>
        <input
          id="title"
          v-model="form.title"
          type="text"
          placeholder="e.g. Senior Frontend Engineer"
          class="w-full rounded-lg border px-3 py-2 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
          :class="errors.title ? 'border-danger-300' : 'border-surface-300'"
        />
        <p v-if="errors.title" class="mt-1 text-xs text-danger-600">{{ errors.title }}</p>
      </div>

      <!-- Description -->
      <div>
        <label for="description" class="block text-sm font-medium text-surface-700 mb-1">
          Description
        </label>
        <textarea
          id="description"
          v-model="form.description"
          rows="5"
          placeholder="Describe the role, responsibilities, and requirements…"
          class="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
        />
      </div>

      <!-- Location -->
      <div>
        <label for="location" class="block text-sm font-medium text-surface-700 mb-1">
          Location
        </label>
        <input
          id="location"
          v-model="form.location"
          type="text"
          placeholder="e.g. Remote, New York, Berlin"
          class="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
        />
      </div>

      <!-- Type -->
      <div>
        <label for="type" class="block text-sm font-medium text-surface-700 mb-1">
          Employment Type
        </label>
        <select
          id="type"
          v-model="form.type"
          class="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm text-surface-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors bg-white"
        >
          <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-3 pt-2">
        <button
          type="submit"
          :disabled="isSubmitting"
          class="inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {{ isSubmitting ? 'Creating…' : 'Create Job' }}
        </button>
        <NuxtLink
          to="/dashboard/jobs"
          class="rounded-lg border border-surface-300 px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 transition-colors"
        >
          Cancel
        </NuxtLink>
      </div>
    </form>
  </div>
</template>
