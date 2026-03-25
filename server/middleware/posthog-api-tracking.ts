/**
 * Server middleware: captures API errors and slow requests to PostHog.
 *
 * - Tracks every 4xx/5xx API response as 'api error' with status code
 * - Tracks requests slower than 3s as 'api slow_request'
 * - Skips static assets and non-API routes
 *
 * This gives per-user visibility into which API calls fail and which are slow,
 * making debugging straightforward in PostHog's person timeline.
 */
export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  // Only track API routes — skip static assets, ingest proxy, etc.
  if (!path.startsWith('/api/')) return

  const start = Date.now()

  event.node.res.on('finish', () => {
    try {
      const duration = Date.now() - start
      const statusCode = event.node.res.statusCode

      // Track API errors (4xx client errors, 5xx server errors)
      if (statusCode >= 400) {
        trackApiError(event, statusCode, { duration_ms: duration })
      }

      // Track slow requests (>3s threshold)
      if (duration > 3000) {
        trackApiError(event, statusCode, {
          duration_ms: duration,
          slow_request: true,
        })
      }
    }
    catch {
      // Tracking must never break the response
    }
  })
})
