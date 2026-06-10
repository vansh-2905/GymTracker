/** Matches a ProgramDay.key; widened from literal union to support custom programs. */
export type WorkoutType = string
export type WeightUnit = 'kg' | 'lbs'
export type BiologicalSex = 'male' | 'female'
export type FitnessLevel = 'beginner' | 'intermediate' | 'active' | 'advanced' | 'athlete'
export type PrimaryGoal = 'weight_loss' | 'muscle_gain' | 'maintenance' | 'endurance' | 'general_health'

export interface ProgramDay {
  key: string
  label: string
  color: string
}

export interface WorkoutProgram {
  id: string
  name: string
  days: ProgramDay[]
  isPreset: boolean
}

/** acceptedAt is a Firestore server timestamp (Timestamp on read). */
export interface ConsentRecord {
  version: string
  acceptedAt: unknown
}

export interface UserProfile {
  lastWorkoutType: WorkoutType | null
  lastWorkoutDate: string | null
  weightUnit: WeightUnit
  restDefaultSeconds?: number
  activeProgramId?: string
  customPrograms?: WorkoutProgram[]
  /** Set once historical set kcal values have been recalculated to include rest time. */
  kcalRestRecalcDone?: boolean
  consents?: {
    termsAndPrivacy?: ConsentRecord
    healthProfile?: ConsentRecord
  }
}

export interface FitnessProfile {
  biologicalSex: BiologicalSex
  age: number
  heightCm: number
  bodyWeightKg: number
  fitnessLevel: FitnessLevel
  primaryGoal: PrimaryGoal
  bodyFatPct: string | null
  userMetFactor: number
  skipped: boolean
  completedAt: string
}

export interface Exercise {
  id: string
  name: string
  /** Day keys this exercise belongs to — an exercise can appear under several workout days. */
  categories: WorkoutType[]
  muscleGroup: string
  bilateral?: boolean
  timed?: boolean
}

export interface Template {
  type: WorkoutType
  exerciseIds: string[]
}

export interface WorkoutSet {
  id: string
  exerciseId: string
  exerciseName: string
  setNumber: number
  reps?: number
  weight?: number
  sides?: {
    left: { reps: number; weight: number }
    right: { reps: number; weight: number }
  }
  isTimed?: boolean
  activeDuration: number
  restDuration: number
  kcal?: number
  createdAt: Date
}

export interface Workout {
  date: string
  type: WorkoutType
  startTime: Date
  endTime: Date | null
  completed: boolean
}

export interface ChatMessage {
  id?: string
  role: 'user' | 'assistant'
  content: string
  createdAt?: Date
}
