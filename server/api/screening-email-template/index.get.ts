import { SCREENING_TEMPLATE_VARIABLES } from '~~/shared/screening-template'
import { getScreeningEmailTemplateForUser } from '../../utils/screeningEmailTemplate'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const orgId = session.session.activeOrganizationId
  const userId = session.user.id

  const template = await getScreeningEmailTemplateForUser(orgId, userId)

  return {
    ...template,
    variables: SCREENING_TEMPLATE_VARIABLES,
  }
})
