import { updateScreeningEmailTemplateSchema } from '../../utils/schemas/screeningEmailTemplate'
import { upsertScreeningEmailTemplate } from '../../utils/screeningEmailTemplate'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const orgId = session.session.activeOrganizationId
  const userId = session.user.id

  const body = await readValidatedBody(event, updateScreeningEmailTemplateSchema.parse)

  const result = await upsertScreeningEmailTemplate({
    organizationId: orgId,
    userId,
    subject: body.subject,
    body: body.body,
  })

  return { ...result, isDefault: false }
})
