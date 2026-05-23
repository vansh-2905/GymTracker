import { describe, it, expect } from 'vitest'
import { computeUserMetFactor, calculateSetKcal } from './calorieCalc'

describe('computeUserMetFactor', () => {
  it('returns 1.0 for baseline: male, age 30, intermediate', () => {
    expect(computeUserMetFactor('male', 30, 'intermediate')).toBe(1.0)
  })
  it('applies female sex factor (0.87)', () => {
    expect(computeUserMetFactor('female', 30, 'intermediate')).toBeCloseTo(0.87, 5)
  })
  it('applies age factor 1.05 for under 25', () => {
    expect(computeUserMetFactor('male', 20, 'intermediate')).toBeCloseTo(1.05, 5)
  })
  it('applies age factor 1.0 for age 25–39', () => {
    expect(computeUserMetFactor('male', 35, 'intermediate')).toBeCloseTo(1.0, 5)
  })
  it('applies age factor 0.95 for age 40–54', () => {
    expect(computeUserMetFactor('male', 45, 'intermediate')).toBeCloseTo(0.95, 5)
  })
  it('applies age factor 0.88 for age 55+', () => {
    expect(computeUserMetFactor('male', 60, 'intermediate')).toBeCloseTo(0.88, 5)
  })
  it('applies fitness factor 1.05 for beginner', () => {
    expect(computeUserMetFactor('male', 30, 'beginner')).toBeCloseTo(1.05, 5)
  })
  it('applies fitness factor 0.85 for athlete', () => {
    expect(computeUserMetFactor('male', 30, 'athlete')).toBeCloseTo(0.85, 5)
  })
  it('combines all three factors multiplicatively', () => {
    // female (0.87) * age<25 (1.05) * active (0.95) = 0.867...
    expect(computeUserMetFactor('female', 22, 'active')).toBeCloseTo(0.87 * 1.05 * 0.95, 5)
  })
})

describe('calculateSetKcal', () => {
  it('returns 0 for zero activeDuration', () => {
    expect(calculateSetKcal(10, 60, 0, 1.0, 80)).toBe(0)
  })
  it('uses bodyweight MET (4.0) when weight is 0', () => {
    // 4.0 * 1.0 * 80 * (60/3600) * 1.15 ≈ 6.1
    expect(calculateSetKcal(10, 0, 60, 1.0, 80)).toBeCloseTo(6.1, 0)
  })
  it('uses heavy MET (6.0) for 1–6 reps', () => {
    // 6.0 * 1.0 * 80 * (60/3600) * 1.15 ≈ 9.2
    expect(calculateSetKcal(5, 100, 60, 1.0, 80)).toBeCloseTo(9.2, 0)
  })
  it('uses heavy MET (6.0) for exactly 6 reps', () => {
    expect(calculateSetKcal(6, 100, 60, 1.0, 80)).toBeCloseTo(9.2, 0)
  })
  it('uses moderate MET (5.0) for 7–12 reps', () => {
    // 5.0 * 1.0 * 80 * (60/3600) * 1.15 ≈ 7.7
    expect(calculateSetKcal(10, 60, 60, 1.0, 80)).toBeCloseTo(7.7, 0)
  })
  it('uses light MET (3.5) for 13+ reps', () => {
    // 3.5 * 1.0 * 80 * (60/3600) * 1.15 ≈ 5.4
    expect(calculateSetKcal(15, 40, 60, 1.0, 80)).toBeCloseTo(5.4, 0)
  })
  it('scales linearly with bodyWeightKg', () => {
    const light = calculateSetKcal(10, 60, 60, 1.0, 60)
    const heavy = calculateSetKcal(10, 60, 60, 1.0, 90)
    expect(heavy / light).toBeCloseTo(90 / 60, 1)
  })
  it('scales linearly with activeDuration', () => {
    const short = calculateSetKcal(10, 60, 30, 1.0, 80)
    const long = calculateSetKcal(10, 60, 60, 1.0, 80)
    expect(long / short).toBeCloseTo(2, 1)
  })
  it('rounds result to 1 decimal place', () => {
    const result = calculateSetKcal(10, 60, 61, 1.0, 80)
    const asString = result.toString()
    expect(asString).toMatch(/^\d+(\.\d)?$/)
  })
})
