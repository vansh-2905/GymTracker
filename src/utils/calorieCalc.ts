import type { BiologicalSex, FitnessLevel } from '../types'

const FITNESS_FACTORS: Record<FitnessLevel, number> = {
  beginner: 1.05,
  intermediate: 1.00,
  active: 0.95,
  advanced: 0.90,
  athlete: 0.85,
}

export function computeUserMetFactor(
  biologicalSex: BiologicalSex,
  age: number,
  fitnessLevel: FitnessLevel,
): number {
  const sexFactor = biologicalSex === 'male' ? 1.0 : 0.87
  const ageFactor = age < 25 ? 1.05 : age < 40 ? 1.0 : age < 55 ? 0.95 : 0.88
  return sexFactor * ageFactor * FITNESS_FACTORS[fitnessLevel]
}

export function calculateSetKcal(
  reps: number,
  weight: number,
  activeDuration: number,
  userMetFactor: number,
  bodyWeightKg: number,
): number {
  if (activeDuration === 0) return 0
  const baseMET = weight === 0 ? 4.0 : reps <= 6 ? 6.0 : reps <= 12 ? 5.0 : 3.5
  const raw = baseMET * userMetFactor * bodyWeightKg * (activeDuration / 3600) * 1.15
  return Math.round(raw * 10) / 10
}
