import { z } from 'zod'

// ─────────────────────────────────────────────
// Custom Property — Zod schemas (shared)
// ─────────────────────────────────────────────

export const propertyEntityTypes = ['candidate', 'application'] as const
export type PropertyEntityType = (typeof propertyEntityTypes)[number]

export const propertyTypes = [
  'text', 'long_text', 'number', 'select', 'multi_select',
  'date', 'checkbox', 'url', 'email', 'person', 'file',
] as const
export type PropertyType = (typeof propertyTypes)[number]

// ── Per-type config schemas (`propertyDefinition.config` jsonb) ──
const selectOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(80),
  color: z.enum([
    'gray', 'red', 'orange', 'amber', 'yellow', 'green', 'teal',
    'blue', 'indigo', 'violet', 'pink',
  ]).default('gray'),
})
export type PropertySelectOption = z.infer<typeof selectOptionSchema>

const selectConfigSchema = z.object({
  options: z.array(selectOptionSchema).max(50),
})

const numberConfigSchema = z.object({
  format: z.enum(['plain', 'percent', 'currency']).default('plain'),
  currency: z.string().max(8).optional(),
})

const propertyConfigSchema = z.union([
  selectConfigSchema,
  numberConfigSchema,
  z.null(),
  z.object({}).passthrough(),
])

// ── Definition CRUD ──
export const createPropertyDefinitionSchema = z.object({
  entityType: z.enum(propertyEntityTypes),
  type: z.enum(propertyTypes),
  name: z.string().min(1, 'Name is required').max(80, 'Name too long'),
  description: z.string().max(500).nullish(),
  jobId: z.string().min(1).nullish(),
  config: propertyConfigSchema.nullish(),
})

export const updatePropertyDefinitionSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(500).nullish(),
  config: propertyConfigSchema.nullish(),
  displayOrder: z.number().int().min(0).optional(),
})

export const reorderPropertiesSchema = z.object({
  ids: z.array(z.string().min(1)).max(100),
})

export const propertyListQuerySchema = z.object({
  entityType: z.enum(propertyEntityTypes).optional(),
  /** When supplied, returns org-global + this job's per-job props (deduped, ordered). */
  jobId: z.string().min(1).optional(),
  /** Set to "1" to ONLY return per-job props (used by the per-job schema editor). */
  jobOnly: z
    .union([z.literal('1'), z.literal('true'), z.boolean()])
    .optional()
    .transform((v) => v === '1' || v === 'true' || v === true),
})

export const propertyIdParamSchema = z.object({
  id: z.string().min(1),
})

// ── Value writes ──
//
// We allow null to clear a value. Concrete shape validation is performed
// against the property definition's type at the server util layer.
export const setPropertyValueSchema = z.object({
  value: z.unknown(),
})

// ── Value validation by property type ──
//
// Returns the normalized (storage-ready) value or throws a 422 createError.
export function validateValueForType(
  type: PropertyType,
  rawValue: unknown,
  config: unknown,
): unknown {
  if (rawValue === null || rawValue === undefined || rawValue === '') return null

  const fail = (msg: string): never => {
    throw createError({ statusCode: 422, statusMessage: msg })
  }

  switch (type) {
    case 'text':
    case 'long_text': {
      if (typeof rawValue !== 'string') return fail('Value must be a string')
      const max = type === 'long_text' ? 10_000 : 500
      if (rawValue.length > max) return fail(`Value exceeds ${max} characters`)
      return rawValue
    }
    case 'number': {
      const n = typeof rawValue === 'number' ? rawValue : Number(rawValue)
      if (!Number.isFinite(n)) return fail('Value must be a number')
      return n
    }
    case 'checkbox': {
      if (typeof rawValue !== 'boolean') return fail('Value must be a boolean')
      return rawValue
    }
    case 'date': {
      if (typeof rawValue !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
        return fail('Date must be YYYY-MM-DD')
      }
      return rawValue
    }
    case 'url': {
      if (typeof rawValue !== 'string') return fail('Value must be a string')
      try {
        // eslint-disable-next-line no-new
        new URL(rawValue)
      } catch {
        return fail('Invalid URL')
      }
      return rawValue
    }
    case 'email': {
      if (typeof rawValue !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawValue)) {
        return fail('Invalid email')
      }
      return rawValue
    }
    case 'person': {
      if (typeof rawValue !== 'string') return fail('Value must be a user id')
      return rawValue
    }
    case 'file': {
      if (typeof rawValue !== 'object' || rawValue === null) return fail('Invalid file value')
      const v = rawValue as { documentId?: unknown }
      if (typeof v.documentId !== 'string') return fail('Invalid file value')
      return { documentId: v.documentId }
    }
    case 'select': {
      if (typeof rawValue !== 'string') return fail('Value must be an option id')
      const opts = (config as { options?: { id: string }[] } | null)?.options ?? []
      if (!opts.some((o) => o.id === rawValue)) return fail('Unknown option')
      return rawValue
    }
    case 'multi_select': {
      if (!Array.isArray(rawValue)) return fail('Value must be an array of option ids')
      const opts = (config as { options?: { id: string }[] } | null)?.options ?? []
      const ids = new Set(opts.map((o) => o.id))
      const cleaned: string[] = []
      for (const v of rawValue) {
        if (typeof v !== 'string') return fail('Invalid option id')
        if (!ids.has(v)) return fail('Unknown option')
        if (!cleaned.includes(v)) cleaned.push(v)
      }
      return cleaned
    }
  }
}
