import { z } from 'zod'
import { STAGE_CATEGORIES, STAGE_COLOR_TOKENS } from '~~/shared/pipeline'
import type { StageCategory, StageColor } from '~~/shared/pipeline'

// ─────────────────────────────────────────────
// Pipeline stage validation schemas
// ─────────────────────────────────────────────

const categoryEnum = z.enum(STAGE_CATEGORIES as [StageCategory, ...StageCategory[]])
const colorEnum = z.enum(STAGE_COLOR_TOKENS as [StageColor, ...StageColor[]])

/** Route param schema for job id */
export const stageJobIdParamSchema = z.object({
  id: z.string().min(1),
})

/** Route params for a stage nested under a job */
export const stageIdParamSchema = z.object({
  id: z.string().min(1),
  stageId: z.string().min(1),
})

export const createStageSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60),
  color: colorEnum.default('slate'),
  category: categoryEnum.default('in_progress'),
})

/**
 * Every field optional — the builder patches one attribute at a time.
 * Setting `isEntry: true` moves the entry flag to this stage (the handler clears
 * it from the others); `isEntry: false` is rejected, since a job must always
 * have exactly one entry stage.
 */
export const updateStageSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  color: colorEnum.optional(),
  category: categoryEnum.optional(),
  isEntry: z.literal(true).optional(),
})

/** Bulk reorder — array position is NOT used; explicit displayOrder is. */
export const reorderStagesSchema = z.object({
  order: z.array(z.object({
    id: z.string().min(1),
    displayOrder: z.number().int().min(0),
  })).min(1).max(50),
})
