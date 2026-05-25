import type { ProgramDay, WorkoutProgram } from '../types'

export function nextDayInProgram(
  lastKey: string | null,
  program: WorkoutProgram,
): ProgramDay {
  if (!lastKey) return program.days[0]
  const idx = program.days.findIndex(d => d.key === lastKey)
  if (idx === -1) return program.days[0]
  return program.days[(idx + 1) % program.days.length]
}

export function getProjectedDay(
  lastKey: string,
  lastDate: string,
  targetDate: string,
  program: WorkoutProgram,
): ProgramDay {
  const last = new Date(lastDate)
  const target = new Date(targetDate)
  const days = Math.round((target.getTime() - last.getTime()) / 86_400_000)
  let idx = program.days.findIndex(d => d.key === lastKey)
  if (idx === -1) idx = 0
  if (days <= 0) return program.days[idx]
  for (let i = 0; i < days; i++) idx = (idx + 1) % program.days.length
  return program.days[idx]
}
