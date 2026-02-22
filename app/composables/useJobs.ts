import type { Ref } from 'vue'

/**
 * Composable for managing the jobs list with filtering, pagination, and mutations.
 * Wraps `useFetch('/api/jobs')` with a singleton key for shared state.
 */
export function useJobs(options?: {
  status?: Ref<string | undefined> | string
}) {
  const { withPreviewReadOnly } = usePreviewReadOnly()

  const query = computed(() => ({
    ...(toValue(options?.status) && { status: toValue(options?.status) }),
  }))

  const { data, status: fetchStatus, error, refresh } = useFetch('/api/jobs', {
    key: 'jobs',
    query,
    headers: useRequestHeaders(['cookie']),
  })

  const jobs = computed(() => data.value?.data ?? [])
  const total = computed(() => data.value?.total ?? 0)

  /** Create a new job and refresh the list */
  async function createJob(payload: {
    title: string
    description?: string
    location?: string
    type?: 'full_time' | 'part_time' | 'contract' | 'internship'
  }) {
    const created = await withPreviewReadOnly(() =>
      $fetch('/api/jobs', {
        method: 'POST',
        body: payload,
      }),
    )
    await refresh()
    return created
  }

  /** Delete a job by ID and refresh the list */
  async function deleteJob(id: string) {
    await withPreviewReadOnly(() => $fetch(`/api/jobs/${id}`, { method: 'DELETE' }))
    await refresh()
  }

  return {
    jobs,
    total,
    fetchStatus,
    error,
    refresh,
    createJob,
    deleteJob,
  }
}
