import type { PropertyEntry } from './properties'
import type { StageCategory } from './pipeline'

export interface CandidateDetail {
  id: string
  firstName: string
  lastName: string
  displayName: string | null
  email: string
  phone: string | null
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null
  dateOfBirth: string | null
  quickNotes: string | null
  createdAt: string
  updatedAt: string
  applications: Array<{
    id: string
    /** Current pipeline stage — resolved from the application's own job. */
    status: {
      id: string
      name: string
      color: string
      category: StageCategory
    }
    createdAt: string
    job: { id: string; title: string }
  }>
  documents: Array<{
    id: string
    type: 'resume' | 'cover_letter' | 'other'
    originalFilename: string
    mimeType: string
    createdAt: string
    parsed: boolean
  }>
  properties: PropertyEntry[]
  retention:
    | { enabled: false }
    | {
        enabled: true
        status: 'active' | 'expiring' | 'expired' | 'exempt'
        expiresAt: string
        quarantinedAt: string | null
        scheduledPurgeAt: string | null
      }
}
