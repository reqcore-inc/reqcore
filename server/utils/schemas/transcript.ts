import { z } from 'zod'

// ─────────────────────────────────────────────
// Transcript validation schemas & constants
// ─────────────────────────────────────────────

/**
 * Maximum length (in characters) for a pasted transcript body.
 * Mirrors the `screening_transcript.raw_text` data model contract in
 * docs/spec/transcript-analysis.md ("Paste only, ≤ 200,000 chars").
 */
export const MAX_TRANSCRIPT_PASTE_LENGTH = 200_000

/**
 * Body schema for `POST /api/applications/:id/transcript` (paste path).
 */
export const transcriptPasteSchema = z.object({
  text: z.string().min(1).max(MAX_TRANSCRIPT_PASTE_LENGTH),
})
