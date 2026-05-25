import { describe, it, expect } from 'vitest'
import { nextDayInProgram, getProjectedDay } from './rotation'
import type { WorkoutProgram } from '../types'

const ppl: WorkoutProgram = {
  id: 'ppl', name: 'PPL', isPreset: true,
  days: [
    { key: 'push', label: 'Push', color: '#60A5FA' },
    { key: 'pull', label: 'Pull', color: '#4ADE80' },
    { key: 'legs', label: 'Legs', color: '#FB923C' },
  ],
}

const ul: WorkoutProgram = {
  id: 'upper_lower', name: 'Upper/Lower', isPreset: true,
  days: [
    { key: 'upper', label: 'Upper', color: '#A78BFA' },
    { key: 'lower', label: 'Lower', color: '#F472B6' },
  ],
}

const single: WorkoutProgram = {
  id: 'full_body', name: 'Full Body', isPreset: true,
  days: [{ key: 'full_body', label: 'Full Body', color: '#34D399' }],
}

describe('nextDayInProgram', () => {
  it('returns first day when lastKey is null', () => {
    expect(nextDayInProgram(null, ppl).key).toBe('push')
  })

  it('cycles push → pull → legs → push for PPL', () => {
    expect(nextDayInProgram('push', ppl).key).toBe('pull')
    expect(nextDayInProgram('pull', ppl).key).toBe('legs')
    expect(nextDayInProgram('legs', ppl).key).toBe('push')
  })

  it('cycles upper → lower → upper for Upper/Lower', () => {
    expect(nextDayInProgram('upper', ul).key).toBe('lower')
    expect(nextDayInProgram('lower', ul).key).toBe('upper')
  })

  it('single-day program always returns same day', () => {
    expect(nextDayInProgram('full_body', single).key).toBe('full_body')
    expect(nextDayInProgram(null, single).key).toBe('full_body')
  })

  it('returns first day when lastKey not found in program', () => {
    expect(nextDayInProgram('unknown_key', ppl).key).toBe('push')
  })
})

describe('getProjectedDay', () => {
  it('returns current day when target equals last date', () => {
    expect(getProjectedDay('push', '2024-01-01', '2024-01-01', ppl).key).toBe('push')
  })

  it('advances by 1 day', () => {
    expect(getProjectedDay('push', '2024-01-01', '2024-01-02', ppl).key).toBe('pull')
  })

  it('advances by 2 days', () => {
    expect(getProjectedDay('push', '2024-01-01', '2024-01-03', ppl).key).toBe('legs')
  })

  it('wraps correctly after a full cycle', () => {
    expect(getProjectedDay('push', '2024-01-01', '2024-01-04', ppl).key).toBe('push')
  })

  it('wraps upper/lower over many days', () => {
    // 2 days after upper → upper again
    expect(getProjectedDay('upper', '2024-01-01', '2024-01-03', ul).key).toBe('upper')
    // 3 days after upper → lower
    expect(getProjectedDay('upper', '2024-01-01', '2024-01-04', ul).key).toBe('lower')
  })

  it('single-day program always returns same day regardless of distance', () => {
    expect(getProjectedDay('full_body', '2024-01-01', '2024-01-10', single).key).toBe('full_body')
  })

  it('returns first day when lastKey not found in program', () => {
    // 1 day advance from idx=0 (fallback)
    expect(getProjectedDay('unknown', '2024-01-01', '2024-01-02', ppl).key).toBe('pull')
  })
})
