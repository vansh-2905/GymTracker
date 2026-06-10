import type { WorkoutProgram } from '../types'
import { getExercises, addExercise } from '../services/exerciseService'
import { getTemplate, saveTemplate } from '../services/templateService'

interface ExerciseSeed { name: string; muscleGroup: string }

function getSuggestedExercises(dayLabel: string): ExerciseSeed[] {
  const l = dayLabel.toLowerCase()

  if (/push|chest|press/.test(l))
    return [
      { name: 'Bench Press', muscleGroup: 'Chest' },
      { name: 'Overhead Press', muscleGroup: 'Shoulders' },
      { name: 'Tricep Pushdown', muscleGroup: 'Triceps' },
    ]
  if (/pull|back|row|lat/.test(l))
    return [
      { name: 'Pull-ups', muscleGroup: 'Back' },
      { name: 'Barbell Row', muscleGroup: 'Back' },
      { name: 'Lat Pulldown', muscleGroup: 'Back' },
    ]
  if (/legs|lower|squat/.test(l))
    return [
      { name: 'Squat', muscleGroup: 'Quads' },
      { name: 'Romanian Deadlift', muscleGroup: 'Hamstrings' },
      { name: 'Leg Press', muscleGroup: 'Quads' },
    ]
  if (/upper/.test(l))
    return [
      { name: 'Bench Press', muscleGroup: 'Chest' },
      { name: 'Pull-ups', muscleGroup: 'Back' },
      { name: 'Overhead Press', muscleGroup: 'Shoulders' },
    ]
  if (/full|total/.test(l))
    return [
      { name: 'Squat', muscleGroup: 'Quads' },
      { name: 'Bench Press', muscleGroup: 'Chest' },
      { name: 'Barbell Row', muscleGroup: 'Back' },
    ]
  if (/hiit|cardio|condition/.test(l))
    return [
      { name: 'Burpees', muscleGroup: 'Full Body' },
      { name: 'Box Jumps', muscleGroup: 'Quads' },
      { name: 'Mountain Climbers', muscleGroup: 'Core' },
    ]
  if (/strength|power/.test(l))
    return [
      { name: 'Deadlift', muscleGroup: 'Back' },
      { name: 'Bench Press', muscleGroup: 'Chest' },
      { name: 'Squat', muscleGroup: 'Quads' },
    ]
  if (/shoulder|delt/.test(l))
    return [
      { name: 'Overhead Press', muscleGroup: 'Shoulders' },
      { name: 'Lateral Raises', muscleGroup: 'Shoulders' },
      { name: 'Face Pulls', muscleGroup: 'Rear Delts' },
    ]
  if (/arm|bicep|tricep|curl/.test(l))
    return [
      { name: 'Barbell Curl', muscleGroup: 'Biceps' },
      { name: 'Tricep Pushdown', muscleGroup: 'Triceps' },
      { name: 'Hammer Curl', muscleGroup: 'Biceps' },
    ]
  if (/abs|core|abdom/.test(l))
    return [
      { name: 'Plank', muscleGroup: 'Core' },
      { name: 'Crunches', muscleGroup: 'Abs' },
      { name: 'Leg Raises', muscleGroup: 'Lower Abs' },
    ]

  // Generic fallback
  return [
    { name: 'Squat', muscleGroup: 'Quads' },
    { name: 'Bench Press', muscleGroup: 'Chest' },
    { name: 'Barbell Row', muscleGroup: 'Back' },
  ]
}

export async function seedProgramExercises(uid: string, program: WorkoutProgram): Promise<void> {
  const existing = await getExercises(uid)

  for (const day of program.days) {
    const template = await getTemplate(uid, day.key)
    if (template.exerciseIds.length > 0) continue // already populated

    const suggestions = getSuggestedExercises(day.label)
    const ids: string[] = []

    for (const s of suggestions) {
      const found = existing.find(e => e.name.toLowerCase() === s.name.toLowerCase())
      if (found) {
        ids.push(found.id)
      } else {
        const created = await addExercise(uid, { name: s.name, muscleGroup: s.muscleGroup, categories: [day.key] })
        existing.push(created)
        ids.push(created.id)
      }
    }

    await saveTemplate(uid, { type: day.key, exerciseIds: ids })
  }
}
