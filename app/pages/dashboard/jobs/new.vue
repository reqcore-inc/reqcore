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

// Wizard state
const currentStep = ref<1 | 2 | 3>(1)
const steps = [
  { id: 1, title: 'Job details', description: 'Tell applicants about this role.' },
  { id: 2, title: 'Application form', description: 'Design the application form.' },
  { id: 3, title: 'Find candidates', description: 'Post on job boards, engage recruiters.' },
]

// Step 1: Job details (API-supported fields)
const form = ref({
  title: '',
  description: '',
  location: '',
  type: 'full_time' as 'full_time' | 'part_time' | 'contract' | 'internship',
})

// Step 2: Application form (client-only for now)
const applicationForm = ref({
  requireResume: true,
  requireCoverLetter: false,
  questions: [
    // Up to 5 short questions
  ] as string[],
})

// Step 3: Find candidates (client-only for now)
const findCandidates = ref({
  experienceLevel: 'mid' as 'junior' | 'mid' | 'senior' | 'lead',
  skills: [] as string[],
  enableSourcing: true,
  locationPreference: 'anywhere' as 'onsite' | 'hybrid' | 'remote' | 'anywhere',
})

const isSubmitting = ref(false)
const errors = ref<Record<string, string>>({})
const submitError = ref<string | null>(null)

// Validation (only Step 1 is required to submit)
const formSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or less'),
  description: z.string().optional(),
  location: z.string().optional(),
  type: z.enum(['full_time', 'part_time', 'contract', 'internship']),
})

function validateStep1(): boolean {
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

const canGoNext = computed(() => {
  if (currentStep.value === 1) return validateStep1()
  return true
})

function nextStep() {
  if (currentStep.value < 3) {
    if (currentStep.value === 1 && !validateStep1()) return
    currentStep.value++
  }
}

function prevStep() {
  if (currentStep.value > 1) currentStep.value--
}

function addQuestion() {
  if (applicationForm.value.questions.length >= 5) return
  applicationForm.value.questions.push('')
}

function removeQuestion(index: number) {
  applicationForm.value.questions.splice(index, 1)
}

function addSkillFromInput(e: Event) {
  const input = e.target as HTMLInputElement
  const value = input.value.trim()
  if (!value) return
  value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((skill) => {
      if (!findCandidates.value.skills.includes(skill)) {
        findCandidates.value.skills.push(skill)
      }
    })
  input.value = ''
}

function removeSkill(index: number) {
  findCandidates.value.skills.splice(index, 1)
}

async function handleSubmit() {
  submitError.value = null
  // Ensure step 1 is valid before submit
  if (!validateStep1()) {
    currentStep.value = 1
    return
  }

  isSubmitting.value = true
  try {
    await createJob({
      title: form.value.title,
      description: form.value.description || undefined,
      location: form.value.location || undefined,
      type: form.value.type,
    })
    // NOTE: applicationForm & findCandidates are client-only for now
    await navigateTo('/dashboard/jobs')
  } catch (err: any) {
    submitError.value = err?.data?.statusMessage ?? 'Something went wrong'
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
  <div class="mx-auto max-w-6xl px-4 py-8">
    <!-- Header with top actions -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
      <div>
        <NuxtLink
          to="/dashboard/jobs"
          class="inline-flex items-center gap-1 text-sm text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 mb-2 transition-colors"
        >
          <ArrowLeft class="size-4" />
          Back to Jobs
        </NuxtLink>
        <h1 class="text-3xl font-bold text-surface-900 dark:text-surface-100">New Job</h1>
      </div>
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="px-4 py-2 text-sm font-medium text-surface-700 dark:text-surface-300 bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-700 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
        >
          Save draft
        </button>
        <button
          v-if="currentStep < 3"
          type="button"
          :disabled="!canGoNext"
          @click="nextStep"
          class="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          Save & continue
        </button>
        <button
          v-else
          type="button"
          :disabled="isSubmitting"
          @click="handleSubmit"
          class="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {{ isSubmitting ? 'Creating...' : 'Create job' }}
        </button>
      </div>
    </div>

    <!-- Stepper -->
    <div class="mb-10 overflow-x-auto pb-4">
      <ol class="flex items-start gap-8 min-w-max">
        <li v-for="step in steps" :key="step.id" class="flex-1 flex flex-col gap-3 min-w-[180px]">
          <div class="flex flex-col gap-3">
            <div class="flex items-center gap-3">
              <div
                class="flex items-center justify-center size-8 rounded-full border text-sm font-medium shrink-0 transition-all"
                :class="[
                  currentStep === step.id
                    ? 'bg-brand-600 text-white border-brand-600 ring-4 ring-brand-100 dark:ring-brand-950'
                    : currentStep > step.id
                      ? 'bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-800'
                      : 'bg-white dark:bg-surface-900 text-surface-500 dark:text-surface-400 border-surface-200 dark:border-surface-800'
                ]"
              >
                <span v-if="currentStep > step.id">✓</span>
                <span v-else>{{ step.id }}</span>
              </div>
              <span 
                class="text-sm font-semibold" 
                :class="currentStep >= step.id ? 'text-surface-900 dark:text-surface-100' : 'text-surface-400 dark:text-surface-500'"
              >
                {{ step.title }}
              </span>
            </div>
            <p class="text-xs leading-relaxed text-surface-500 dark:text-surface-400 pl-11">
              {{ step.description }}
            </p>
          </div>
          <div 
            class="h-1 rounded-full transition-colors mt-1" 
            :class="currentStep >= step.id ? 'bg-brand-600' : 'bg-surface-200 dark:bg-surface-800'" 
          />
        </li>
      </ol>
    </div>

    <!-- Main Layout: Form + Tips -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <!-- Left side: Form -->
      <div class="lg:col-span-8 space-y-6">
        <!-- Server error -->
        <div
          v-if="submitError"
          class="rounded-lg border border-danger-200 dark:border-danger-800 bg-danger-50 dark:bg-danger-950 p-4 text-sm text-danger-700 dark:text-danger-400 mb-4"
        >
          {{ submitError }}
        </div>

        <div class="rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 shadow-sm overflow-hidden">
          <form @submit.prevent="handleSubmit" class="p-6 md:p-8">
            <!-- Step 1: Job details -->
            <section v-if="currentStep === 1" class="space-y-10">
              <!-- Section: Job title and department -->
              <div class="space-y-6">
                <div>
                  <h2 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-6 pb-2 border-b border-surface-100 dark:border-surface-800">Job title and department</h2>
                  <label for="title" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                    Job title <span class="text-danger-500">*</span>
                  </label>
                  <input
                    id="title"
                    v-model="form.title"
                    type="text"
                    placeholder="e.g. Senior Frontend Engineer"
                    class="w-full rounded-lg border px-3 py-2.5 text-sm text-surface-900 dark:text-surface-100 bg-white dark:bg-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                    :class="errors.title ? 'border-danger-300 ring-1 ring-danger-100' : 'border-surface-300 dark:border-surface-700'"
                  />
                  <p v-if="errors.title" class="mt-1.5 text-xs text-danger-600 dark:text-danger-400 font-medium">{{ errors.title }}</p>
                  <p v-else class="mt-1.5 text-xs text-surface-500">80 characters left. No special characters.</p>
                </div>
              </div>

              <!-- Section: Location -->
              <div class="space-y-6">
                <h2 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-6 pb-2 border-b border-surface-100 dark:border-surface-800">Location</h2>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label for="location" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                      Office location
                    </label>
                    <input
                      id="location"
                      v-model="form.location"
                      type="text"
                      placeholder="e.g. New York, NY 10019, United States"
                      class="w-full rounded-lg border px-3 py-2.5 text-sm text-surface-900 dark:text-surface-100 bg-white dark:bg-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors border-surface-300 dark:border-surface-700"
                    />
                  </div>
                  <div>
                    <label for="type" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                      Workplace type
                    </label>
                    <select
                      id="type"
                      v-model="form.type"
                      class="w-full rounded-lg border px-3 py-2.5 text-sm text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors bg-white dark:bg-surface-900 border-surface-300 dark:border-surface-700"
                    >
                      <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Section: Description -->
              <div class="space-y-6">
                <h2 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-6 pb-2 border-b border-surface-100 dark:border-surface-800">Description</h2>
                <div>
                  <label for="description" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                    About the role
                  </label>
                  <textarea
                    id="description"
                    v-model="form.description"
                    rows="10"
                    placeholder="Describe the role, responsibilities, and requirements…"
                    class="w-full rounded-lg border px-4 py-3 text-sm text-surface-900 dark:text-surface-100 bg-white dark:bg-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors border-surface-300 dark:border-surface-700"
                  />
                  <p class="mt-2 text-xs text-surface-500">Minimum 700 characters recommended.</p>
                </div>
              </div>
            </section>

            <!-- Step 2: Application form -->
            <section v-else-if="currentStep === 2" class="space-y-8">
              <div>
                <h2 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-6 pb-2 border-b border-surface-100 dark:border-surface-800">Application requirements</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label class="flex items-center gap-3 p-4 rounded-xl border border-surface-200 dark:border-surface-800 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
                    <input type="checkbox" v-model="applicationForm.requireResume" class="size-4 rounded border-surface-300 dark:border-surface-700 text-brand-600 focus:ring-brand-500" />
                    <div>
                      <span class="block text-sm font-medium text-surface-900 dark:text-surface-100">Require resume/CV</span>
                      <span class="text-xs text-surface-500">Candidates must upload a file.</span>
                    </div>
                  </label>
                  <label class="flex items-center gap-3 p-4 rounded-xl border border-surface-200 dark:border-surface-800 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
                    <input type="checkbox" v-model="applicationForm.requireCoverLetter" class="size-4 rounded border-surface-300 dark:border-surface-700 text-brand-600 focus:ring-brand-500" />
                    <div>
                      <span class="block text-sm font-medium text-surface-900 dark:text-surface-100">Ask for cover letter</span>
                      <span class="text-xs text-surface-500">Optional for candidates.</span>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <div class="flex items-center justify-between mb-6 pb-2 border-b border-surface-100 dark:border-surface-800">
                  <h2 class="text-lg font-semibold text-surface-900 dark:text-surface-100">Custom questions</h2>
                  <button type="button" @click="addQuestion" :disabled="applicationForm.questions.length >= 5" class="inline-flex items-center px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950 rounded-lg transition-colors disabled:opacity-50">
                    + Add question
                  </button>
                </div>
                <div class="space-y-4">
                  <div v-for="(q, idx) in applicationForm.questions" :key="idx" class="flex items-center gap-3">
                    <div class="flex-1">
                      <input
                        v-model="applicationForm.questions[idx]"
                        type="text"
                        placeholder="e.g. What is your experience with Vue.js?"
                        class="w-full rounded-lg border px-3 py-2.5 text-sm bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 border-surface-300 dark:border-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      />
                    </div>
                    <button type="button" @click="removeQuestion(idx)" class="p-2 text-surface-400 hover:text-danger-600 transition-colors">
                      <span class="sr-only">Remove</span>
                      <svg class="size-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                      </svg>
                    </button>
                  </div>
                  <div v-if="applicationForm.questions.length === 0" class="text-center py-8 border-2 border-dashed border-surface-200 dark:border-surface-800 rounded-xl">
                    <p class="text-sm text-surface-500">No custom questions added yet.</p>
                  </div>
                </div>
              </div>
            </section>

            <!-- Step 3: Find candidates -->
            <section v-else class="space-y-8">
              <div>
                <h2 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-6 pb-2 border-b border-surface-100 dark:border-surface-800">Targeting details</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Experience level</label>
                    <select v-model="findCandidates.experienceLevel" class="w-full rounded-lg border px-3 py-2.5 text-sm bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 border-surface-300 dark:border-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500">
                      <option value="junior">Junior</option>
                      <option value="mid">Mid</option>
                      <option value="senior">Senior</option>
                      <option value="lead">Lead</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Location preference</label>
                    <select v-model="findCandidates.locationPreference" class="w-full rounded-lg border px-3 py-2.5 text-sm bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 border-surface-300 dark:border-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500">
                      <option value="anywhere">Anywhere</option>
                      <option value="remote">Remote</option>
                      <option value="hybrid">Hybrid</option>
                      <option value="onsite">Onsite</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <h2 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-6 pb-2 border-b border-surface-100 dark:border-surface-800">Key skills</h2>
                <div class="rounded-lg border border-surface-300 dark:border-surface-700 p-3 focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500 transition-all">
                  <div class="flex flex-wrap gap-2 mb-2">
                    <span
                      v-for="(skill, idx) in findCandidates.skills"
                      :key="skill + idx"
                      class="inline-flex items-center gap-1.5 rounded-full bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200 border border-brand-100 dark:border-brand-900 px-2.5 py-1 text-xs font-medium"
                    >
                      {{ skill }}
                      <button type="button" class="text-brand-400 hover:text-brand-600 dark:hover:text-brand-100 transition-colors" @click="removeSkill(idx)">×</button>
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Type a skill and press Enter..."
                    class="w-full border-0 focus:ring-0 bg-transparent text-sm placeholder:text-surface-400"
                    @keydown.enter.prevent="addSkillFromInput"
                    @blur="addSkillFromInput"
                  />
                </div>
                <p class="mt-2 text-xs text-surface-500">Examples: Vue, TypeScript, Tailwind, GraphQL, AWS</p>
              </div>

              <div class="pt-4">
                <label class="flex items-center gap-3 p-4 rounded-xl border border-surface-200 dark:border-surface-800 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
                  <input type="checkbox" v-model="findCandidates.enableSourcing" class="size-4 rounded border-surface-300 dark:border-surface-700 text-brand-600 focus:ring-brand-500" />
                  <div>
                    <span class="block text-sm font-medium text-surface-900 dark:text-surface-100">Enable candidate sourcing recommendations</span>
                    <span class="text-xs text-surface-500">Let AI help you find the best matches.</span>
                  </div>
                </label>
              </div>
            </section>

            <!-- Actions Footer -->
            <div class="flex items-center justify-between mt-12 pt-8 border-t border-surface-100 dark:border-surface-800">
              <NuxtLink
                to="/dashboard/jobs"
                class="px-6 py-2.5 text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
              >
                Cancel
              </NuxtLink>

              <div class="flex items-center gap-3">
                <button
                  v-if="currentStep > 1"
                  type="button"
                  @click="prevStep"
                  class="px-6 py-2.5 text-sm font-medium text-surface-700 dark:text-surface-300 bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-700 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                >
                  Back
                </button>
                <button
                  v-if="currentStep < 3"
                  type="button"
                  :disabled="!canGoNext"
                  @click="nextStep"
                  class="px-8 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  Save & continue
                </button>
                <button
                  v-else
                  type="submit"
                  :disabled="isSubmitting"
                  class="px-8 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  {{ isSubmitting ? 'Creating...' : 'Create job' }}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <!-- Right side: Tips -->
      <aside class="lg:col-span-4 space-y-6">
        <div class="sticky top-8 space-y-6">
          <div class="rounded-xl border border-surface-200 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-900/50 p-6">
            <h3 class="text-sm font-bold text-surface-900 dark:text-surface-100 uppercase tracking-wider mb-4">Tips</h3>
            <ul class="space-y-4">
              <li v-if="currentStep === 1" class="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                <p class="font-medium text-surface-900 dark:text-surface-100 mb-1">Use common job titles</p>
                Advertise for just one job e.g. 'Nurse', not 'nurses'.
              </li>
              <li v-if="currentStep === 1" class="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                <p class="font-medium text-surface-900 dark:text-surface-100 mb-1">Office location</p>
                Use a location to attract the most appropriate candidates. Some job boards require a location.
              </li>
              <li v-if="currentStep === 1" class="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                <p class="font-medium text-surface-900 dark:text-surface-100 mb-1">Format description</p>
                Format into sections and lists to improve readability.
              </li>
              <li v-if="currentStep === 2" class="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                <p class="font-medium text-surface-900 dark:text-surface-100 mb-1">Keep it short</p>
                Too many questions can deter candidates. Stick to 3-5 essential questions.
              </li>
              <li v-if="currentStep === 3" class="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                <p class="font-medium text-surface-900 dark:text-surface-100 mb-1">Be specific with skills</p>
                Adding specific skills helps our AI better match candidates to your role.
              </li>
            </ul>
          </div>
          
          <div v-if="currentStep === 1" class="p-6 rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-900/30">
            <h4 class="text-sm font-semibold text-brand-900 dark:text-brand-100 mb-2">Need help?</h4>
            <p class="text-xs text-brand-700 dark:text-brand-300 leading-relaxed">
              Our AI can help you write a compelling job description. Click the magic wand icon in the editor.
            </p>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>
