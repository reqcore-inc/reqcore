<script setup lang="ts">
import { ClipboardList, Sparkles, AlertTriangle, Loader2, RefreshCw, Info, KeyRound, TrendingUp } from 'lucide-vue-next'

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

const { track } = useTrack()

const QUESTION_COUNT_OPTIONS = [5, 8, 10, 15] as const
const TONE_OPTIONS = [
  { value: 'technical', label: 'Technical' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'casual', label: 'Casual' },
] as const

const questionCount = ref<number>(8)
const tone = ref<'technical' | 'balanced' | 'casual'>('balanced')

const isGenerating = ref(false)

/**
 * Distinct failure modes surfaced by the Generate/Regenerate flow. Each maps
 * to its own visual state in the template — see `mapGenerationError` below
 * for the HTTP status/data classification. Raw provider/LLM error text is
 * never rendered: the server already collapses 5xx statusMessage to a fixed
 * string (screening-scenario.post.ts), and 4xx branches below only ever use
 * server-authored (not raw-LLM) copy or fixed friendly copy.
 */
type GenerationErrorKind = 'provider_unconfigured' | 'validation_failed' | 'budget_exceeded' | 'generation_failed'
const generateErrorKind = ref<GenerationErrorKind | null>(null)
const generateError = ref<string | null>(null)
// budgetErrorToHttp()'s data.scope — 'org_free_limit' | 'org_monthly' | 'global_daily'.
// Only populated when generateErrorKind === 'budget_exceeded'; used to suppress the
// "Upgrade plan" CTA for 'global_daily' (a platform-wide pause upgrading can't fix).
const generateErrorBudgetScope = ref<string | null>(null)

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

// ─────────────────────────────────────────────
// Context signals: parsed CV / existing AI score
// ─────────────────────────────────────────────
// Neither the GET nor POST screening-scenario response exposes resume-parse
// status or score presence to the client by design (inputSnapshot is
// server/audit-only — see toClientScenario in screening-scenario.post.ts),
// and this task's file scope is limited to this component + the POST route +
// its test — CandidateDetailSidebar.vue (the parent) is out of scope, so a
// prop can't be threaded down from its existing application/candidate
// fetches. Rather than guess reactively from a response that structurally
// cannot carry this information, this component derives both signals from
// EXISTING endpoints it's already permitted to call (no new server API surface
// added): `/api/applications/:id/scores` (compositeScore — the same data
// ScoreBreakdown.vue renders) directly for hasScore, and — because the parsed-
// resume flag lives on the candidate, not the application — a two-hop bridge
// for hasParsedResume: `/api/applications/:id` (for candidate.id) then
// `/api/candidates/:id` (documents[].parsed — the same flag the Documents tab
// relies on). That's 3 extra client requests total beyond what the parent
// already fetches (scores + the applications bridge + candidates); a follow-up
// task wiring these through as props from CandidateDetailSidebar would remove
// the duplication once the parent is back in scope.
interface ApplicationScoreSummary {
  compositeScore: number | null
}
const { data: scoreSummary } = useFetch<ApplicationScoreSummary>(
  () => `/api/applications/${props.applicationId}/scores`,
  {
    key: computed(() => `screening-panel-scores-${props.applicationId}`),
    headers: useRequestHeaders(['cookie']),
    watch: [() => props.applicationId],
  },
)
// Stale-value guard (same problem cachedScenarioData solves above): useFetch
// doesn't clear `data` the instant `props.applicationId` changes — the previous
// candidate's response can still be sitting in scoreSummary.value while the key
// is mid-refetch for the new id. Track which applicationId each successful
// response actually belongs to, so switching candidates can't transiently show
// a "no score yet" notice built from the PREVIOUS candidate's data.
const scoreSignalAppId = ref<string | null>(null)
watch(scoreSummary, (val) => {
  if (val) scoreSignalAppId.value = props.applicationId
})
const scoreSignalLoaded = computed(() => scoreSummary.value != null && scoreSignalAppId.value === props.applicationId)
const hasScore = computed(() => scoreSummary.value?.compositeScore != null)

interface ApplicationCandidateRef {
  candidate: { id: string } | null
}
const { data: applicationRef } = useFetch<ApplicationCandidateRef>(
  () => `/api/applications/${props.applicationId}`,
  {
    key: computed(() => `screening-panel-application-ref-${props.applicationId}`),
    headers: useRequestHeaders(['cookie']),
    watch: [() => props.applicationId],
  },
)
// Same stale-value guard pattern as scoreSignalAppId, but as the first hop of
// a two-hop bridge: applicationRef.value can still hold the PREVIOUS
// candidate's id right after props.applicationId changes. candidateIdForResumeCheck
// only resolves to a real id once applicationRef is confirmed to belong to the
// currently selected application — otherwise it's null ("not yet known"),
// which correctly keeps hasParsedResume/resumeSignalLoaded from using a
// mismatched candidate id.
const applicationRefAppId = ref<string | null>(null)
watch(applicationRef, (val) => {
  if (val) applicationRefAppId.value = props.applicationId
})
const candidateIdForResumeCheck = computed(() =>
  applicationRefAppId.value === props.applicationId ? (applicationRef.value?.candidate?.id ?? null) : null,
)

interface CandidateDocumentSummary {
  type: string
  parsed: boolean
}
interface CandidateDetailSummary {
  documents: CandidateDocumentSummary[]
}
const { data: candidateDetail, refresh: refreshCandidateDetail } = useFetch<CandidateDetailSummary>(
  () => candidateIdForResumeCheck.value ? `/api/candidates/${candidateIdForResumeCheck.value}` : null!,
  {
    key: computed(() => `screening-panel-candidate-${candidateIdForResumeCheck.value}`),
    headers: useRequestHeaders(['cookie']),
    watch: [candidateIdForResumeCheck],
    immediate: false,
  },
)
watch(candidateIdForResumeCheck, (id) => {
  if (id) refreshCandidateDetail()
}, { immediate: true })

// Second hop of the guard: track which candidateId the current candidateDetail
// response actually belongs to. Two candidate ids (not applicationIds) so that
// switching to a DIFFERENT application for the SAME candidate — where the
// /candidates/:id key doesn't change, so no refetch happens — still correctly
// re-validates as soon as candidateIdForResumeCheck confirms (no stale hide).
const candidateDetailFetchedForId = ref<string | null>(null)
watch(candidateDetail, (val) => {
  if (val) candidateDetailFetchedForId.value = candidateIdForResumeCheck.value
})
const resumeSignalLoaded = computed(() =>
  candidateDetail.value != null
  && candidateIdForResumeCheck.value != null
  && candidateDetailFetchedForId.value === candidateIdForResumeCheck.value,
)
const hasParsedResume = computed(() =>
  (candidateDetail.value?.documents ?? []).some(doc => doc.type === 'resume' && doc.parsed),
)

/**
 * Classify a $fetch error from POST screening-scenario by HTTP status/data
 * shape into one of the distinct UI states this panel renders. Keeping this
 * as a small pure function (rather than inline in the catch block) makes the
 * status/data → state mapping easy to audit in one place.
 */
// The exact phrase loadAiConfig() (server/utils/ai/loadConfig.ts:43-46) throws
// when no BYOK/platform provider is configured — "No AI provider configured.
// Add one in Settings → AI to enable <purpose>." The purpose suffix varies by
// caller, so match on the fixed, purpose-independent prefix only. Mirrors the
// classification precedent in app/pages/dashboard/jobs/[id]/ai-analysis.vue
// (statusCode === 422 && statusMessage.includes('AI provider not configured')-
// style check), adapted to this endpoint's actual server copy.
const PROVIDER_UNCONFIGURED_PHRASE = 'No AI provider configured'

function mapGenerationError(err: any): { kind: GenerationErrorKind, message: string, budgetScope: string | null } {
  const statusCode: number | undefined = err?.statusCode ?? err?.data?.statusCode ?? err?.response?.status
  const budgetCode = err?.data?.data?.code
  const statusMessage: string = typeof err?.data?.statusMessage === 'string' ? err.data.statusMessage : ''

  if (statusCode === 422) {
    // resolveAnalysisProvider() → loadAiConfig() 422: no BYOK/platform provider
    // configured. This is the ONLY 422 that gets the BYOK CTA.
    if (statusMessage.includes(PROVIDER_UNCONFIGURED_PHRASE)) {
      return {
        kind: 'provider_unconfigured',
        message: 'No AI provider configured for this workspace.',
        budgetScope: null,
      }
    }
    // Any other 422 from this route (e.g. "Job description is required to
    // generate a screening scenario.") is a request-validation failure, not a
    // provider problem — show the server's own message verbatim. It's already
    // a safe, fixed, first-party string (not raw provider/LLM text), same as
    // the statusMessage the GET/POST endpoints already return for this case.
    return {
      kind: 'validation_failed',
      message: statusMessage || 'Unable to generate a screening scenario for this application.',
      budgetScope: null,
    }
  }

  // budgetErrorToHttp() always throws 429 with data.code === 'AI_BUDGET_EXCEEDED';
  // 402 is handled defensively as the same class of error. A plain 429 from the
  // route's own rate limiter (no budget code) is NOT a budget/upgrade situation —
  // it falls through to the generic friendly-retry state below.
  if (budgetCode === 'AI_BUDGET_EXCEEDED' || statusCode === 402) {
    return {
      kind: 'budget_exceeded',
      message: statusMessage.length > 0
        ? statusMessage
        : 'AI usage limit reached for this workspace.',
      // 'org_free_limit' | 'org_monthly' | 'global_daily' — see budget.ts's
      // BudgetExceededError scope. Read here (not guessed) so the template can
      // suppress the "Upgrade plan" CTA for 'global_daily' (a platform-wide
      // pause; upgrading this org's plan does not lift it).
      budgetScope: typeof err?.data?.data?.scope === 'string' ? err.data.data.scope : null,
    }
  }

  // 502 (LLM/provider failure, already collapsed server-side) and everything else
  // (including plain rate-limit 429s) get a fixed, friendly retry state. No raw
  // err.message is ever shown here.
  return {
    kind: 'generation_failed',
    message: 'Screening scenario generation failed. Please try again.',
    budgetScope: null,
  }
}

async function generateScenario() {
  isGenerating.value = true
  generateError.value = null
  generateErrorKind.value = null
  generateErrorBudgetScope.value = null
  try {
    await $fetch(`/api/applications/${props.applicationId}/screening-scenario`, {
      method: 'POST',
      headers: useRequestHeaders(['cookie']),
      body: { questionCount: questionCount.value, tone: tone.value },
    })
    await refresh()
    track('screening_scenario_generated', {
      application_id: props.applicationId,
      question_count: questionCount.value,
      tone: tone.value,
    })
    emit('generated')
  } catch (err: any) {
    const mapped = mapGenerationError(err)
    generateErrorKind.value = mapped.kind
    generateError.value = mapped.message
    generateErrorBudgetScope.value = mapped.budgetScope
  } finally {
    isGenerating.value = false
  }
}

function dismissError() {
  generateError.value = null
  generateErrorKind.value = null
  generateErrorBudgetScope.value = null
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

    <!-- Informational notices: generation stays ALLOWED in both cases. -->
    <div
      v-if="resumeSignalLoaded && !hasParsedResume"
      class="rounded-lg border border-surface-200/80 dark:border-surface-800/60 bg-surface-50 dark:bg-surface-800/40 p-3 text-xs text-surface-500 dark:text-surface-400 flex items-start gap-2"
    >
      <Info class="size-3.5 shrink-0 mt-0.5 text-surface-400" />
      <span>No parsed resume — questions will be based on the job description.</span>
    </div>
    <div
      v-if="scoreSignalLoaded && !hasScore"
      class="rounded-lg border border-surface-200/80 dark:border-surface-800/60 bg-surface-50 dark:bg-surface-800/40 p-3 text-xs text-surface-500 dark:text-surface-400 flex items-start gap-2"
    >
      <Info class="size-3.5 shrink-0 mt-0.5 text-surface-400" />
      <span>No AI score yet — questions will still be generated without it.</span>
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

    <!-- Error: provider unconfigured (422) — BYOK CTA -->
    <div
      v-if="generateErrorKind === 'provider_unconfigured'"
      class="rounded-lg border border-brand-200 dark:border-brand-900/60 bg-brand-50/60 dark:bg-brand-950/20 p-3 text-xs text-brand-700 dark:text-brand-300 flex items-start gap-2"
    >
      <KeyRound class="size-4 shrink-0 mt-0.5" />
      <div class="flex-1">
        {{ generateError }}
        <div class="mt-2 flex items-center gap-3">
          <NuxtLink
            to="/dashboard/settings/ai"
            class="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-white bg-brand-600 rounded-md hover:bg-brand-700 transition-colors no-underline"
          >
            Go to AI Settings
          </NuxtLink>
          <button class="underline" @click="dismissError">Dismiss</button>
        </div>
      </div>
    </div>

    <!-- Error: request validation failed (422, not provider-unconfigured) — server message verbatim -->
    <div
      v-if="generateErrorKind === 'validation_failed'"
      class="rounded-lg border border-surface-200/80 dark:border-surface-800/60 bg-surface-50 dark:bg-surface-800/40 p-3 text-xs text-surface-600 dark:text-surface-300 flex items-start gap-2"
    >
      <Info class="size-4 shrink-0 mt-0.5 text-surface-400" />
      <div class="flex-1">
        {{ generateError }}
        <div class="mt-2">
          <button class="underline" @click="dismissError">Dismiss</button>
        </div>
      </div>
    </div>

    <!-- Error: budget/limit exceeded (429/402) — upgrade notice. 'global_daily' is
         a platform-wide pause (not this org's budget), so upgrading a plan can't
         fix it — suppress the "Upgrade plan" CTA and relabel for that scope. -->
    <div
      v-if="generateErrorKind === 'budget_exceeded'"
      class="rounded-lg border border-warning-200 dark:border-warning-800 bg-warning-50 dark:bg-warning-950 p-3 text-xs text-warning-700 dark:text-warning-400 flex items-start gap-2"
    >
      <TrendingUp class="size-4 shrink-0 mt-0.5" />
      <div class="flex-1">
        {{ generateError }}
        <div class="mt-2 flex items-center gap-3">
          <NuxtLink
            v-if="generateErrorBudgetScope !== 'global_daily'"
            to="/dashboard/settings/billing"
            class="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-white bg-warning-600 rounded-md hover:bg-warning-700 transition-colors no-underline"
          >
            Upgrade plan
          </NuxtLink>
          <button class="underline" @click="dismissError">Dismiss</button>
        </div>
      </div>
    </div>

    <!-- Error: generation failed (502 / other) — friendly retry -->
    <div
      v-if="generateErrorKind === 'generation_failed'"
      class="rounded-lg border border-danger-200 dark:border-danger-800 bg-danger-50 dark:bg-danger-950 p-3 text-xs text-danger-700 dark:text-danger-400 flex items-start gap-2"
    >
      <AlertTriangle class="size-4 shrink-0 mt-0.5" />
      <div class="flex-1">
        {{ generateError }}
        <div class="mt-2 flex items-center gap-2">
          <button
            :disabled="isGenerating"
            class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-brand-600 rounded-md hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            @click="generateScenario"
          >
            <Loader2 v-if="isGenerating" class="size-3 animate-spin" />
            <RefreshCw v-else class="size-3" />
            {{ isGenerating ? 'Retrying…' : 'Retry' }}
          </button>
          <button class="underline" @click="dismissError">Dismiss</button>
        </div>
      </div>
    </div>
  </div>
</template>
