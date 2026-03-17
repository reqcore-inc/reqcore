import { eq, and } from 'drizzle-orm'
import { aiConfig, job } from '../../../../database/schema'
import { generateCriteriaSchema } from '../../../../utils/schemas/scoring'
import { generateCriteriaFromDescription, PREMADE_CRITERIA } from '../../../../utils/ai/scoring'
import { z } from 'zod'

const paramsSchema = z.object({ id: z.string().min(1) })

/**
 * POST /api/jobs/:id/criteria/generate
 * Generate scoring criteria from a pre-made template or by AI analysis of the job description.
 * Does NOT persist — returns generated criteria for the client to review before saving.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { scoring: ['create'] })
  const orgId = session.session.activeOrganizationId
  const { id: jobId } = await getValidatedRouterParams(event, paramsSchema.parse)
  const body = await readValidatedBody(event, generateCriteriaSchema.parse)

  // Verify job belongs to org
  const jobRecord = await db.query.job.findFirst({
    where: and(eq(job.id, jobId), eq(job.organizationId, orgId)),
    columns: { id: true, title: true, description: true },
  })
  if (!jobRecord) {
    throw createError({ statusCode: 404, statusMessage: 'Job not found' })
  }

  // If a pre-made template is specified, return it directly
  if (body.template) {
    const template = PREMADE_CRITERIA[body.template]
    if (!template) {
      throw createError({ statusCode: 400, statusMessage: 'Unknown template' })
    }
    return { criteria: template, source: 'template' }
  }

  // Otherwise generate from job description using AI
  if (!jobRecord.description) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Job description is required to generate AI criteria. Add a description first.',
    })
  }

  const config = await db.query.aiConfig.findFirst({
    where: eq(aiConfig.organizationId, orgId),
  })
  if (!config) {
    throw createError({
      statusCode: 422,
      statusMessage: 'AI provider not configured. Set up your AI provider in Settings first.',
    })
  }

  const criteria = await generateCriteriaFromDescription(
    {
      provider: config.provider as 'openai' | 'anthropic' | 'openai_compatible',
      model: config.model,
      apiKeyEncrypted: config.apiKeyEncrypted,
      baseUrl: config.baseUrl,
      maxTokens: config.maxTokens,
    },
    jobRecord.title,
    jobRecord.description,
  )

  return { criteria, source: 'ai' }
})
