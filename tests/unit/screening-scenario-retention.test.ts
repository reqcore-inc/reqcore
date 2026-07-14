import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { application, screeningScenario } from '../../server/database/schema/app'

afterEach(() => vi.unstubAllGlobals())

describe('screeningScenario — GDPR candidate data graph coverage (task 1.7)', () => {
  describe('erasure cascade (candidate -> application -> screeningScenario)', () => {
    it('cascades screeningScenario.applicationId on delete, so erasing an application (which candidate erasure already does) erases its scenarios without erasure.ts needing to enumerate the table explicitly', () => {
      const cfg = getTableConfig(screeningScenario)
      const applicationFk = cfg.foreignKeys.find(fk => fk.getName() === 'screening_scenario_application_id_application_id_fk')
      expect(applicationFk).toBeDefined()
      expect(applicationFk!.onDelete).toBe('cascade')
    })

    it('cascades application.candidateId on delete, completing the candidate -> application -> screeningScenario chain', () => {
      const cfg = getTableConfig(application)
      const candidateFk = cfg.foreignKeys.find(fk => fk.getName() === 'application_candidate_id_candidate_id_fk')
      expect(candidateFk).toBeDefined()
      expect(candidateFk!.onDelete).toBe('cascade')
    })

    it('documents the intentional generatedById -> user cascade (mirrors analysisRun.scoredById) — NOT tied to candidate erasure, not to be changed by this task', () => {
      const cfg = getTableConfig(screeningScenario)
      const generatedByFk = cfg.foreignKeys.find(fk => fk.getName() === 'screening_scenario_generated_by_id_user_id_fk')
      expect(generatedByFk).toBeDefined()
      expect(generatedByFk!.onDelete).toBe('cascade')
    })

    it('erasure.ts does NOT need to explicitly enumerate screeningScenario (unlike the true polymorphic tables comment/propertyValue/activityLog, which have no FK to candidate/application)', async () => {
      const erasureSource = await import('node:fs').then(fs =>
        fs.readFileSync(new URL('../../server/utils/erasure.ts', import.meta.url), 'utf8'),
      )
      expect(erasureSource).not.toMatch(/screeningScenario/)
    })
  })

  describe('candidate export includes screeningScenarios (Art. 15/20)', () => {
    let candidateFindFirst: ReturnType<typeof vi.fn>

    beforeEach(() => {
      candidateFindFirst = vi.fn(async () => ({
        id: 'cand-1',
        organizationId: 'org-1',
        applications: [],
      }))
      vi.stubGlobal('db', {
        query: { candidate: { findFirst: candidateFindFirst } },
        select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => []) })) })),
        insert: vi.fn(() => ({ values: vi.fn(async () => {}) })),
      })
      vi.stubGlobal('defineEventHandler', (fn: unknown) => fn)
      vi.stubGlobal('requirePermission', vi.fn(async () => ({
        session: { activeOrganizationId: 'org-1' },
        user: { id: 'user-1' },
      })))
      vi.stubGlobal('getValidatedRouterParams', vi.fn(async (_event: unknown, validator: (v: unknown) => unknown) =>
        validator({ id: 'cand-1' }),
      ))
      vi.stubGlobal('setHeader', vi.fn())
      vi.stubGlobal('createError', vi.fn((opts: unknown) => Object.assign(new Error('createError'), opts as object)))
    })

    it('requests the screeningScenarios relation nested under applications (assert on the actual query args, not just the return value)', async () => {
      const handlerModule = await import('../../server/api/candidates/[id]/export.get')
      const handler = handlerModule.default as (event: unknown) => Promise<unknown>

      await handler({})

      expect(candidateFindFirst).toHaveBeenCalledTimes(1)
      const callArgs = candidateFindFirst.mock.calls[0]![0] as {
        with: { applications: { with: Record<string, unknown> } }
      }
      expect(callArgs.with.applications.with).toHaveProperty('screeningScenarios', true)
    })
  })
})
