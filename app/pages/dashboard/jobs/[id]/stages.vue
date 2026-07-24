<script setup lang="ts">
import { Plus, Trash2, ChevronUp, ChevronDown, Flag, AlertTriangle } from 'lucide-vue-next'
import {
  STAGE_CATEGORIES,
  STAGE_CATEGORY_META,
  STAGE_COLOR_TOKENS,
  stageColorClasses,
  type StageCategory,
  type StageColor,
} from '~~/shared/pipeline'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'require-org'],
})

const route = useRoute()
const jobId = route.params.id as string
const toast = useToast()
const { handlePreviewReadOnlyError } = usePreviewReadOnly()

const { job } = useJob(jobId)
const {
  stages, status, error, refresh,
  createStage, updateStage, deleteStage, reorderStages,
} = useJobStages(jobId)

useSeoMeta({
  title: computed(() => job.value ? `Stages — ${job.value.title} — Reqcore` : 'Stages — Reqcore'),
})

const busy = ref(false)

// ─────────────────────────────────────────────
// Add a stage
// ─────────────────────────────────────────────

const newName = ref('')
const newColor = ref<StageColor>('violet')
const newCategory = ref<StageCategory>('in_progress')

async function onAdd() {
  const name = newName.value.trim()
  if (!name || busy.value) return
  busy.value = true
  try {
    await createStage({ name, color: newColor.value, category: newCategory.value })
    newName.value = ''
    toast.success('Stage added', `"${name}" is now part of this job's pipeline.`)
  } catch (err: any) {
    if (handlePreviewReadOnlyError(err)) return
    toast.error('Failed to add stage', { message: err.data?.statusMessage, statusCode: err.data?.statusCode })
  } finally {
    busy.value = false
  }
}

// ─────────────────────────────────────────────
// Edit / delete / reorder
// ─────────────────────────────────────────────

async function patch(stageId: string, payload: Parameters<typeof updateStage>[1], successMsg?: string) {
  if (busy.value) return
  busy.value = true
  try {
    await updateStage(stageId, payload)
    if (successMsg) toast.success(successMsg)
  } catch (err: any) {
    if (handlePreviewReadOnlyError(err)) return
    toast.error('Failed to update stage', { message: err.data?.statusMessage, statusCode: err.data?.statusCode })
    await refresh()
  } finally {
    busy.value = false
  }
}

function setEntry(stageId: string, name: string) {
  patch(stageId, { isEntry: true }, `New applicants now land in ${name}.`)
}

function onRename(stageId: string, event: Event) {
  const value = (event.target as HTMLInputElement).value.trim()
  const current = stages.value.find(s => s.id === stageId)
  if (!value || !current || value === current.name) return
  patch(stageId, { name: value })
}

async function onDelete(stageId: string) {
  const stage = stages.value.find(s => s.id === stageId)
  if (!stage || busy.value) return
  if (!confirm(`Delete the "${stage.name}" stage? Automation rules targeting it will be removed too.`)) return
  busy.value = true
  try {
    const res: any = await deleteStage(stageId)
    toast.success(
      'Stage deleted',
      res?.removedRules ? `${res.removedRules} automation rule(s) removed with it.` : undefined,
    )
  } catch (err: any) {
    if (handlePreviewReadOnlyError(err)) return
    toast.error('Cannot delete stage', { message: err.data?.statusMessage, statusCode: err.data?.statusCode })
  } finally {
    busy.value = false
  }
}

async function move(index: number, dir: -1 | 1) {
  const target = index + dir
  if (target < 0 || target >= stages.value.length || busy.value) return
  const reordered = [...stages.value]
  const [item] = reordered.splice(index, 1)
  reordered.splice(target, 0, item!)
  busy.value = true
  try {
    await reorderStages(reordered.map((s, i) => ({ id: s.id, displayOrder: i })))
  } catch (err: any) {
    if (handlePreviewReadOnlyError(err)) return
    toast.error('Failed to reorder stages', { message: err.data?.statusMessage })
  } finally {
    busy.value = false
  }
}

// ─────────────────────────────────────────────
// Guidance
// ─────────────────────────────────────────────

const hasHired = computed(() => stages.value.some(s => s.category === 'hired'))
const hasRejected = computed(() => stages.value.some(s => s.category === 'rejected'))

const inputClass = 'rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 px-3 py-1.5 text-sm text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500'
const selectClass = inputClass
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <JobSubNavActions :job-id="jobId" />

    <div v-if="status === 'pending'" class="text-center py-12 text-surface-400">
      Loading…
    </div>

    <div
      v-else-if="error"
      class="rounded-lg border border-danger-200 dark:border-danger-800 bg-danger-50 dark:bg-danger-950 p-4 text-sm text-danger-700 dark:text-danger-400"
    >
      Failed to load pipeline stages.
    </div>

    <div v-else class="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900">
      <!-- Header -->
      <div class="px-4 py-3 border-b border-surface-100 dark:border-surface-800">
        <h2 class="text-sm font-semibold text-surface-900 dark:text-surface-100">Pipeline stages</h2>
        <p class="mt-1 text-xs text-surface-500 dark:text-surface-400">
          The statuses applicants move through for this job. Rename, recolour, reorder or add your own.
          Each stage has a <span class="font-medium">role</span> that drives reporting — new applicants land in the
          <span class="font-medium">entry</span> stage, and <span class="font-medium">Hired</span>/<span class="font-medium">Rejected</span>
          roles feed your hire and rejection numbers.
        </p>
      </div>

      <!-- Stage list -->
      <ul class="divide-y divide-surface-100 dark:divide-surface-800">
        <li
          v-for="(stage, index) in stages"
          :key="stage.id"
          class="flex flex-wrap items-center gap-2 px-4 py-3"
        >
          <!-- Reorder -->
          <div class="flex flex-col">
            <button
              class="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 disabled:opacity-30"
              :disabled="index === 0 || busy"
              title="Move up"
              @click="move(index, -1)"
            >
              <ChevronUp class="size-4" />
            </button>
            <button
              class="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 disabled:opacity-30"
              :disabled="index === stages.length - 1 || busy"
              title="Move down"
              @click="move(index, 1)"
            >
              <ChevronDown class="size-4" />
            </button>
          </div>

          <!-- Colour swatch -->
          <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold" :class="stageColorClasses(stage.color).badge">
            {{ stage.name }}
          </span>

          <!-- Name -->
          <input
            :value="stage.name"
            :class="inputClass"
            class="w-40"
            maxlength="60"
            :disabled="busy"
            @change="onRename(stage.id, $event)"
          >

          <!-- Colour -->
          <select
            :value="stage.color"
            :class="selectClass"
            :disabled="busy"
            @change="patch(stage.id, { color: ($event.target as HTMLSelectElement).value as StageColor })"
          >
            <option v-for="c in STAGE_COLOR_TOKENS" :key="c" :value="c">{{ c }}</option>
          </select>

          <!-- Role / category -->
          <select
            :value="stage.category"
            :class="selectClass"
            :disabled="busy"
            title="What this stage means for reporting"
            @change="patch(stage.id, { category: ($event.target as HTMLSelectElement).value as StageCategory })"
          >
            <option v-for="c in STAGE_CATEGORIES" :key="c" :value="c">{{ STAGE_CATEGORY_META[c].label }}</option>
          </select>

          <div class="flex-1" />

          <!-- Entry flag -->
          <button
            class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors"
            :class="stage.isEntry
              ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300'
              : 'text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800'"
            :disabled="stage.isEntry || busy"
            :title="stage.isEntry ? 'New applicants land here' : 'Make this the entry stage'"
            @click="setEntry(stage.id, stage.name)"
          >
            <Flag class="size-3.5" />
            {{ stage.isEntry ? 'Entry' : 'Set entry' }}
          </button>

          <!-- Delete -->
          <button
            class="text-surface-400 hover:text-danger-600 dark:hover:text-danger-400 disabled:opacity-30"
            :disabled="busy || stage.isEntry || stages.length <= 1"
            :title="stage.isEntry ? 'The entry stage cannot be deleted' : 'Delete stage'"
            @click="onDelete(stage.id)"
          >
            <Trash2 class="size-4" />
          </button>
        </li>
      </ul>

      <!-- Warnings -->
      <div
        v-if="!hasHired || !hasRejected"
        class="flex items-start gap-2 px-4 py-3 border-t border-surface-100 dark:border-surface-800 text-xs text-warning-600 dark:text-warning-400"
      >
        <AlertTriangle class="size-4 shrink-0 mt-0.5" />
        <span>
          This pipeline has no
          <template v-if="!hasHired">stage with the <strong>Hired</strong> role</template>
          <template v-if="!hasHired && !hasRejected"> and no </template>
          <template v-if="!hasRejected">stage with the <strong>Rejected</strong> role</template>.
          Those roles feed your dashboard hire/rejection counts, so the numbers will read zero until you assign them.
        </span>
      </div>

      <!-- Add stage -->
      <div class="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-surface-100 dark:border-surface-800">
        <input
          v-model="newName"
          :class="inputClass"
          class="w-44"
          maxlength="60"
          placeholder="New stage name"
          :disabled="busy"
          @keydown.enter="onAdd"
        >
        <select v-model="newColor" :class="selectClass" :disabled="busy">
          <option v-for="c in STAGE_COLOR_TOKENS" :key="c" :value="c">{{ c }}</option>
        </select>
        <select v-model="newCategory" :class="selectClass" :disabled="busy">
          <option v-for="c in STAGE_CATEGORIES" :key="c" :value="c">{{ STAGE_CATEGORY_META[c].label }}</option>
        </select>
        <button
          class="inline-flex items-center gap-1.5 rounded-lg border border-surface-300 dark:border-surface-600 px-3.5 py-2 text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors disabled:opacity-50"
          :disabled="!newName.trim() || busy"
          @click="onAdd"
        >
          <Plus class="size-4" /> Add stage
        </button>
      </div>
    </div>
  </div>
</template>
