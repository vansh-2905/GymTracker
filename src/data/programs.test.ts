import { describe, it, expect } from 'vitest'
import { PRESET_PROGRAMS, getProgramById, makeDayKey } from './programs'

describe('PRESET_PROGRAMS', () => {
  it('has 4 presets', () => {
    expect(PRESET_PROGRAMS).toHaveLength(4)
  })

  it('each preset has at least 1 day', () => {
    for (const p of PRESET_PROGRAMS) {
      expect(p.days.length).toBeGreaterThan(0)
    }
  })

  it('each preset has unique day keys within itself', () => {
    for (const p of PRESET_PROGRAMS) {
      const keys = p.days.map(d => d.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it('PPL preset has push, pull, legs keys in order', () => {
    const ppl = PRESET_PROGRAMS.find(p => p.id === 'ppl')!
    expect(ppl.days.map(d => d.key)).toEqual(['push', 'pull', 'legs'])
  })

  it('all presets are marked isPreset: true', () => {
    for (const p of PRESET_PROGRAMS) expect(p.isPreset).toBe(true)
  })
})

describe('getProgramById', () => {
  it('returns PPL when id is undefined', () => {
    expect(getProgramById(undefined).id).toBe('ppl')
  })

  it('returns correct preset by id', () => {
    expect(getProgramById('upper_lower').id).toBe('upper_lower')
    expect(getProgramById('full_body').id).toBe('full_body')
    expect(getProgramById('hiit').id).toBe('hiit')
  })

  it('returns PPL when id not found in presets or custom', () => {
    expect(getProgramById('nonexistent').id).toBe('ppl')
  })

  it('finds custom program by id', () => {
    const custom = [{
      id: 'my_split',
      name: 'My Split',
      isPreset: false,
      days: [{ key: 'chest', label: 'Chest', color: '#F87171' }],
    }]
    expect(getProgramById('my_split', custom).id).toBe('my_split')
  })

  it('prefers preset over custom when ids collide', () => {
    const custom = [{
      id: 'ppl',
      name: 'Fake PPL',
      isPreset: false,
      days: [{ key: 'x', label: 'X', color: '#fff' }],
    }]
    expect(getProgramById('ppl', custom).name).toBe('Push / Pull / Legs')
  })
})

describe('makeDayKey', () => {
  it('lowercases and underscores spaces', () => {
    expect(makeDayKey('Full Body', [])).toBe('full_body')
  })

  it('strips non-alphanumeric characters', () => {
    expect(makeDayKey('Chest & Back', [])).toBe('chest_back')
  })

  it('appends _2 for duplicate', () => {
    expect(makeDayKey('Push', ['push'])).toBe('push_2')
  })

  it('increments suffix until unique', () => {
    expect(makeDayKey('Push', ['push', 'push_2', 'push_3'])).toBe('push_4')
  })

  it('handles empty string with fallback', () => {
    expect(makeDayKey('', [])).toBe('day')
  })
})
