import { describe, it, expect } from 'vitest'
import {
  computeCostUsdMicros,
  getModelPrice,
  microsToUsd,
  normalizeModelId,
  MODEL_PRICING,
} from '../../server/utils/ai/pricing'
import { PROVIDER_REGISTRY } from '../../server/utils/ai/provider'
import { MONTHLY_BUDGET_USD } from '../../server/utils/ai/budget'
import { BILLING_PLANS } from '../../shared/billing'

/**
 * The cost layer is the foundation of the money-safety system: budgets are
 * enforced by summing per-run cost, so an error here either over-charges
 * customers' budgets or lets spend run unbounded.
 */
describe('platform default model pricing', () => {
  /**
   * An unpriced model makes computeCostUsdMicros return null, which is stored as
   * a null cost and coalesced to 0 when summing spend — so the per-org monthly
   * cap would never trip and platform spend would run unbounded. The platform
   * default is the one model we pay for on every free org's behalf, so it must
   * always be on the price table.
   */
  it('prices the default platform model used for platform-paid runs', () => {
    // Mirrors the OPENROUTER_MODEL default in server/utils/env.ts.
    expect(getModelPrice('google/gemini-3.5-flash-lite')).not.toBeNull()
  })

  it('prices every model offered in the OpenRouter provider registry', () => {
    for (const model of PROVIDER_REGISTRY.openrouter.models) {
      expect(getModelPrice(model.id), `unpriced model: ${model.id}`).not.toBeNull()
    }
  })
})

describe('normalizeModelId', () => {
  it('strips an OpenRouter-style vendor prefix', () => {
    expect(normalizeModelId('openai/gpt-5.4-mini')).toBe('gpt-5.4-mini')
    expect(normalizeModelId('anthropic/claude-sonnet-5')).toBe('claude-sonnet-5')
  })

  it('leaves a bare model id untouched', () => {
    expect(normalizeModelId('gpt-5.4-mini')).toBe('gpt-5.4-mini')
  })
})

describe('getModelPrice', () => {
  it('resolves both prefixed and bare ids to the same price', () => {
    expect(getModelPrice('openai/gpt-5.4-mini')).toEqual(getModelPrice('gpt-5.4-mini'))
  })

  it('returns null for an unknown model rather than guessing', () => {
    expect(getModelPrice('totally-made-up-model')).toBeNull()
  })
})

describe('computeCostUsdMicros', () => {
  it('computes integer micro-dollars from per-1M pricing', () => {
    // gpt-5.4-mini: $0.75/1M in, $4.50/1M out.
    // 1,000,000 in + 500,000 out = 0.75 + 2.25 = $3.00 = 3,000,000 µ$.
    expect(computeCostUsdMicros('gpt-5.4-mini', 1_000_000, 500_000)).toBe(3_000_000)
  })

  it('returns a whole integer (no float drift)', () => {
    const micros = computeCostUsdMicros('gpt-5.4-mini', 1234, 567)
    expect(micros).not.toBeNull()
    expect(Number.isInteger(micros)).toBe(true)
  })

  it('returns null for an unpriced model so the caller stores null, not a wrong number', () => {
    expect(computeCostUsdMicros('unknown-model', 1000, 1000)).toBeNull()
  })

  it('round-trips micros → USD', () => {
    expect(microsToUsd(3_000_000)).toBeCloseTo(3.0)
  })
})

describe('MONTHLY_BUDGET_USD', () => {
  it('has a default (free / no-subscription) cap', () => {
    expect(MONTHLY_BUDGET_USD.default).toBeGreaterThan(0)
  })

  it('keeps every plan cap safely under that plan’s monthly price', () => {
    for (const plan of BILLING_PLANS) {
      const cap = MONTHLY_BUDGET_USD[plan.id]
      if (cap == null) continue
      expect(cap).toBeLessThan(plan.monthlyPrice)
    }
  })
})

describe('MODEL_PRICING table', () => {
  it('has positive input/output prices for every model', () => {
    for (const [model, price] of Object.entries(MODEL_PRICING)) {
      expect(price.inputPer1m, model).toBeGreaterThan(0)
      expect(price.outputPer1m, model).toBeGreaterThan(0)
    }
  })
})
