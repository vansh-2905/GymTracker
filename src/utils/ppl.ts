import { WorkoutType } from '../types'

const SEQUENCE: WorkoutType[] = ['push', 'pull', 'legs']

export function nextWorkoutType(last: WorkoutType | null): WorkoutType {
  if (!last) return 'push'
  const idx = SEQUENCE.indexOf(last)
  return SEQUENCE[(idx + 1) % 3]
}

export function getProjectedType(
  lastType: WorkoutType,
  lastDate: string,
  targetDate: string,
): WorkoutType {
  const last = new Date(lastDate)
  const target = new Date(targetDate)
  const days = Math.round((target.getTime() - last.getTime()) / 86_400_000)
  if (days <= 0) return lastType
  let type = lastType
  for (let i = 0; i < days; i++) type = nextWorkoutType(type)
  return type
}
