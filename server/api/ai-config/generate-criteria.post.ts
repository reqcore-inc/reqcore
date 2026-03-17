import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { aiConfig } from '../../database/schema'
import { generateCriteriaFromDescription } from '../../utils/ai/scoring'

const bodySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(50000),
})

/**
 * POST /api/ai-config/generate-criteria
 * Generate scoring criteria from a job title + description using AI.
 * Does NOT require a saved job — used during job creation flow.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { scoring: ['create'] })
  const orgId = session.session.activeOrganizationId

  const body = await readValidatedBody(event, bodySchema.parse)

  const config = await db.query.aiConfig.findFirst({
    where: eq(aiConfig.organizationId, orgId),
  })
  if (!config) {
    throw createError({
      statusCode: 422,
      statusMessage: 'AI provider not configured. Set up your AI provider in Settings → AI first.',
    })
  }

  const criteria = await generateCriteriaFromDescription(
    {
      provider: config.provider as 'openai' | 'anthropic' | 'google' | 'openai_compatible',
      model: config.model,
      apiKeyEncrypted: config.apiKeyEncrypted,
      baseUrl: config.baseUrl,
      maxTokens: config.maxTokens,
    },
    body.title,
    body.description,
  )

  return { criteria, source: 'ai' }
})
