<script setup lang="ts">
import { AlertTriangle, ChevronDown, ChevronUp, ClipboardList, Info } from 'lucide-vue-next'

interface AnswerItem {
  question: string
  answer: string
  evidence: string
  score: number
  confidence: number
  strengths: string[]
  gaps: string[]
}

interface SectionScoreItem {
  section: string
  score: number
  maxScore: number
  evidence: string
  summary: string
}

interface TranscriptAnalysis {
  id: string
  status: string
  extractionMode: 'per_answer' | 'section_level' | null
  recommendation: 'advance' | 'hold' | 'do_not_advance' | 'insufficient_evidence' | null
  confidence: number | null
  rationale: string | null
  sectionScores: unknown
  answerBreakdown: unknown
  createdAt: string
}

const props = defineProps<{
  analysis: TranscriptAnalysis
  truncated: boolean
}>()

// ─────────────────────────────────────────────
// Display helpers
// ─────────────────────────────────────────────

const recommendationLabels: Record<string, string> = {
  advance: 'Advance',
  hold: 'Hold',
  do_not_advance: 'Do not advance',
  insufficient_evidence: 'Insufficient evidence',
}

const extractionModeLabels: Record<string, string> = {
  per_answer: 'Per-answer breakdown',
  section_level: 'Topic-level assessment',
}

const sectionScores = computed<SectionScoreItem[]>(() =>
  Array.isArray(props.analysis.sectionScores) ? props.analysis.sectionScores as SectionScoreItem[] : [],
)

const answerBreakdown = computed<AnswerItem[] | null>(() =>
  props.analysis.extractionMode === 'per_answer' && Array.isArray(props.analysis.answerBreakdown)
    ? props.analysis.answerBreakdown as AnswerItem[]
    : null,
)

const recommendationLabel = computed(() =>
  props.analysis.recommendation ? (recommendationLabels[props.analysis.recommendation] ?? props.analysis.recommendation) : null,
)

const extractionModeLabel = computed(() =>
  props.analysis.extractionMode ? (extractionModeLabels[props.analysis.extractionMode] ?? props.analysis.extractionMode) : null,
)

function scoreColor(score: number, max: number): string {
  const pct = max > 0 ? (score / max) * 100 : 0
  if (pct >= 75) return 'text-success-600 dark:text-success-400'
  if (pct >= 40) return 'text-warning-600 dark:text-warning-400'
  return 'text-danger-600 dark:text-danger-400'
}

function barColor(score: number, max: number): string {
  const pct = max > 0 ? (score / max) * 100 : 0
  if (pct >= 75) return 'bg-success-500'
  if (pct >= 40) return 'bg-warning-500'
  return 'bg-danger-500'
}

function confidenceLabel(confidence: number): string {
  if (confidence >= 80) return 'High'
  if (confidence >= 50) return 'Medium'
  return 'Low'
}

function confidenceColor(confidence: number): string {
  if (confidence >= 80) return 'text-success-600 dark:text-success-400'
  if (confidence >= 50) return 'text-warning-600 dark:text-warning-400'
  return 'text-danger-600 dark:text-danger-400'
}

// Expand state — sections and per-answer entries expand independently, keyed
// by index (mirrors ScoreBreakdown.vue's single-expanded-criterion pattern,
// extended to allow either list item to toggle open on its own).
const expandedSection = ref<number | null>(null)
const expandedAnswer = ref<number | null>(null)

function toggleSection(i: number) {
  expandedSection.value = expandedSection.value === i ? null : i
}

function toggleAnswer(i: number) {
  expandedAnswer.value = expandedAnswer.value === i ? null : i
}
</script>

<template>
  <div class="mt-2.5 pt-2.5 border-t border-surface-100 dark:border-surface-800 space-y-3">
    <!-- Advisory banner -->
    <div class="rounded-lg border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-950/40 p-3">
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span v-if="recommendationLabel" class="text-surface-500 dark:text-surface-400">
          AI recommends:
          <span class="font-semibold text-surface-800 dark:text-surface-100">{{ recommendationLabel }}</span>
        </span>
        <span v-if="analysis.confidence !== null" class="text-surface-500 dark:text-surface-400">
          Confidence:
          <span class="font-semibold" :class="confidenceColor(analysis.confidence)">
            {{ confidenceLabel(analysis.confidence) }} ({{ analysis.confidence }}%)
          </span>
        </span>
      </div>
      <p class="mt-1.5 text-[11px] text-surface-500 dark:text-surface-400 flex items-start gap-1.5">
        <Info class="size-3.5 shrink-0 mt-0.5" />
        <span>This recommendation is AI-generated advice — the decision is yours. Screening status is never changed automatically.</span>
      </p>
    </div>

    <!-- Truncation notice -->
    <div
      v-if="truncated"
      class="rounded-lg border border-warning-200 dark:border-warning-800 bg-warning-50 dark:bg-warning-950/40 p-2.5 text-xs text-warning-700 dark:text-warning-400 flex items-start gap-2"
    >
      <AlertTriangle class="size-3.5 shrink-0 mt-0.5" />
      <span>This transcript was truncated to fit the analysis length limit — later portions of the call may not be reflected in this assessment.</span>
    </div>

    <!-- Extraction mode label — always shown so a degraded run is never silently presented as the richer mode -->
    <div v-if="extractionModeLabel" class="flex items-center gap-1.5 text-[11px] text-surface-400">
      <ClipboardList class="size-3.5 shrink-0" />
      <span v-if="analysis.extractionMode === 'per_answer'">{{ extractionModeLabel }}</span>
      <span v-else>Topic-level assessment — per-answer pairing was not reliable for this transcript</span>
    </div>

    <!-- Section scores -->
    <div v-if="sectionScores.length" class="space-y-1.5">
      <h4 class="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">Section scores</h4>
      <div
        v-for="(s, i) in sectionScores"
        :key="s.section"
        class="rounded-lg border border-surface-200/80 dark:border-surface-800/60 bg-white dark:bg-surface-900"
      >
        <button
          type="button"
          class="w-full flex items-center gap-3 p-2.5 text-left cursor-pointer"
          @click="toggleSection(i)"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2 mb-1">
              <span class="text-xs font-medium text-surface-700 dark:text-surface-200 truncate">{{ s.section }}</span>
              <span class="text-xs font-semibold tabular-nums shrink-0" :class="scoreColor(s.score, s.maxScore)">
                {{ s.score }}/{{ s.maxScore }}
              </span>
            </div>
            <div class="h-1.5 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all"
                :class="barColor(s.score, s.maxScore)"
                :style="{ width: `${s.maxScore > 0 ? (s.score / s.maxScore) * 100 : 0}%` }"
              />
            </div>
          </div>
          <component
            :is="expandedSection === i ? ChevronUp : ChevronDown"
            class="size-4 text-surface-400 shrink-0"
          />
        </button>
        <div v-if="expandedSection === i" class="px-2.5 pb-2.5 space-y-2 border-t border-surface-100 dark:border-surface-800 pt-2">
          <div v-if="s.summary">
            <h5 class="text-[10px] font-semibold text-surface-500 dark:text-surface-400 mb-0.5 uppercase tracking-wider">Summary</h5>
            <p class="text-xs text-surface-600 dark:text-surface-300 leading-relaxed">{{ s.summary }}</p>
          </div>
          <div v-if="s.evidence">
            <h5 class="text-[10px] font-semibold text-surface-500 dark:text-surface-400 mb-0.5 uppercase tracking-wider">Evidence</h5>
            <p class="text-xs text-surface-600 dark:text-surface-300 leading-relaxed">{{ s.evidence }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Per-answer accordion (per_answer mode only) -->
    <div v-if="answerBreakdown?.length" class="space-y-1.5">
      <h4 class="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">Per-answer breakdown</h4>
      <div
        v-for="(a, i) in answerBreakdown"
        :key="i"
        class="rounded-lg border border-surface-200/80 dark:border-surface-800/60 bg-white dark:bg-surface-900"
      >
        <button
          type="button"
          class="w-full flex items-center gap-3 p-2.5 text-left cursor-pointer"
          @click="toggleAnswer(i)"
        >
          <div class="flex-1 min-w-0">
            <p class="text-xs font-medium text-surface-700 dark:text-surface-200 truncate">{{ a.question }}</p>
            <div class="mt-1 flex items-center gap-3 text-[11px]">
              <span class="font-semibold tabular-nums" :class="scoreColor(a.score, 10)">{{ a.score }}/10</span>
              <span class="font-semibold" :class="confidenceColor(a.confidence)">
                {{ confidenceLabel(a.confidence) }} confidence ({{ a.confidence }}%)
              </span>
            </div>
          </div>
          <component
            :is="expandedAnswer === i ? ChevronUp : ChevronDown"
            class="size-4 text-surface-400 shrink-0"
          />
        </button>
        <div v-if="expandedAnswer === i" class="px-2.5 pb-2.5 space-y-2 border-t border-surface-100 dark:border-surface-800 pt-2">
          <div v-if="a.answer">
            <h5 class="text-[10px] font-semibold text-surface-500 dark:text-surface-400 mb-0.5 uppercase tracking-wider">Answer</h5>
            <p class="text-xs text-surface-600 dark:text-surface-300 leading-relaxed">{{ a.answer }}</p>
          </div>
          <div v-if="a.evidence">
            <h5 class="text-[10px] font-semibold text-surface-500 dark:text-surface-400 mb-0.5 uppercase tracking-wider">Quoted evidence</h5>
            <p class="text-xs text-surface-600 dark:text-surface-300 leading-relaxed italic">&ldquo;{{ a.evidence }}&rdquo;</p>
          </div>
          <div v-if="a.strengths?.length">
            <h5 class="text-[10px] font-semibold text-success-600 dark:text-success-400 mb-0.5">Strengths</h5>
            <ul class="space-y-0.5">
              <li v-for="s in a.strengths" :key="s" class="text-xs text-surface-600 dark:text-surface-300 flex items-start gap-1.5">
                <span class="text-success-500 mt-0.5 shrink-0">✓</span>
                {{ s }}
              </li>
            </ul>
          </div>
          <div v-if="a.gaps?.length">
            <h5 class="text-[10px] font-semibold text-warning-600 dark:text-warning-400 mb-0.5">Gaps</h5>
            <ul class="space-y-0.5">
              <li v-for="g in a.gaps" :key="g" class="text-xs text-surface-600 dark:text-surface-300 flex items-start gap-1.5">
                <span class="text-warning-500 mt-0.5 shrink-0">△</span>
                {{ g }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- Rationale -->
    <div v-if="analysis.rationale">
      <h4 class="text-xs font-semibold text-surface-500 dark:text-surface-400 mb-1 uppercase tracking-wider">Rationale</h4>
      <p class="text-xs text-surface-600 dark:text-surface-300 leading-relaxed">{{ analysis.rationale }}</p>
    </div>
  </div>
</template>
