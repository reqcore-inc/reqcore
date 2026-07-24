/**
 * ─────────────────────────────────────────────
 * Pipeline stages — single source of truth
 * ─────────────────────────────────────────────
 *
 * Each job owns an ordered list of custom pipeline stages (the statuses an
 * application moves through). Recruiters can rename, recolour, reorder, add and
 * delete stages freely. The six defaults below reproduce the legacy fixed
 * pipeline (new → screening → interview → offer → hired / rejected) so existing
 * behaviour is preserved out of the box.
 *
 * System behaviour never keys off a stage's NAME — it keys off its `category`
 * (the role a stage plays) and the single `isEntry` stage:
 *   - `applied`      → fresh applications; automation rules only act here.
 *   - `in_progress`  → any middle stage of the funnel.
 *   - `hired`        → terminal "won" outcome (dashboard "hired" counts).
 *   - `rejected`     → terminal "lost" outcome (skips auto-scoring, "rejected"
 *                      counts, retention-relevant).
 *
 * This module is imported by BOTH client and server so the palette, default
 * template and category metadata never drift between the builder UI, the job
 * creation path, the seed script and the migration reference.
 */

// ─── Categories (roles) ─────────────────────────────────────────────
export type StageCategory = 'applied' | 'in_progress' | 'hired' | 'rejected'

export const STAGE_CATEGORIES: StageCategory[] = ['applied', 'in_progress', 'hired', 'rejected']

export interface StageCategoryMeta {
  label: string
  /** Terminal categories are outcomes — the application has left the funnel. */
  terminal: boolean
}

export const STAGE_CATEGORY_META: Record<StageCategory, StageCategoryMeta> = {
  applied: { label: 'Applied', terminal: false },
  in_progress: { label: 'In progress', terminal: false },
  hired: { label: 'Hired', terminal: true },
  rejected: { label: 'Rejected', terminal: true },
}

// ─── Colour palette ─────────────────────────────────────────────────
// Palette tokens map to Tailwind classes for the badge (background + text) and
// the small status dot. Lifted from the legacy hard-coded maps so the visual
// language is unchanged. `badge` is tuned for the compact chips in lists;
// `dot` for the pipeline column indicators.
export type StageColor =
  | 'slate' | 'violet' | 'amber' | 'teal' | 'green'
  | 'blue' | 'rose' | 'orange' | 'cyan' | 'fuchsia'

export interface StageColorClasses {
  badge: string
  dot: string
}

export const STAGE_COLORS: Record<StageColor, StageColorClasses> = {
  slate: {
    badge: 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-300',
    dot: 'bg-surface-400 dark:bg-surface-500',
  },
  violet: {
    badge: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-400',
    dot: 'bg-violet-500',
  },
  amber: {
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  teal: {
    badge: 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-400',
    dot: 'bg-teal-500',
  },
  green: {
    badge: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400',
    dot: 'bg-green-600',
  },
  blue: {
    badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
    dot: 'bg-blue-500',
  },
  rose: {
    badge: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400',
    dot: 'bg-rose-500',
  },
  orange: {
    badge: 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
    dot: 'bg-orange-500',
  },
  cyan: {
    badge: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-400',
    dot: 'bg-cyan-500',
  },
  fuchsia: {
    badge: 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-400',
    dot: 'bg-fuchsia-500',
  },
}

export const STAGE_COLOR_TOKENS = Object.keys(STAGE_COLORS) as StageColor[]

/** Fallback used when a stored colour token is unknown (e.g. after a rename). */
export const DEFAULT_STAGE_COLOR: StageColor = 'slate'

export function stageColorClasses(color: string | null | undefined): StageColorClasses {
  return STAGE_COLORS[(color ?? '') as StageColor] ?? STAGE_COLORS[DEFAULT_STAGE_COLOR]
}

// ─── Default template ───────────────────────────────────────────────
export interface StageTemplate {
  name: string
  color: StageColor
  category: StageCategory
  isEntry: boolean
}

/**
 * The stages seeded for every new job (and every existing job in the migration).
 * Reproduces the legacy fixed pipeline. `displayOrder` is the array index.
 */
export const DEFAULT_STAGES: StageTemplate[] = [
  { name: 'New', color: 'blue', category: 'applied', isEntry: true },
  { name: 'Screening', color: 'violet', category: 'in_progress', isEntry: false },
  { name: 'Interview', color: 'amber', category: 'in_progress', isEntry: false },
  { name: 'Offer', color: 'teal', category: 'in_progress', isEntry: false },
  { name: 'Hired', color: 'green', category: 'hired', isEntry: false },
  { name: 'Rejected', color: 'slate', category: 'rejected', isEntry: false },
]

// ─── Shared stage shape (returned by the API, consumed by the UI) ───
export interface PipelineStage {
  id: string
  jobId: string
  name: string
  color: string
  category: StageCategory
  displayOrder: number
  isEntry: boolean
}
