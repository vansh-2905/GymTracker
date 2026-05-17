import { addExercise } from '../services/exerciseService'
import { saveTemplate } from '../services/templateService'
import type { Exercise, WorkoutType } from '../types'

const DEFAULT_EXERCISES: Omit<Exercise, 'id'>[] = [
  // Push
  { name: 'Bench Press', category: 'push', muscleGroup: 'Chest' },
  { name: 'Overhead Press', category: 'push', muscleGroup: 'Shoulders' },
  { name: 'Incline Dumbbell Press', category: 'push', muscleGroup: 'Chest' },
  { name: 'Lateral Raises', category: 'push', muscleGroup: 'Shoulders' },
  { name: 'Tricep Pushdown', category: 'push', muscleGroup: 'Triceps' },
  // Pull
  { name: 'Deadlift', category: 'pull', muscleGroup: 'Back' },
  { name: 'Pull-ups', category: 'pull', muscleGroup: 'Back' },
  { name: 'Barbell Row', category: 'pull', muscleGroup: 'Back' },
  { name: 'Face Pulls', category: 'pull', muscleGroup: 'Rear Delts' },
  { name: 'Bicep Curl', category: 'pull', muscleGroup: 'Biceps' },
  // Legs
  { name: 'Squat', category: 'legs', muscleGroup: 'Quads' },
  { name: 'Romanian Deadlift', category: 'legs', muscleGroup: 'Hamstrings' },
  { name: 'Leg Press', category: 'legs', muscleGroup: 'Quads' },
  { name: 'Leg Curl', category: 'legs', muscleGroup: 'Hamstrings' },
  { name: 'Calf Raises', category: 'legs', muscleGroup: 'Calves' },
]

export async function seedDefaultExercises(uid: string): Promise<void> {
  const created: Record<WorkoutType, string[]> = { push: [], pull: [], legs: [] }
  for (const ex of DEFAULT_EXERCISES) {
    const added = await addExercise(uid, ex)
    created[ex.category].push(added.id)
  }
  await saveTemplate(uid, { type: 'push', exerciseIds: created.push })
  await saveTemplate(uid, { type: 'pull', exerciseIds: created.pull })
  await saveTemplate(uid, { type: 'legs', exerciseIds: created.legs })
}
