// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from './utils'

describe('buildSystemPrompt', () => {
  it('includes today date', () => {
    const result = buildSystemPrompt({ weightUnit: 'kg' }, null, '2026-05-24')
    expect(result).toContain('2026-05-24')
  })

  it('includes weight unit in schema description', () => {
    const result = buildSystemPrompt({ weightUnit: 'lbs' }, null, '2026-05-24')
    expect(result).toContain('lbs')
    expect(result).not.toContain('(kg)')
  })

  it('includes rest default seconds', () => {
    const result = buildSystemPrompt({ weightUnit: 'kg', restDefaultSeconds: 120 }, null, '2026-05-24')
    expect(result).toContain('120s')
  })

  it('defaults rest timer to 90s when not set', () => {
    const result = buildSystemPrompt({}, null, '2026-05-24')
    expect(result).toContain('90s')
  })

  it('includes fitness profile details when not skipped', () => {
    const fp = {
      biologicalSex: 'male', age: 23, heightCm: 170, bodyWeightKg: 55,
      fitnessLevel: 'active', primaryGoal: 'muscle_gain', bodyFatPct: null, skipped: false
    }
    const result = buildSystemPrompt({ weightUnit: 'kg' }, fp, '2026-05-24')
    expect(result).toContain('170cm')
    expect(result).toContain('55kg')
    expect(result).toContain('muscle_gain')
  })

  it('omits fitness profile when skipped', () => {
    const fp = {
      biologicalSex: 'male', age: 23, heightCm: 170, bodyWeightKg: 55,
      fitnessLevel: 'active', primaryGoal: 'muscle_gain', bodyFatPct: null, skipped: true
    }
    const result = buildSystemPrompt({ weightUnit: 'kg' }, fp, '2026-05-24')
    expect(result).not.toContain('170cm')
  })

  it('omits fitness section when fitnessProfile is null', () => {
    const result = buildSystemPrompt({ weightUnit: 'kg' }, null, '2026-05-24')
    expect(result).not.toContain('Age:')
  })
})
