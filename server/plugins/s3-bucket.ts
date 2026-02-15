/**
 * Ensures the S3 bucket exists and is configured with a private policy on startup.
 * Runs after migrations plugin. Idempotent — safe to run repeatedly.
 */
export default defineNitroPlugin(async () => {
  try {
    await ensureBucketExists()
    console.log(`[Applirank] S3 bucket "${S3_BUCKET}" is ready`)
  } catch (error) {
    console.error(`[Applirank] Failed to initialize S3 bucket "${S3_BUCKET}":`, error)
    // Don't throw — the app can still start, but uploads will fail.
    // This allows the app to boot even if MinIO is temporarily unavailable.
  }
})
