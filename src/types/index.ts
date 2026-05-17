export type WorkoutType = 'push' | 'pull' | 'legs'
export type WeightUnit = 'kg' | 'lbs'

export interface UserProfile {
  lastWorkoutType: WorkoutType | null
  lastWorkoutDate: string | null  // YYYY-MM-DD
  weightUnit: WeightUnit
}

export interface Exercise {
  id: string
  name: string
  category: WorkoutType
  muscleGroup: string
}

export interface Template {
  type: WorkoutType
  exerciseIds: string[]  // ordered
}

export interface WorkoutSet {
  id: string
  exerciseId: string
  exerciseName: string
  setNumber: number
  reps: number
  weight: number
  activeDuration: number   // seconds
  restDuration: number     // seconds (can exceed 90)
  createdAt: Date
}

export interface Workout {
  date: string             // YYYY-MM-DD, also the doc ID
  type: WorkoutType
  startTime: Date
  endTime: Date | null
  completed: boolean
}
