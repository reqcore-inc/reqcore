import type { MaybeRefOrGetter } from 'vue'
import {
  stageColorClasses,
  type PipelineStage,
  type StageCategory,
  type StageColor,
} from '~~/shared/pipeline'

/**
 * The custom pipeline stages of a job, plus helpers to resolve a stage id to its
 * name/colour classes. Replaces the old hard-coded status maps — every status
 * label and colour in the UI comes from here.
 */
export function useJobStages(jobId: MaybeRefOrGetter<string>) {
  const { handlePreviewReadOnlyError } = usePreviewReadOnly()
  const id = computed(() => toValue(jobId))

  const stagesAsync = useFetch(
    () => `/api/jobs/${id.value}/stages`,
    {
      key: computed(() => `job-stages-${id.value}`),
      headers: useRequestHeaders(['cookie']),
    },
  )
  const { data, status, error, refresh } = stagesAsync

  const stages = computed<PipelineStage[]>(() => (data.value?.stages ?? []) as PipelineStage[])

  const stageById = computed(() => new Map(stages.value.map(s => [s.id, s])))

  /** The stage new applications land in. */
  const entryStage = computed(() => stages.value.find(s => s.isEntry) ?? stages.value[0])

  function stageName(stageId: string | null | undefined): string {
    if (!stageId) return 'Unknown'
    return stageById.value.get(stageId)?.name ?? 'Unknown'
  }

  function stageBadgeClass(stageId: string | null | undefined): string {
    return stageColorClasses(stageById.value.get(stageId ?? '')?.color).badge
  }

  function stageDotClass(stageId: string | null | undefined): string {
    return stageColorClasses(stageById.value.get(stageId ?? '')?.color).dot
  }

  // ── Mutations ──────────────────────────────────────────────────
  async function createStage(payload: { name: string, color: StageColor, category: StageCategory }) {
    try {
      const created = await $fetch(`/api/jobs/${id.value}/stages`, { method: 'POST', body: payload })
      await refresh()
      return created
    } catch (err) {
      handlePreviewReadOnlyError(err)
      throw err
    }
  }

  async function updateStage(stageId: string, payload: Partial<{
    name: string
    color: StageColor
    category: StageCategory
    isEntry: true
  }>) {
    try {
      const updated = await $fetch(`/api/jobs/${id.value}/stages/${stageId}`, { method: 'PATCH', body: payload })
      await refresh()
      return updated
    } catch (err) {
      handlePreviewReadOnlyError(err)
      throw err
    }
  }

  async function deleteStage(stageId: string) {
    try {
      const result = await $fetch(`/api/jobs/${id.value}/stages/${stageId}`, { method: 'DELETE' })
      await refresh()
      return result
    } catch (err) {
      handlePreviewReadOnlyError(err)
      throw err
    }
  }

  async function reorderStages(order: { id: string, displayOrder: number }[]) {
    try {
      await $fetch(`/api/jobs/${id.value}/stages/reorder`, { method: 'PUT', body: { order } })
      await refresh()
    } catch (err) {
      handlePreviewReadOnlyError(err)
      throw err
    }
  }

  return {
    /**
     * The underlying fetch, awaitable in setup. Await this before creating any
     * other fetch whose query depends on a stage id — otherwise that query is
     * first evaluated with no stages loaded, changes when they arrive, and is
     * left re-fetching (i.e. `pending`) in the SSR render.
     */
    ready: stagesAsync,
    stages,
    stageById,
    entryStage,
    stageName,
    stageBadgeClass,
    stageDotClass,
    status,
    error,
    refresh,
    createStage,
    updateStage,
    deleteStage,
    reorderStages,
  }
}
