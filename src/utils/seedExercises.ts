import { addExercise } from '../services/exerciseService'
import { saveTemplate } from '../services/templateService'
import type { Exercise, WorkoutType } from '../types'

const DEFAULT_EXERCISES: Omit<Exercise, 'id'>[] = [
  // Push
  { name: 'Bench Press', categories: ['push'], muscleGroup: 'Chest' },
  { name: 'Overhead Press', categories: ['push'], muscleGroup: 'Shoulders' },
  { name: 'Incline Dumbbell Press', categories: ['push'], muscleGroup: 'Chest' },
  { name: 'Lateral Raises', categories: ['push'], muscleGroup: 'Shoulders' },
  { name: 'Tricep Pushdown', categories: ['push'], muscleGroup: 'Triceps' },
  // Pull
  { name: 'Deadlift', categories: ['pull'], muscleGroup: 'Back' },
  { name: 'Pull-ups', categories: ['pull'], muscleGroup: 'Back' },
  { name: 'Barbell Row', categories: ['pull'], muscleGroup: 'Back' },
  { name: 'Face Pulls', categories: ['pull'], muscleGroup: 'Rear Delts' },
  { name: 'Bicep Curl', categories: ['pull'], muscleGroup: 'Biceps' },
  // Legs
  { name: 'Squat', categories: ['legs'], muscleGroup: 'Quads' },
  { name: 'Romanian Deadlift', categories: ['legs'], muscleGroup: 'Hamstrings' },
  { name: 'Leg Press', categories: ['legs'], muscleGroup: 'Quads' },
  { name: 'Leg Curl', categories: ['legs'], muscleGroup: 'Hamstrings' },
  { name: 'Calf Raises', categories: ['legs'], muscleGroup: 'Calves' },
]

export async function seedDefaultExercises(uid: string): Promise<void> {
  const created: Record<WorkoutType, string[]> = { push: [], pull: [], legs: [] }
  for (const ex of DEFAULT_EXERCISES) {
    const added = await addExercise(uid, ex)
    created[ex.categories[0]].push(added.id)
  }
  await saveTemplate(uid, { type: 'push', exerciseIds: created.push })
  await saveTemplate(uid, { type: 'pull', exerciseIds: created.pull })
  await saveTemplate(uid, { type: 'legs', exerciseIds: created.legs })
}
