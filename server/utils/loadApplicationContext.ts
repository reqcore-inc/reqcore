import { and, eq } from 'drizzle-orm'
import { application, criterionScore, document } from '../database/schema'
import { extractResumeText } from './resume-parser'

export interface CriterionScoreEntry {
  criterionKey: string
  maxScore: number
  applicantScore: number
  confidence: number
  evidence: string
  strengths: string[] | null
  gaps: string[] | null
}

export interface ApplicationContext {
  applicationId: string
  organizationId: string
  jobId: string
  jobTitle: string
  jobDescription: string | null
  candidateId: string
  candidateFirstName: string
  candidateLastName: string
  notes: string | null
  coverLetterText: string | null
  /** id of the candidate's resume document, or null if none was uploaded */
  resumeDocumentId: string | null
  /** extracted resume text, or null when no resume exists or parsing failed/incomplete */
  resumeText: string | null
  /** application.score — null when the application has not been scored yet */
  compositeScore: number | null
  /** persisted per-criterion scores for this application (empty when unscored) */
  criterionScores: CriterionScoreEntry[]
}

/**
 * Load the full org-scoped context for an application: the application itself
 * (with candidate + job), the candidate's parsed resume text, and any
 * previously persisted scoring results.
 *
 * Every lookup is derived from the org-checked application row — callers must
 * never pass through a client-supplied jobId/candidateId directly. Returns
 * `null` when the application does not exist or does not belong to `orgId`
 * (IDOR guard).
 */
export async function loadApplicationContext(
  applicationId: string,
  orgId: string,
): Promise<ApplicationContext | null> {
  const app = await db.query.application.findFirst({
    where: and(eq(application.id, applicationId), eq(application.organizationId, orgId)),
    with: {
      candidate: {
        columns: { id: true, firstName: true, lastName: true },
      },
      job: {
        columns: { id: true, title: true, description: true },
      },
    },
  })

  if (!app) return null

  // Fetch candidate documents (resume text) — scoped through app.candidate.id,
  // which itself came from the org-checked application row above.
  const docs = await db.select({
    id: document.id,
    parsedContent: document.parsedContent,
    type: document.type,
  })
    .from(document)
    .where(and(
      eq(document.candidateId, app.candidate.id),
      eq(document.organizationId, orgId),
    ))

  const resumeDoc = docs.find(d => d.type === 'resume')
  const resumeText = extractResumeText(resumeDoc?.parsedContent)

  // Fetch any previously persisted per-criterion scores for this application.
  const criterionScores = await db.select({
    criterionKey: criterionScore.criterionKey,
    maxScore: criterionScore.maxScore,
    applicantScore: criterionScore.applicantScore,
    confidence: criterionScore.confidence,
    evidence: criterionScore.evidence,
    strengths: criterionScore.strengths,
    gaps: criterionScore.gaps,
  })
    .from(criterionScore)
    .where(and(
      eq(criterionScore.applicationId, applicationId),
      eq(criterionScore.organizationId, orgId),
    ))

  return {
    applicationId: app.id,
    organizationId: orgId,
    jobId: app.job.id,
    jobTitle: app.job.title,
    jobDescription: app.job.description,
    candidateId: app.candidate.id,
    candidateFirstName: app.candidate.firstName,
    candidateLastName: app.candidate.lastName,
    notes: app.notes,
    coverLetterText: app.coverLetterText,
    resumeDocumentId: resumeDoc?.id ?? null,
    resumeText,
    compositeScore: app.score,
    criterionScores,
  }
}
