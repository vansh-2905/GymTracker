import { describe, it, expect } from 'vitest'
import { nextWorkoutType, getProjectedType } from './ppl'

describe('nextWorkoutType', () => {
  it('returns pull after push', () => {
    expect(nextWorkoutType('push')).toBe('pull')
  })
  it('returns legs after pull', () => {
    expect(nextWorkoutType('pull')).toBe('legs')
  })
  it('returns push after legs', () => {
    expect(nextWorkoutType('legs')).toBe('push')
  })
  it('returns push when no previous workout', () => {
    expect(nextWorkoutType(null)).toBe('push')
  })
})

describe('getProjectedType', () => {
  it('returns push 1 day after legs', () => {
    expect(getProjectedType('legs', '2026-05-17', '2026-05-18')).toBe('push')
  })
  it('returns same type when date is same as last workout', () => {
    expect(getProjectedType('push', '2026-05-17', '2026-05-17')).toBe('push')
  })
  it('returns correct type cycling 3 days forward', () => {
    // legs → push → pull → legs (3 days forward = legs again)
    expect(getProjectedType('legs', '2026-05-15', '2026-05-18')).toBe('legs')
  })
})
