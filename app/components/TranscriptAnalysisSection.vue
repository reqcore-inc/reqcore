<script setup lang="ts">
import {
  Upload, FileText, ClipboardPaste, Trash2, Sparkles, Loader2,
  AlertTriangle, MessageSquare,
} from 'lucide-vue-next'

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

interface Transcript {
  id: string
  sourceType: 'upload' | 'paste'
  truncated: boolean
  createdAt: string
  documentId: string | null
  originalFilename: string | null
  analyses: TranscriptAnalysis[]
}

const props = defineProps<{
  applicationId: string
}>()

const toast = useToast()

// ─────────────────────────────────────────────
// Transcript list
// ─────────────────────────────────────────────

const { data: transcripts, status: listStatus, refresh } = useFetch<Transcript[]>(
  () => `/api/applications/${props.applicationId}/transcript`,
  {
    key: computed(() => `transcript-list-${props.applicationId}`),
    headers: useRequestHeaders(['cookie']),
    watch: [() => props.applicationId],
    default: () => [],
  },
)

const isLoadingList = computed(() => listStatus.value === 'pending' && !transcripts.value?.length)

// ─────────────────────────────────────────────
// Upload / paste mode toggle
// ─────────────────────────────────────────────

const activeMode = ref<'upload' | 'paste'>('upload')

// ─────────────────────────────────────────────
// Upload
// ─────────────────────────────────────────────

const fileInput = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)
const uploadError = ref<string | null>(null)
const MAX_UPLOAD_SIZE_MB = 10

function triggerFileSelect() {
  fileInput.value?.click()
}

async function handleFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  uploadError.value = null

  // Client-side size hint only — the server is the authority on limits.
  if (file.size > MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
    uploadError.value = `File too large. Maximum size is ${MAX_UPLOAD_SIZE_MB} MB`
    input.value = ''
    return
  }

  isUploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    await $fetch(`/api/applications/${props.applicationId}/transcript/upload`, {
      method: 'POST',
      headers: useRequestHeaders(['cookie']),
      body: formData,
    })
    await refresh()
  } catch (err: any) {
    uploadError.value = err?.data?.statusMessage ?? 'Upload failed'
  } finally {
    isUploading.value = false
    input.value = ''
  }
}

// ─────────────────────────────────────────────
// Paste
// ─────────────────────────────────────────────

const MAX_PASTE_LENGTH = 200_000
const pasteText = ref('')
const isSubmittingPaste = ref(false)
const pasteError = ref<string | null>(null)

const pasteCharCount = computed(() => pasteText.value.length)
const isPasteTooLong = computed(() => pasteCharCount.value > MAX_PASTE_LENGTH)

async function submitPaste() {
  if (!pasteText.value.trim() || isPasteTooLong.value) return

  pasteError.value = null
  isSubmittingPaste.value = true
  try {
    await $fetch(`/api/applications/${props.applicationId}/transcript`, {
      method: 'POST',
      headers: useRequestHeaders(['cookie']),
      body: { text: pasteText.value },
    })
    pasteText.value = ''
    await refresh()
  } catch (err: any) {
    pasteError.value = err?.data?.statusMessage ?? 'Failed to save transcript'
  } finally {
    isSubmittingPaste.value = false
  }
}

// ─────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────

const showDeleteConfirm = ref<string | null>(null)
const isDeleting = ref(false)

async function handleDelete(transcriptId: string) {
  isDeleting.value = true
  try {
    await $fetch(`/api/applications/${props.applicationId}/transcript/${transcriptId}`, {
      method: 'DELETE',
      headers: useRequestHeaders(['cookie']),
    })
    showDeleteConfirm.value = null
    await refresh()
  } catch (err: any) {
    toast.error('Failed to delete transcript', { message: err?.data?.statusMessage, statusCode: err?.data?.statusCode })
  } finally {
    isDeleting.value = false
  }
}

// ─────────────────────────────────────────────
// Run analysis
// ─────────────────────────────────────────────

const runningTranscriptId = ref<string | null>(null)
// Error surfaced inline per-transcript so 429 budget copy / 409 quarantine /
// 400 validation messages are never swallowed (mirrors ScoreBreakdown.vue's
// `analyzeError` pattern for the scoring flow).
const runErrors = ref<Record<string, string>>({})

async function runAnalysis(transcriptId: string) {
  runningTranscriptId.value = transcriptId
  const nextErrors = { ...runErrors.value }
  delete nextErrors[transcriptId]
  runErrors.value = nextErrors
  try {
    await $fetch(`/api/applications/${props.applicationId}/transcript-analysis`, {
      method: 'POST',
      headers: useRequestHeaders(['cookie']),
      body: { transcriptId },
    })
    await refresh()
  } catch (err: any) {
    // Surface the server's message verbatim — budget (429), quarantine (409),
    // and validation (400) responses all carry the recruiter-facing copy in
    // `statusMessage`; do not replace it with a generic string.
    runErrors.value = {
      ...runErrors.value,
      [transcriptId]: err?.data?.statusMessage ?? 'Analysis failed. Please try again.',
    }
  } finally {
    runningTranscriptId.value = null
  }
}

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

function latestAnalysis(t: Transcript): TranscriptAnalysis | null {
  if (!t.analyses.length) return null
  return [...t.analyses].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0] ?? null
}
</script>

<template>
  <div class="rounded-xl border border-surface-200/80 dark:border-surface-800/60 bg-white dark:bg-surface-900 p-5 shadow-sm shadow-surface-900/[0.03] dark:shadow-none">
    <div class="flex items-center gap-2.5 mb-4">
      <div class="flex size-7 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-950/40">
        <MessageSquare class="size-3.5 text-brand-600 dark:text-brand-400" />
      </div>
      <h2 class="text-sm font-semibold text-surface-800 dark:text-surface-200">Screening Analysis</h2>
    </div>

    <!-- Segmented control -->
    <div class="mb-4 inline-flex rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 p-0.5">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
        :class="activeMode === 'upload'
          ? 'bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 shadow-sm'
          : 'text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200'"
        @click="activeMode = 'upload'"
      >
        <Upload class="size-3.5" />
        Upload file
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
        :class="activeMode === 'paste'
          ? 'bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 shadow-sm'
          : 'text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200'"
        @click="activeMode = 'paste'"
      >
        <ClipboardPaste class="size-3.5" />
        Paste text
      </button>
    </div>

    <!-- Upload panel -->
    <div v-if="activeMode === 'upload'" class="mb-4">
      <input
        ref="fileInput"
        type="file"
        accept=".pdf,.doc,.docx"
        class="hidden"
        @change="handleFileSelected"
      />
      <div class="flex items-center gap-3">
        <button
          type="button"
          :disabled="isUploading"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          @click="triggerFileSelect"
        >
          <Loader2 v-if="isUploading" class="size-3.5 animate-spin" />
          <Upload v-else class="size-3.5" />
          {{ isUploading ? 'Uploading…' : 'Choose file' }}
        </button>
        <span class="text-[11px] text-surface-400">PDF, DOC, or DOCX · up to {{ MAX_UPLOAD_SIZE_MB }} MB</span>
      </div>
      <p v-if="uploadError" class="mt-2 text-xs text-danger-600 dark:text-danger-400">{{ uploadError }}</p>
    </div>

    <!-- Paste panel -->
    <div v-else class="mb-4">
      <textarea
        v-model="pasteText"
        rows="6"
        placeholder="Paste the screening-call transcript here…"
        class="w-full rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
      />
      <div class="mt-1.5 flex items-center justify-between">
        <span
          class="text-[11px]"
          :class="isPasteTooLong ? 'text-danger-600 dark:text-danger-400' : 'text-surface-400'"
        >
          {{ pasteCharCount.toLocaleString() }} / {{ MAX_PASTE_LENGTH.toLocaleString() }} characters
        </span>
        <button
          type="button"
          :disabled="isSubmittingPaste || !pasteText.trim() || isPasteTooLong"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          @click="submitPaste"
        >
          <Loader2 v-if="isSubmittingPaste" class="size-3.5 animate-spin" />
          {{ isSubmittingPaste ? 'Saving…' : 'Save transcript' }}
        </button>
      </div>
      <p v-if="pasteError" class="mt-2 text-xs text-danger-600 dark:text-danger-400">{{ pasteError }}</p>
    </div>

    <!-- Transcript list -->
    <div class="border-t border-surface-100 dark:border-surface-800 pt-4">
      <div v-if="isLoadingList" class="text-center py-6 text-xs text-surface-400">
        Loading transcripts…
      </div>
      <div v-else-if="!transcripts?.length" class="text-center py-6 text-xs text-surface-400">
        No transcripts attached yet.
      </div>
      <div v-else class="space-y-2">
        <div
          v-for="t in transcripts"
          :key="t.id"
          class="rounded-xl border border-surface-200/80 dark:border-surface-800/60 bg-white dark:bg-surface-950 p-3"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <FileText class="size-4 shrink-0 text-surface-400" />
              <div class="min-w-0">
                <p class="text-sm font-medium text-surface-700 dark:text-surface-200 truncate">
                  {{ t.sourceType === 'upload' ? (t.originalFilename ?? 'Uploaded transcript') : 'Pasted transcript' }}
                </p>
                <span class="text-xs text-surface-400">
                  {{ t.sourceType === 'upload' ? 'Upload' : 'Paste' }}
                  · {{ new Date(t.createdAt).toLocaleDateString() }}
                  <template v-if="t.truncated">
                    · <span class="text-warning-500 dark:text-warning-400">Truncated (content limit reached)</span>
                  </template>
                </span>
              </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                :disabled="runningTranscriptId === t.id"
                class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                @click="runAnalysis(t.id)"
              >
                <Loader2 v-if="runningTranscriptId === t.id" class="size-3.5 animate-spin" />
                <Sparkles v-else class="size-3.5" />
                {{ runningTranscriptId === t.id ? 'Analyzing…' : 'Run analysis' }}
              </button>
              <button
                type="button"
                class="rounded-lg p-1.5 text-surface-400 hover:text-danger-600 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                title="Delete"
                @click="showDeleteConfirm = t.id"
              >
                <Trash2 class="size-4" />
              </button>
            </div>
          </div>

          <!-- Per-transcript run error (429 budget / 409 quarantine / 400 validation — verbatim server message) -->
          <div
            v-if="runErrors[t.id]"
            class="mt-2 rounded-lg border border-danger-200 dark:border-danger-800 bg-danger-50 dark:bg-danger-950 p-2.5 text-xs text-danger-700 dark:text-danger-400 flex items-start gap-2"
          >
            <AlertTriangle class="size-3.5 shrink-0 mt-0.5" />
            <span>{{ runErrors[t.id] }}</span>
          </div>

          <!-- Analysis results placeholder — TA4.2 owns the rich results view.
               Renders the raw recommendation + status minimally for now. -->
          <div
            v-if="latestAnalysis(t)"
            class="mt-2.5 pt-2.5 border-t border-surface-100 dark:border-surface-800 text-xs"
          >
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span class="text-surface-400">Status: <span class="text-surface-600 dark:text-surface-300 font-medium">{{ latestAnalysis(t)!.status }}</span></span>
              <span v-if="latestAnalysis(t)!.recommendation" class="text-surface-400">
                Recommendation:
                <span class="text-surface-600 dark:text-surface-300 font-medium">
                  {{ recommendationLabels[latestAnalysis(t)!.recommendation!] ?? latestAnalysis(t)!.recommendation }}
                </span>
              </span>
              <span v-if="latestAnalysis(t)!.extractionMode" class="text-surface-400">
                Mode:
                <span class="text-surface-600 dark:text-surface-300 font-medium">
                  {{ extractionModeLabels[latestAnalysis(t)!.extractionMode!] ?? latestAnalysis(t)!.extractionMode }}
                </span>
              </span>
            </div>
            <p class="mt-1 text-[11px] text-surface-400 italic">
              This is AI-generated advice — the recruiter makes the final decision.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete confirm -->
    <div v-if="showDeleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50" @click="showDeleteConfirm = null" />
      <div class="relative bg-white dark:bg-surface-900 rounded-2xl shadow-2xl shadow-surface-900/10 dark:shadow-black/30 ring-1 ring-surface-200/80 dark:ring-surface-700/60 p-6 max-w-sm w-full mx-4">
        <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-2">Delete Transcript</h3>
        <p class="text-sm text-surface-600 dark:text-surface-400 mb-4">
          Are you sure you want to delete this transcript? Any analysis results attached to it will also be removed. This action cannot be undone.
        </p>
        <div class="flex justify-end gap-2">
          <button
            :disabled="isDeleting"
            class="rounded-lg border border-surface-300 dark:border-surface-600 px-3 py-1.5 text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
            @click="showDeleteConfirm = null"
          >
            Cancel
          </button>
          <button
            :disabled="isDeleting"
            class="rounded-lg bg-danger-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-danger-700 disabled:opacity-50 transition-colors"
            @click="handleDelete(showDeleteConfirm!)"
          >
            {{ isDeleting ? 'Deleting…' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
