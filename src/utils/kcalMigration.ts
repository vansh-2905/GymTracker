import type { WorkoutSet } from '../types'
import { getProfile, markKcalRestRecalcDone } from '../services/profileService'
import { getFitnessProfile } from '../services/fitnessProfileService'
import { getAllWorkoutDates, getSets, updateSetKcal } from '../services/workoutService'
import { calculateSetKcal } from './calorieCalc'

// Mirror how each set type fed calculateSetKcal when it was logged
function repsFor(s: WorkoutSet): number {
  if (s.sides) return s.sides.left.reps + s.sides.right.reps
  if (s.isTimed) return 1
  return s.reps ?? 0
}

function weightFor(s: WorkoutSet): number {
  if (s.sides) return (s.sides.left.weight + s.sides.right.weight) / 2
  return s.weight ?? 0
}

// One-time recalculation of stored set kcal values: sets logged before rest
// time was counted only credited the active seconds. Each set's kcal is
// recomputed from scratch (not incremented), so an interrupted run can safely
// be repeated — the profile flag only avoids rescanning on every app start.
export async function recalculateAllSetKcal(uid: string): Promise<void> {
  const profile = await getProfile(uid)
  if (!profile || profile.kcalRestRecalcDone) return

  const fp = await getFitnessProfile(uid)
  if (fp && !fp.skipped && fp.bodyWeightKg > 0) {
    const dates = await getAllWorkoutDates(uid)
    for (const date of dates) {
      const sets = await getSets(uid, date)
      const updates = sets
        .filter(s => s.kcal !== undefined && s.activeDuration > 0)
        .map(s => ({
          s,
          kcal: calculateSetKcal(
            repsFor(s),
            weightFor(s),
            s.activeDuration,
            s.restDuration,
            fp.userMetFactor,
            fp.bodyWeightKg,
          ),
        }))
        .filter(({ s, kcal }) => kcal !== s.kcal)
      await Promise.all(updates.map(({ s, kcal }) => updateSetKcal(uid, date, s.id, kcal)))
    }
  }

  await markKcalRestRecalcDone(uid)
}
