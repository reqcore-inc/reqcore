import { defineTask } from 'nitropack/runtime/internal/task'
import { cleanupOldDocuments } from '../utils/cleanup-old-documents'

// Define and export a Nitro server task for scheduled or manual execution
export default defineTask({
  meta: {
    name: 'cleanup-old-documents',
    description: 'GDPR cleanup of expired documents',
  },
  async run({ payload, context }) {
    const result = await cleanupOldDocuments()

    return {
      result: {
        success: true,
        deletedCount: result.deletedCount,
        errors: result.errors,
        timestamp: new Date().toISOString(),
      },
    }
  },
})
