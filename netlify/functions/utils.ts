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

  const fitnessSection =
    fitnessProfile && !fitnessProfile.skipped
      ? `\n- Age: ${fitnessProfile.age}, Sex: ${fitnessProfile.biologicalSex}, Height: ${fitnessProfile.heightCm}cm, Body weight: ${fitnessProfile.bodyWeightKg}kg\n- Fitness level: ${fitnessProfile.fitnessLevel}, Primary goal: ${fitnessProfile.primaryGoal}, Body fat: ${fitnessProfile.bodyFatPct ?? 'unknown'}`
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
