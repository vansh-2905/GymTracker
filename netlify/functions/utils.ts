export interface ProfileData {
  weightUnit?: string
  restDefaultSeconds?: number
}

export interface FitnessData {
  biologicalSex?: string
  age?: number
  heightCm?: number
  bodyWeightKg?: number
  fitnessLevel?: string
  primaryGoal?: string
  bodyFatPct?: string | null
  skipped?: boolean
}

export function buildSystemPrompt(
  profile: ProfileData,
  fitnessProfile: FitnessData | null,
  today: string
): string {
  const unit = profile.weightUnit ?? 'kg'
  const fp = fitnessProfile

  const fitnessSection =
    fp && !fp.skipped
      ? `\n- Age: ${fp.age}, Sex: ${fp.biologicalSex}, Height: ${fp.heightCm}cm, Body weight: ${fp.bodyWeightKg}kg\n- Fitness level: ${fp.fitnessLevel}, Primary goal: ${fp.primaryGoal}, Body fat: ${fp.bodyFatPct ?? 'unknown'}`
      : ''

  return `You are a personal gym coach. Answer questions about the user's workouts and provide personalized fitness advice. Use tools to fetch workout data when needed. For general fitness knowledge or profile-based calculations (maintenance calories, macros, BMI), answer directly without tools.

USER PROFILE:
- Weight unit: ${unit}
- Rest timer default: ${profile.restDefaultSeconds ?? 90}s${fitnessSection}

WORKOUT DATA SCHEMA (WorkoutSet fields):
- id: string
- exerciseId: string
- exerciseName: string
- setNumber: number
- reps: number
- weight: number (${unit})
- activeDuration: number (seconds — time under tension for the set)
- restDuration: number (seconds — rest taken after the set)
- kcal?: number (estimated calories burned, absent if user skipped onboarding)
- createdAt: Timestamp

Today's date: ${today}`
}
