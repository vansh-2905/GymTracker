import type { WorkoutProgram } from '../types'

export const PRESET_PROGRAMS: WorkoutProgram[] = [
  {
    id: 'ppl',
    name: 'Push / Pull / Legs',
    isPreset: true,
    days: [
      { key: 'push', label: 'Push', color: '#60A5FA' },
      { key: 'pull', label: 'Pull', color: '#4ADE80' },
      { key: 'legs', label: 'Legs', color: '#FB923C' },
    ],
  },
  {
    id: 'upper_lower',
    name: 'Upper / Lower',
    isPreset: true,
    days: [
      { key: 'upper', label: 'Upper', color: '#A78BFA' },
      { key: 'lower', label: 'Lower', color: '#F472B6' },
    ],
  },
  {
    id: 'full_body',
    name: 'Full Body',
    isPreset: true,
    days: [{ key: 'full_body', label: 'Full Body', color: '#34D399' }],
  },
  {
    id: 'hiit',
    name: 'HIIT',
    isPreset: true,
    days: [
      { key: 'hiit', label: 'HIIT', color: '#F59E0B' },
      { key: 'strength', label: 'Strength', color: '#6366F1' },
    ],
  },
]

export const CUSTOM_PALETTE = [
  '#F87171', '#FB923C', '#FBBF24', '#34D399',
  '#60A5FA', '#A78BFA', '#F472B6', '#94A3B8',
]

export function getProgramById(
  id: string | undefined,
  customPrograms?: WorkoutProgram[],
): WorkoutProgram {
  const customs = customPrograms ?? []
  if (!id) return PRESET_PROGRAMS[0]
  return (
    PRESET_PROGRAMS.find(p => p.id === id) ??
    customs.find(p => p.id === id) ??
    PRESET_PROGRAMS[0]
  )
}

export function makeDayKey(label: string, existingKeys: string[]): string {
  const base =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'day'
  if (!existingKeys.includes(base)) return base
  let i = 2
  while (existingKeys.includes(`${base}_${i}`)) i++
  return `${base}_${i}`
}
