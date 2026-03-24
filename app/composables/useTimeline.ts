/**
 * Composable for the Timeline page — fetches and manages paginated
 * activity-log entries with cursor-based infinite scroll.
 */

export interface TimelineItem {
  id: string
  action: string
  resourceType: string
  resourceId: string
  metadata: Record<string, unknown> | null
  createdAt: string
  actorId: string
  actorName: string | null
  actorEmail: string | null
  actorImage: string | null
  resourceName: string | null
  resourceUrl: string | null
  isUpcoming?: boolean
  candidateId?: string
  jobId?: string
}

export interface TimelineDayGroup {
  date: string
  label: string
  isToday: boolean
  isFuture: boolean
  items: TimelineItem[]
}

export function useTimeline() {
  const items = ref<TimelineItem[]>([])
  const upcoming = ref<TimelineItem[]>([])
  const isLoading = ref(false)
  const isLoadingMore = ref(false)
  const hasMore = ref(true)
  const oldestTimestamp = ref<string | null>(null)
  const error = ref<string | null>(null)
  const activeFilter = ref<string | undefined>(undefined)

  /**
   * Load initial timeline data.
   */
  async function loadInitial(resourceType?: string) {
    isLoading.value = true
    error.value = null
    activeFilter.value = resourceType

    try {
      const query: Record<string, string | number> = { limit: 100 }
      if (resourceType) query.resourceType = resourceType

      const result = await $fetch('/api/activity-log/timeline', { query }) as {
        items: TimelineItem[]
        upcoming: TimelineItem[]
        hasMore: boolean
        oldestTimestamp: string | null
        newestTimestamp: string | null
      }

      items.value = result.items
      upcoming.value = result.upcoming
      hasMore.value = result.hasMore
      oldestTimestamp.value = result.oldestTimestamp
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load timeline'
      console.error('[Timeline] Failed to load:', err)
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Load more (older) entries for infinite scroll.
   */
  async function loadMore() {
    if (isLoadingMore.value || !hasMore.value || !oldestTimestamp.value) return

    isLoadingMore.value = true

    try {
      const query: Record<string, string | number> = {
        before: oldestTimestamp.value,
        limit: 100,
      }
      if (activeFilter.value) query.resourceType = activeFilter.value

      const result = await $fetch('/api/activity-log/timeline', { query }) as {
        items: TimelineItem[]
        upcoming: TimelineItem[]
        hasMore: boolean
        oldestTimestamp: string | null
        newestTimestamp: string | null
      }

      items.value.push(...result.items)
      hasMore.value = result.hasMore
      oldestTimestamp.value = result.oldestTimestamp
    }
    catch (err) {
      console.error('[Timeline] Failed to load more:', err)
    }
    finally {
      isLoadingMore.value = false
    }
  }

  /**
   * Group timeline items by day, including upcoming events.
   */
  const dayGroups = computed<TimelineDayGroup[]>(() => {
    const now = new Date()
    const todayStr = formatDateKey(now)

    // Combine upcoming + past items
    const allItems = [...upcoming.value, ...items.value]

    // Group by date
    const groupMap = new Map<string, TimelineItem[]>()
    for (const item of allItems) {
      const dateKey = item.createdAt.slice(0, 10)
      if (!groupMap.has(dateKey)) {
        groupMap.set(dateKey, [])
      }
      groupMap.get(dateKey)!.push(item)
    }

    // Sort dates descending (newest → oldest) but future dates first
    const sortedDates = Array.from(groupMap.keys()).sort((a, b) => {
      const aFuture = a > todayStr
      const bFuture = b > todayStr

      // Future dates at top, sorted ascending (soonest first)
      if (aFuture && bFuture) return a.localeCompare(b)
      if (aFuture) return -1
      if (bFuture) return 1

      // Past dates sorted descending (most recent first)
      return b.localeCompare(a)
    })

    return sortedDates.map(date => ({
      date,
      label: formatDayLabel(date, todayStr),
      isToday: date === todayStr,
      isFuture: date > todayStr,
      items: groupMap.get(date)!.sort((a, b) => {
        // Within each day, sort by time descending
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }),
    }))
  })

  /**
   * Get total event count.
   */
  const totalEvents = computed(() => items.value.length + upcoming.value.length)

  return {
    items,
    upcoming,
    dayGroups,
    totalEvents,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    activeFilter,
    loadInitial,
    loadMore,
  }
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDayLabel(dateStr: string, todayStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const today = new Date(todayStr + 'T00:00:00')
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86400000)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`
  if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  })
}
