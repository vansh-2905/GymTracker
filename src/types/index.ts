export type WorkoutType = 'push' | 'pull' | 'legs'
export type WeightUnit = 'kg' | 'lbs'
export type BiologicalSex = 'male' | 'female'
export type FitnessLevel = 'beginner' | 'intermediate' | 'active' | 'advanced' | 'athlete'
export type PrimaryGoal = 'weight_loss' | 'muscle_gain' | 'maintenance' | 'endurance' | 'general_health'

export interface UserProfile {
  lastWorkoutType: WorkoutType | null
  lastWorkoutDate: string | null
  weightUnit: WeightUnit
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
  category: WorkoutType
  muscleGroup: string
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
  reps: number
  weight: number
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
