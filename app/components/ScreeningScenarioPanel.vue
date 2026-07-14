<script setup lang="ts">
import { ClipboardList, Sparkles, AlertTriangle, Loader2, RefreshCw } from 'lucide-vue-next'

interface ScreeningQuestion {
  category: string
  question: string
  rationale: string
}

interface ScreeningScenario {
  id: string
  status: string
  provider: string | null
  model: string | null
  config: { questionCount: number, tone: 'technical' | 'balanced' | 'casual' } | null
  questions: ScreeningQuestion[] | null
  promptTokens: number | null
  completionTokens: number | null
  errorMessage: string | null
  createdAt: string
}

interface ScreeningScenarioData {
  latest: ScreeningScenario | null
  history: ScreeningScenario[]
}

const props = defineProps<{
  applicationId: string
}>()

const emit = defineEmits<{
  (e: 'generated'): void
}>()

const QUESTION_COUNT_OPTIONS = [5, 8, 10, 15] as const
const TONE_OPTIONS = [
  { value: 'technical', label: 'Technical' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'casual', label: 'Casual' },
] as const

const questionCount = ref<number>(8)
const tone = ref<'technical' | 'balanced' | 'casual'>('balanced')

const isGenerating = ref(false)
const generateError = ref<string | null>(null)

const { data: scenarioData, status, refresh } = useFetch<ScreeningScenarioData>(
  () => `/api/applications/${props.applicationId}/screening-scenario`,
  {
    key: computed(() => `screening-scenario-${props.applicationId}`),
    headers: useRequestHeaders(['cookie']),
    watch: [() => props.applicationId],
  },
)

// Cache last successful data so switching candidates doesn't flash "Loading…"
const cachedScenarioData = ref(scenarioData.value)
watch(scenarioData, (val) => {
  if (val) cachedScenarioData.value = val
})

const resolvedScenarioData = computed(() => scenarioData.value ?? cachedScenarioData.value)
const latest = computed(() => resolvedScenarioData.value?.latest ?? null)
const history = computed(() => resolvedScenarioData.value?.history ?? [])
const hasScenario = computed(() => Boolean(latest.value?.questions?.length))
const isInitialLoad = computed(() => status.value === 'pending' && !cachedScenarioData.value)

async function generateScenario() {
  isGenerating.value = true
  generateError.value = null
  try {
    await $fetch(`/api/applications/${props.applicationId}/screening-scenario`, {
      method: 'POST',
      headers: useRequestHeaders(['cookie']),
      body: { questionCount: questionCount.value, tone: tone.value },
    })
    await refresh()
    emit('generated')
  } catch (err: any) {
    generateError.value = err?.data?.statusMessage ?? 'Screening scenario generation failed. Make sure AI is configured in settings.'
  } finally {
    isGenerating.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Config panel -->
    <div class="rounded-xl border border-surface-200/80 dark:border-surface-800/60 bg-white dark:bg-surface-900 p-4 shadow-sm shadow-surface-900/[0.03] dark:shadow-none">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2.5">
          <div class="flex size-7 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-950/40">
            <ClipboardList class="size-3.5 text-brand-600 dark:text-brand-400" />
          </div>
          <h3 class="text-sm font-semibold text-surface-800 dark:text-surface-200">Screening Scenario</h3>
        </div>
        <span v-if="history.length > 1" class="text-[11px] text-surface-400">
          Generation {{ history.length }}
        </span>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-1.5">
          <label class="text-xs text-surface-500 dark:text-surface-400">Questions</label>
          <select
            v-model.number="questionCount"
            :disabled="isGenerating"
            class="rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-2 py-1.5 text-xs text-surface-700 dark:text-surface-300 focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
          >
            <option v-for="count in QUESTION_COUNT_OPTIONS" :key="count" :value="count">{{ count }}</option>
          </select>
        </div>

        <div class="flex items-center gap-1 rounded-lg border border-surface-200 dark:border-surface-700 p-0.5">
          <button
            v-for="opt in TONE_OPTIONS"
            :key="opt.value"
            type="button"
            :disabled="isGenerating"
            class="px-2.5 py-1 text-xs font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :class="tone === opt.value
              ? 'bg-brand-600 text-white'
              : 'text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300'"
            @click="tone = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>

        <button
          :disabled="isGenerating"
          class="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          @click="generateScenario"
        >
          <Loader2 v-if="isGenerating" class="size-3.5 animate-spin" />
          <RefreshCw v-else-if="hasScenario" class="size-3.5" />
          <Sparkles v-else class="size-3.5" />
          {{ isGenerating ? 'Generating…' : (hasScenario ? 'Regenerate' : 'Generate') }}
        </button>
      </div>
    </div>

    <!-- Loading (only on very first load with no cached data) -->
    <div v-if="isInitialLoad" class="text-center py-8 text-surface-400">
      Loading screening scenario…
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!hasScenario"
      class="rounded-xl border border-surface-200/80 dark:border-surface-800/60 bg-white dark:bg-surface-900 p-4 shadow-sm shadow-surface-900/[0.03] dark:shadow-none text-center"
    >
      <p class="text-sm text-surface-500 dark:text-surface-400">
        No screening scenario yet. Generate a set of interview questions tailored to this candidate and job.
      </p>
    </div>

    <!-- Questions list -->
    <template v-else>
      <div class="space-y-2">
        <div
          v-for="(q, idx) in latest!.questions"
          :key="idx"
          class="rounded-xl border border-surface-200/80 dark:border-surface-800/60 bg-white dark:bg-surface-900 p-3 shadow-sm shadow-surface-900/[0.03] dark:shadow-none"
        >
          <div class="flex items-start gap-2">
            <span class="text-xs font-semibold text-surface-400 tabular-nums shrink-0 mt-0.5">{{ idx + 1 }}.</span>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-sm font-medium text-surface-800 dark:text-surface-200">{{ q.question }}</span>
                <span class="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium ring-1 ring-inset text-surface-500 ring-surface-200 dark:ring-surface-700 bg-surface-50 dark:bg-surface-800 shrink-0">
                  {{ q.category }}
                </span>
              </div>
              <p class="text-xs text-surface-400 dark:text-surface-500 leading-relaxed">{{ q.rationale }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Metadata -->
      <div class="pt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-surface-400">
        <span v-if="latest!.model">{{ latest!.model }}</span>
        <span>{{ new Date(latest!.createdAt).toLocaleString() }}</span>
      </div>
    </template>

    <!-- Error -->
    <div
      v-if="generateError"
      class="rounded-lg border border-danger-200 dark:border-danger-800 bg-danger-50 dark:bg-danger-950 p-3 text-xs text-danger-700 dark:text-danger-400 flex items-start gap-2"
    >
      <AlertTriangle class="size-4 shrink-0 mt-0.5" />
      <div>
        {{ generateError }}
        <div class="mt-2">
          <button class="underline" @click="generateError = null">Dismiss</button>
        </div>
      </div>
    </div>
  </div>
</template>
