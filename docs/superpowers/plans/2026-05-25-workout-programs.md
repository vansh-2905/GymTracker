# Workout Programs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded Push/Pull/Legs rotation with a first-class `WorkoutProgram` concept — presets (PPL, Upper/Lower, Full Body, HIIT) plus user-created custom programs — reflected everywhere: TodayScreen, CalendarScreen, ExercisesScreen templates, and Settings/Onboarding.

**Architecture:** `WorkoutType` widens to `string`; a new `WorkoutProgram` type holds an ordered `ProgramDay[]` rotation. Preset programs live in `src/data/programs.ts`. `src/utils/rotation.ts` replaces `ppl.ts` with sequence-agnostic logic. Active program is stored in `UserProfile.activeProgramId`; calendar projections, next-day labels, and template tabs all derive from it at runtime.

**Tech Stack:** React 18, TypeScript strict, Firebase/Firestore, Tailwind CSS v3, Vitest

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `src/data/programs.ts` | PRESET_PROGRAMS, getProgramById, makeDayKey, CUSTOM_PALETTE |
| Create | `src/data/programs.test.ts` | Structural tests for preset data + helpers |
| Create | `src/utils/rotation.ts` | nextDayInProgram, getProjectedDay — sequence-agnostic |
| Create | `src/utils/rotation.test.ts` | Full TDD coverage for rotation logic |
| Delete | `src/utils/ppl.ts` | Replaced by rotation.ts (Task 9) |
| Modify | `src/types/index.ts` | Add ProgramDay, WorkoutProgram; update UserProfile |
| Modify | `src/services/profileService.ts` | Add setActiveProgramId, saveCustomPrograms; update initProfile |
| Modify | `src/screens/TodayScreen.tsx` | Load active program; use rotation.ts for next day |
| Modify | `src/screens/CalendarScreen.tsx` | Program-aware dot colors and projections |
| Modify | `src/screens/SettingsScreen.tsx` | Add WORKOUT PROGRAM section with picker + custom builder |
| Modify | `src/screens/OnboardingScreen.tsx` | Add program picker as step 1 |
| Modify | `src/screens/ExercisesScreen.tsx` | Templates driven by active program days |

---

## Task 1: Core Types + Preset Programs Data

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/data/programs.ts`
- Create: `src/data/programs.test.ts`

- [ ] **Step 1: Update `src/types/index.ts`**

Replace the file entirely:

```typescript
export type WorkoutType = string
export type WeightUnit = 'kg' | 'lbs'
export type BiologicalSex = 'male' | 'female'
export type FitnessLevel = 'beginner' | 'intermediate' | 'active' | 'advanced' | 'athlete'
export type PrimaryGoal = 'weight_loss' | 'muscle_gain' | 'maintenance' | 'endurance' | 'general_health'

export interface ProgramDay {
  key: string
  label: string
  color: string
}

export interface WorkoutProgram {
  id: string
  name: string
  days: ProgramDay[]
  isPreset: boolean
}

export interface UserProfile {
  lastWorkoutType: WorkoutType | null
  lastWorkoutDate: string | null
  weightUnit: WeightUnit
  restDefaultSeconds?: number
  activeProgramId?: string
  customPrograms?: WorkoutProgram[]
}

export interface FitnessProfile {
  biologicalSex: BiologicalSex
  age: number
  heightCm: number
  bodyWeightKg: number
  fitnessLevel: FitnessLevel
  primaryGoal: PrimaryGoal
  bodyFatPct: string | null
  userMetFactor: number
  skipped: boolean
  completedAt: string
}

export interface Exercise {
  id: string
  name: string
  category: WorkoutType
  muscleGroup: string
}

export interface Template {
  type: WorkoutType
  exerciseIds: string[]
}

export interface WorkoutSet {
  id: string
  exerciseId: string
  exerciseName: string
  setNumber: number
  reps: number
  weight: number
  activeDuration: number
  restDuration: number
  kcal?: number
  createdAt: Date
}

export interface Workout {
  date: string
  type: WorkoutType
  startTime: Date
  endTime: Date | null
  completed: boolean
}

export interface ChatMessage {
  id?: string
  role: 'user' | 'assistant'
  content: string
  createdAt?: Date
}
```

- [ ] **Step 2: Write failing tests for programs data**

Create `src/data/programs.test.ts`:

```typescript
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
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run src/data/programs.test.ts
```

Expected: FAIL — `Cannot find module './programs'`

- [ ] **Step 4: Create `src/data/programs.ts`**

```typescript
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
  customPrograms: WorkoutProgram[] = [],
): WorkoutProgram {
  if (!id) return PRESET_PROGRAMS[0]
  return (
    PRESET_PROGRAMS.find(p => p.id === id) ??
    customPrograms.find(p => p.id === id) ??
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
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/data/programs.test.ts
```

Expected: all tests PASS

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors (WorkoutType widening may produce new errors in screens — note them but do not fix yet; they will be resolved in later tasks)

- [ ] **Step 7: Commit**

```bash
git add src/types/index.ts src/data/programs.ts src/data/programs.test.ts
git commit -m "feat: add ProgramDay/WorkoutProgram types and preset programs data"
```

---

## Task 2: rotation.ts (TDD)

**Files:**
- Create: `src/utils/rotation.test.ts`
- Create: `src/utils/rotation.ts`

- [ ] **Step 1: Write failing tests**

Create `src/utils/rotation.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/utils/rotation.test.ts
```

Expected: FAIL — `Cannot find module './rotation'`

- [ ] **Step 3: Create `src/utils/rotation.ts`**

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/utils/rotation.test.ts
```

Expected: all 13 tests PASS

- [ ] **Step 5: Run all tests**

```bash
npx vitest run
```

Expected: existing 36 tests + 5 programs tests + 13 rotation tests = 54+ PASS

- [ ] **Step 6: Commit**

```bash
git add src/utils/rotation.ts src/utils/rotation.test.ts
git commit -m "feat: add rotation.ts — sequence-agnostic workout day cycling"
```

---

## Task 3: profileService Updates

**Files:**
- Modify: `src/services/profileService.ts`

- [ ] **Step 1: Replace `src/services/profileService.ts`**

```typescript
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { UserProfile, WorkoutProgram, WorkoutType } from '../types'

function profileRef(uid: string) {
  return doc(db, 'users', uid, 'data', 'profile')
}

export async function getProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(profileRef(uid))
  if (!snap.exists()) return null
  return snap.data() as UserProfile
}

export async function initProfile(uid: string): Promise<UserProfile> {
  const profile: UserProfile = {
    lastWorkoutType: null,
    lastWorkoutDate: null,
    weightUnit: 'kg',
    activeProgramId: 'ppl',
  }
  await setDoc(profileRef(uid), profile)
  return profile
}

export async function updateLastWorkout(
  uid: string,
  type: WorkoutType,
  date: string,
): Promise<void> {
  await updateDoc(profileRef(uid), { lastWorkoutType: type, lastWorkoutDate: date })
}

export async function updateWeightUnit(uid: string, unit: 'kg' | 'lbs'): Promise<void> {
  await updateDoc(profileRef(uid), { weightUnit: unit })
}

export async function updateRestDefault(uid: string, seconds: number): Promise<void> {
  await updateDoc(profileRef(uid), { restDefaultSeconds: seconds })
}

// Uses setDoc+merge so it works even if profile doc doesn't exist yet (onboarding)
export async function setActiveProgramId(uid: string, programId: string): Promise<void> {
  await setDoc(
    profileRef(uid),
    { activeProgramId: programId, lastWorkoutType: null },
    { merge: true },
  )
}

export async function saveCustomPrograms(
  uid: string,
  customPrograms: WorkoutProgram[],
): Promise<void> {
  await updateDoc(profileRef(uid), { customPrograms })
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 new errors from profileService itself (screen errors from WorkoutType widening are pre-existing)

- [ ] **Step 3: Commit**

```bash
git add src/services/profileService.ts
git commit -m "feat: add setActiveProgramId and saveCustomPrograms to profileService"
```

---

## Task 4: TodayScreen — Active Program Integration

**Files:**
- Modify: `src/screens/TodayScreen.tsx`

- [ ] **Step 1: Replace `src/screens/TodayScreen.tsx`**

```typescript
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { UserProfile, WorkoutSet, ProgramDay } from '../types'
import { getProfile, initProfile, updateLastWorkout } from '../services/profileService'
import { getWorkout, startWorkout, getSets } from '../services/workoutService'
import { getProgramById, PRESET_PROGRAMS } from '../data/programs'
import { nextDayInProgram } from '../utils/rotation'
import type { WorkoutProgram } from '../types'

function todayDate(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

export default function TodayScreen() {
  const { user, signOut } = useAuth()
  const uid = user!.uid
  const navigate = useNavigate()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [activeProgram, setActiveProgram] = useState<WorkoutProgram>(PRESET_PROGRAMS[0])
  const [dueDay, setDueDay] = useState<ProgramDay>(PRESET_PROGRAMS[0].days[0])
  const [todayWorkout, setTodayWorkout] = useState<{ exists: boolean; completed: boolean } | null>(null)
  const [overrideDay, setOverrideDay] = useState<ProgramDay | null>(null)
  const [sessionKcal, setSessionKcal] = useState<number | null>(null)
  const [todaySets, setTodaySets] = useState<WorkoutSet[]>([])
  const [loading, setLoading] = useState(true)

  const date = todayDate()

  useEffect(() => {
    async function load() {
      let p = await getProfile(uid)
      if (!p) p = await initProfile(uid)
      setProfile(p)
      const prog = getProgramById(p.activeProgramId, p.customPrograms)
      setActiveProgram(prog)
      setDueDay(nextDayInProgram(p.lastWorkoutType, prog))
      const existing = await getWorkout(uid, date)
      if (existing) {
        setTodayWorkout({ exists: true, completed: existing.completed })
        const sets = await getSets(uid, date)
        setTodaySets(sets)
        const hasKcal = sets.some(s => s.kcal !== undefined)
        if (hasKcal) {
          setSessionKcal(sets.reduce((sum, s) => sum + (s.kcal ?? 0), 0))
        }
      } else {
        setTodayWorkout({ exists: false, completed: false })
      }
      setLoading(false)
    }
    load()
  }, [uid, date])

  const selectedDay = overrideDay ?? dueDay
  const color = selectedDay.color

  const handleStart = async () => {
    await startWorkout(uid, date, selectedDay.key)
    await updateLastWorkout(uid, selectedDay.key, date)
    navigate(`/workout/${date}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-iron-950">
        <div className="w-8 h-8 border-2 border-acid border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-iron-950 flex flex-col">
      <div className="h-0.5 w-full" style={{ backgroundColor: color }} />

      <div className="flex-1 flex flex-col p-5 pt-10">
        <div className="flex justify-between items-start mb-10">
          <div>
            <p className="font-mono text-iron-400 text-[10px] tracking-widest uppercase">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
            <h1 className="font-display text-5xl text-white leading-none mt-1">TODAY</h1>
          </div>
          <button
            onClick={signOut}
            className="font-mono text-iron-500 text-[10px] uppercase tracking-wider hover:text-iron-300 transition-colors mt-1"
          >
            Sign out
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center mb-10">
          <p className="font-mono text-iron-500 text-[10px] tracking-widest uppercase mb-4">Due today</p>
          <div
            className="font-display leading-none text-center"
            style={{ fontSize: 'clamp(5rem, 28vw, 9rem)', color }}
          >
            {selectedDay.label.toUpperCase()}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-px w-8 bg-iron-700" />
            <p className="font-mono text-iron-500 text-[10px] tracking-widest uppercase">
              {profile?.weightUnit ?? 'kg'} · {user?.displayName?.split(' ')[0]}
            </p>
            <div className="h-px w-8 bg-iron-700" />
          </div>
        </div>

        {todayWorkout?.exists && todaySets.length > 0 && (() => {
          const grouped = todaySets.reduce<Record<string, WorkoutSet[]>>((acc, s) => {
            if (!acc[s.exerciseName]) acc[s.exerciseName] = []
            acc[s.exerciseName].push(s)
            return acc
          }, {})
          return (
            <div className="mb-5">
              <p className="font-mono text-iron-500 text-[10px] tracking-widest uppercase mb-2">Today's sets</p>
              <div className="border border-iron-800 divide-y divide-iron-800">
                {Object.entries(grouped).map(([name, sets]) => {
                  const lastWeight = sets[sets.length - 1].weight
                  const unit = profile?.weightUnit ?? 'kg'
                  return (
                    <div key={name} className="flex justify-between items-center py-2 px-3">
                      <span className="font-mono text-white text-[11px] uppercase tracking-wide">{name}</span>
                      <span className="font-mono text-iron-400 text-[10px] tracking-wider">
                        {sets.length} {sets.length === 1 ? 'set' : 'sets'} · {lastWeight}{unit}
                        {sets.some(s => s.kcal !== undefined) && (
                          <span className="text-acid ml-2">{Math.round(sets.reduce((s, x) => s + (x.kcal ?? 0), 0))} kcal</span>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Type override — driven by active program days */}
        <div className="mb-4">
          <p className="font-mono text-iron-500 text-[10px] tracking-widest uppercase mb-2">Override</p>
          <div className="flex border border-iron-700">
            {activeProgram.days.map((day, i) => (
              <button
                key={day.key}
                onClick={() => setOverrideDay(day.key === dueDay.key && overrideDay?.key === day.key ? null : day)}
                className="flex-1 py-3 font-mono text-xs uppercase tracking-wider transition-colors"
                style={{
                  backgroundColor: selectedDay.key === day.key ? day.color + '22' : 'transparent',
                  color: selectedDay.key === day.key ? day.color : '#555',
                  borderRight: i < activeProgram.days.length - 1 ? '1px solid #222' : 'none',
                }}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>

        {todayWorkout?.exists ? (
          <button
            onClick={() => navigate(`/workout/${date}`)}
            className="w-full py-5 font-sans font-bold uppercase text-sm text-black transition-opacity active:opacity-80"
            style={{ backgroundColor: color, letterSpacing: '0.12em' }}
          >
            {todayWorkout.completed ? "View Today's Workout" : 'Continue Workout'}
          </button>
        ) : (
          <button
            onClick={handleStart}
            className="w-full py-5 font-sans font-bold uppercase text-sm text-black transition-opacity active:opacity-80"
            style={{ backgroundColor: color, letterSpacing: '0.12em' }}
          >
            Start {selectedDay.label} Workout
          </button>
        )}
        {sessionKcal !== null && sessionKcal > 0 && (
          <p className="font-mono text-iron-400 text-[12px] tracking-widest mt-3">
            {Math.round(sessionKcal)} KCAL BURNED TODAY
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check and test**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: 0 type errors, all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/screens/TodayScreen.tsx
git commit -m "feat: TodayScreen uses active program for next day and override buttons"
```

---

## Task 5: CalendarScreen — Program-Aware Projections

**Files:**
- Modify: `src/screens/CalendarScreen.tsx`

- [ ] **Step 1: Replace `src/screens/CalendarScreen.tsx`**

```typescript
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { Workout, WorkoutSet } from '../types'
import { getWorkoutsInRange, getSets, startWorkout } from '../services/workoutService'
import { getProfile, updateLastWorkout } from '../services/profileService'
import { getProgramById, PRESET_PROGRAMS } from '../data/programs'
import { getProjectedDay } from '../utils/rotation'
import WorkoutSummary from '../components/WorkoutSummary'
import type { WorkoutProgram } from '../types'

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}
function pad(n: number) {
  return n.toString().padStart(2, '0')
}

export default function CalendarScreen() {
  const { user } = useAuth()
  const uid = user!.uid
  const navigate = useNavigate()

  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [workouts, setWorkouts] = useState<Record<string, Workout>>({})
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null)
  const [selectedSets, setSelectedSets] = useState<WorkoutSet[]>([])
  const [weightUnit, setWeightUnit] = useState('kg')
  const [lastType, setLastType] = useState<string | null>(null)
  const [lastDate, setLastDate] = useState<string | null>(null)
  const [activeProgram, setActiveProgram] = useState<WorkoutProgram>(PRESET_PROGRAMS[0])
  const [startModal, setStartModal] = useState<{ date: string; dayKey: string } | null>(null)

  useEffect(() => {
    const start = `${viewYear}-${pad(viewMonth + 1)}-01`
    const end = `${viewYear}-${pad(viewMonth + 1)}-${pad(getDaysInMonth(viewYear, viewMonth))}`
    getWorkoutsInRange(uid, start, end).then(list => {
      const map: Record<string, Workout> = {}
      list.forEach(w => { map[w.date] = w })
      setWorkouts(map)
    })
    getProfile(uid).then(p => {
      if (p) {
        setWeightUnit(p.weightUnit)
        setLastType(p.lastWorkoutType)
        setLastDate(p.lastWorkoutDate)
        setActiveProgram(getProgramById(p.activeProgramId, p.customPrograms))
      }
    })
  }, [uid, viewYear, viewMonth])

  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

  function dayColor(dayKey: string): string {
    return activeProgram.days.find(d => d.key === dayKey)?.color ?? '#E8FF3D'
  }

  const handleDayPress = async (dateStr: string) => {
    if (dateStr > today) return
    const w = workouts[dateStr]
    if (w) {
      const sets = await getSets(uid, dateStr)
      setSelectedSets(sets)
      setSelectedWorkout(w)
    } else {
      const projectedKey = lastType && lastDate
        ? getProjectedDay(lastType, lastDate, dateStr, activeProgram).key
        : activeProgram.days[0].key
      setStartModal({ date: dateStr, dayKey: projectedKey })
    }
  }

  const handleStartPastWorkout = async () => {
    if (!startModal) return
    await startWorkout(uid, startModal.date, startModal.dayKey)
    await updateLastWorkout(uid, startModal.dayKey, startModal.date)
    setStartModal(null)
    navigate(`/workout/${startModal.date}`)
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth)
  const monthName = new Date(viewYear, viewMonth).toLocaleString('default', { month: 'long' })

  return (
    <div className="min-h-screen bg-iron-950 pb-24">
      <div className="h-0.5 bg-acid w-full" />

      <div className="px-5 pt-10 pb-4">
        <h1 className="font-display text-5xl text-white leading-none">LOG</h1>
        <p className="font-mono text-iron-500 text-[10px] uppercase tracking-widest mt-1">Workout History</p>
      </div>

      <div className="flex items-center justify-between px-5 mb-4">
        <button onClick={prevMonth} className="font-mono text-iron-400 text-sm hover:text-white transition-colors px-2 py-1">‹ PREV</button>
        <div className="text-center">
          <p className="font-display text-2xl text-white tracking-wide">{monthName.toUpperCase()}</p>
          <p className="font-mono text-iron-500 text-[10px]">{viewYear}</p>
        </div>
        <button onClick={nextMonth} className="font-mono text-iron-400 text-sm hover:text-white transition-colors px-2 py-1">NEXT ›</button>
      </div>

      <div className="grid grid-cols-7 px-5 mb-1">
        {['SU','MO','TU','WE','TH','FR','SA'].map(d => (
          <div key={d} className="text-center font-mono text-iron-600 text-[9px] py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px px-5">
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
          const workout = workouts[dateStr]
          const isToday = dateStr === today
          const isFuture = dateStr > today
          const wColor = workout ? dayColor(workout.type) : null

          let projectedColor: string | null = null
          if (isFuture && lastType && lastDate) {
            projectedColor = getProjectedDay(lastType, lastDate, dateStr, activeProgram).color
          }

          return (
            <button
              key={dateStr}
              onClick={() => handleDayPress(dateStr)}
              disabled={isFuture}
              className="aspect-square flex flex-col items-center justify-center relative transition-colors"
              style={{
                backgroundColor: workout ? wColor + '15' : isToday ? '#E8FF3D08' : 'transparent',
                outline: isToday ? '1px solid #E8FF3D40' : workout ? `1px solid ${wColor}30` : '1px solid #1A1A1A',
              }}
            >
              <span
                className="font-mono text-xs font-bold"
                style={{ color: isToday ? '#E8FF3D' : isFuture ? '#2A2A2A' : '#AAAAAA' }}
              >
                {day}
              </span>
              {workout && (
                <span
                  className="w-1.5 h-1.5 rounded-full mt-0.5"
                  style={{ backgroundColor: wColor ?? '#fff', opacity: workout.completed ? 1 : 0.4 }}
                />
              )}
              {!workout && isFuture && projectedColor && (
                <span
                  className="w-1 h-1 rounded-full mt-0.5"
                  style={{ backgroundColor: projectedColor, opacity: 0.15 }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Legend — driven by active program */}
      <div className="flex gap-4 px-5 mt-4 justify-center flex-wrap">
        {activeProgram.days.map(d => (
          <div key={d.key} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="font-mono text-iron-500 text-[9px] uppercase tracking-wider">{d.label}</span>
          </div>
        ))}
      </div>

      {selectedWorkout && (
        <WorkoutSummary
          workout={selectedWorkout}
          sets={selectedSets}
          weightUnit={weightUnit}
          onClose={() => setSelectedWorkout(null)}
          onEdit={() => {
            setSelectedWorkout(null)
            navigate(`/workout/${selectedWorkout.date}`)
          }}
        />
      )}

      {startModal && (
        <div className="fixed inset-0 bg-black/85 flex items-end z-50" onClick={() => setStartModal(null)}>
          <div
            className="bg-iron-900 w-full border-t-2"
            style={{ borderColor: dayColor(startModal.dayKey) }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 flex flex-col gap-4">
              <div>
                <p className="font-mono text-iron-500 text-[10px] uppercase tracking-widest">{startModal.date}</p>
                <h2 className="font-display text-3xl text-white mt-1">LOG WORKOUT</h2>
              </div>
              <div className="flex border border-iron-700">
                {activeProgram.days.map((day, i) => (
                  <button
                    key={day.key}
                    onClick={() => setStartModal(m => m ? { ...m, dayKey: day.key } : m)}
                    className="flex-1 py-3 font-mono text-xs uppercase tracking-wider transition-colors"
                    style={{
                      backgroundColor: startModal.dayKey === day.key ? day.color + '20' : 'transparent',
                      color: startModal.dayKey === day.key ? day.color : '#555',
                      borderRight: i < activeProgram.days.length - 1 ? '1px solid #222' : 'none',
                    }}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStartModal(null)}
                  className="flex-1 py-4 border border-iron-600 font-mono text-xs uppercase tracking-wider text-iron-400"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartPastWorkout}
                  className="flex-1 py-4 font-sans font-bold uppercase text-sm text-black"
                  style={{ backgroundColor: dayColor(startModal.dayKey), letterSpacing: '0.12em' }}
                >
                  Start {activeProgram.days.find(d => d.key === startModal.dayKey)?.label ?? startModal.dayKey}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check and test**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: 0 errors, all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/screens/CalendarScreen.tsx
git commit -m "feat: CalendarScreen uses active program for dot colors and projections"
```

---

## Task 6: SettingsScreen — Workout Program Section

**Files:**
- Modify: `src/screens/SettingsScreen.tsx`

- [ ] **Step 1: Replace `src/screens/SettingsScreen.tsx`**

Add a "WORKOUT PROGRAM" section between Preferences and Calorie Profile. It shows the current program name + day color chips, and a "Change" button that opens a bottom-sheet with preset rows, custom program rows (with delete), and a "Create Custom" row. Tapping "Create Custom" opens an inline custom builder (name + day list with +/− buttons). Saving a custom program calls `saveCustomPrograms`; switching calls `setActiveProgramId`.

```typescript
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import {
  getProfile,
  updateWeightUnit,
  updateRestDefault,
  setActiveProgramId,
  saveCustomPrograms,
} from '../services/profileService'
import { getFitnessProfile, saveFitnessProfile } from '../services/fitnessProfileService'
import { computeUserMetFactor } from '../utils/calorieCalc'
import { getProgramById, PRESET_PROGRAMS, CUSTOM_PALETTE, makeDayKey } from '../data/programs'
import type {
  UserProfile, FitnessProfile, BiologicalSex, FitnessLevel,
  PrimaryGoal, WeightUnit, WorkoutProgram, ProgramDay,
} from '../types'

type EditingField =
  | 'biologicalSex' | 'age' | 'heightCm' | 'bodyWeightKg'
  | 'fitnessLevel' | 'primaryGoal' | 'bodyFatPct' | null

const FITNESS_LEVEL_LABELS: Record<FitnessLevel, string> = {
  beginner: 'Beginner', intermediate: 'Intermediate', active: 'Active',
  advanced: 'Advanced', athlete: 'Athlete',
}

const GOAL_LABELS: Record<PrimaryGoal, string> = {
  weight_loss: 'Weight Loss', muscle_gain: 'Muscle Gain', maintenance: 'Maintenance',
  endurance: 'Endurance', general_health: 'General Health',
}

export default function SettingsScreen() {
  const { user, signOut } = useAuth()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [fp, setFp] = useState<FitnessProfile | null>(null)
  const [activeProgram, setActiveProgram] = useState<WorkoutProgram>(PRESET_PROGRAMS[0])
  const [customPrograms, setCustomPrograms] = useState<WorkoutProgram[]>([])
  const [editingField, setEditingField] = useState<EditingField>(null)
  const [tempValue, setTempValue] = useState<string>('')
  const [restInput, setRestInput] = useState('')
  const [savedField, setSavedField] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Program picker state
  const [showProgramPicker, setShowProgramPicker] = useState(false)
  const [showCustomBuilder, setShowCustomBuilder] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customDays, setCustomDays] = useState<{ label: string }[]>([{ label: '' }])

  useEffect(() => {
    if (!user) return
    Promise.all([getProfile(user.uid), getFitnessProfile(user.uid)]).then(
      ([profile, fitnessProfile]) => {
        setUserProfile(profile)
        setFp(fitnessProfile)
        setRestInput(String(profile?.restDefaultSeconds ?? 90))
        const customs = profile?.customPrograms ?? []
        setCustomPrograms(customs)
        setActiveProgram(getProgramById(profile?.activeProgramId, customs))
      },
    )
  }, [user])

  const flashSaved = (field: string) => {
    setSavedField(field)
    setTimeout(() => setSavedField(null), 1500)
  }

  const flashError = (msg: string) => {
    setErrorMsg(msg)
    setTimeout(() => setErrorMsg(null), 3000)
  }

  const handleWeightUnit = async (unit: WeightUnit) => {
    if (!user || !userProfile) return
    try {
      await updateWeightUnit(user.uid, unit)
      setUserProfile({ ...userProfile, weightUnit: unit })
      flashSaved('weightUnit')
    } catch {
      flashError('Failed to save weight unit')
    }
  }

  const handleRestBlur = async () => {
    if (!user) return
    const parsed = parseInt(restInput, 10)
    if (isNaN(parsed) || parsed < 10) {
      setRestInput(String(userProfile?.restDefaultSeconds ?? 90))
      return
    }
    const clamped = Math.min(parsed, 600)
    try {
      await updateRestDefault(user.uid, clamped)
      setRestInput(String(clamped))
      if (userProfile) setUserProfile({ ...userProfile, restDefaultSeconds: clamped })
      flashSaved('rest')
    } catch {
      setRestInput(String(userProfile?.restDefaultSeconds ?? 90))
      flashError('Failed to save rest timer')
    }
  }

  const handleSelectProgram = async (programId: string) => {
    if (!user) return
    try {
      await setActiveProgramId(user.uid, programId)
      const prog = getProgramById(programId, customPrograms)
      setActiveProgram(prog)
      if (userProfile) setUserProfile({ ...userProfile, activeProgramId: programId, lastWorkoutType: null })
      setShowProgramPicker(false)
      flashSaved('program')
    } catch {
      flashError('Failed to save program')
    }
  }

  const handleDeleteCustom = async (programId: string) => {
    if (!user) return
    const updated = customPrograms.filter(p => p.id !== programId)
    try {
      await saveCustomPrograms(user.uid, updated)
      setCustomPrograms(updated)
      if (activeProgram.id === programId) {
        await setActiveProgramId(user.uid, 'ppl')
        setActiveProgram(PRESET_PROGRAMS[0])
      }
    } catch {
      flashError('Failed to delete program')
    }
  }

  const handleSaveCustom = async () => {
    if (!user || !customName.trim()) return
    const validDays = customDays.filter(d => d.label.trim())
    if (validDays.length === 0) return
    const keys: string[] = []
    const days: ProgramDay[] = validDays.map((d, i) => {
      const key = makeDayKey(d.label, keys)
      keys.push(key)
      return { key, label: d.label.trim(), color: CUSTOM_PALETTE[i % CUSTOM_PALETTE.length] }
    })
    const newProgram: WorkoutProgram = {
      id: crypto.randomUUID(),
      name: customName.trim(),
      days,
      isPreset: false,
    }
    const updated = [...customPrograms, newProgram]
    try {
      await saveCustomPrograms(user.uid, updated)
      setCustomPrograms(updated)
      setShowCustomBuilder(false)
      setShowProgramPicker(false)
      setCustomName('')
      setCustomDays([{ label: '' }])
      await handleSelectProgram(newProgram.id)
    } catch {
      flashError('Failed to save custom program')
    }
  }

  const openEditField = (field: EditingField) => {
    if (!fp || field === null) return
    const current: Record<string, string> = {
      biologicalSex: fp.biologicalSex,
      age: String(fp.age),
      heightCm: String(fp.heightCm),
      bodyWeightKg: String(fp.bodyWeightKg),
      fitnessLevel: fp.fitnessLevel,
      primaryGoal: fp.primaryGoal,
      bodyFatPct: fp.bodyFatPct ?? '',
    }
    setTempValue(current[field] ?? '')
    setEditingField(field)
  }

  const saveField = async (field: EditingField, value: string) => {
    if (!user || !fp || field === null) return
    const updated: FitnessProfile = { ...fp }
    if (field === 'biologicalSex') {
      updated.biologicalSex = value as BiologicalSex
    } else if (field === 'age') {
      const v = parseInt(value, 10)
      if (isNaN(v) || v <= 0) return
      updated.age = v
    } else if (field === 'heightCm') {
      const v = parseFloat(value)
      if (isNaN(v) || v <= 0) return
      updated.heightCm = v
    } else if (field === 'bodyWeightKg') {
      const v = parseFloat(value)
      if (isNaN(v) || v <= 0) return
      updated.bodyWeightKg = v
    } else if (field === 'fitnessLevel') {
      updated.fitnessLevel = value as FitnessLevel
    } else if (field === 'primaryGoal') {
      updated.primaryGoal = value as PrimaryGoal
    } else if (field === 'bodyFatPct') {
      updated.bodyFatPct = value === '' ? null : value
    }
    updated.userMetFactor = computeUserMetFactor(updated.biologicalSex, updated.age, updated.fitnessLevel)
    try {
      await saveFitnessProfile(user.uid, updated)
      setFp(updated)
      setEditingField(null)
      flashSaved(field)
    } catch {
      flashError('Failed to save profile')
    }
  }

  const showCalorieProfile = fp !== null && !fp.skipped

  return (
    <div className="min-h-screen bg-iron-950 text-white pb-24">
      <div className="h-0.5 bg-acid" />
      {errorMsg && (
        <div className="mx-5 mt-3 px-4 py-2 bg-red-900/40 border border-red-700">
          <span className="font-mono text-[10px] uppercase tracking-widest text-red-400">{errorMsg}</span>
        </div>
      )}
      <div className="px-5 pt-6 pb-4">
        <h1 className="font-display text-3xl tracking-wide text-white">SETTINGS</h1>
      </div>

      {/* Preferences */}
      <div className="mx-5 mb-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-iron-400 mb-2">Preferences</p>
        <div className="bg-iron-900 border border-iron-700">
          <div className="px-4 py-3 flex items-center justify-between border-b border-iron-700">
            <span className="font-mono text-[11px] uppercase tracking-widest text-iron-300">Weight Unit</span>
            <div className="flex gap-1">
              {(['kg', 'lbs'] as WeightUnit[]).map(u => (
                <button
                  key={u}
                  onClick={() => handleWeightUnit(u)}
                  disabled={!userProfile}
                  className={`px-3 py-1 font-mono text-[11px] uppercase tracking-widest border transition-colors disabled:opacity-40 ${
                    userProfile?.weightUnit === u
                      ? 'bg-acid text-black border-acid'
                      : 'bg-transparent text-iron-400 border-iron-600'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          {savedField === 'weightUnit' && (
            <div className="px-4 py-1 bg-iron-800">
              <span className="font-mono text-[10px] text-acid uppercase tracking-widest">Saved</span>
            </div>
          )}
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-widest text-iron-300">Rest Timer (sec)</span>
            <input
              type="number"
              value={restInput}
              onChange={e => setRestInput(e.target.value)}
              onBlur={handleRestBlur}
              className="w-20 bg-iron-800 border border-iron-600 text-white font-mono text-sm text-right px-2 py-1 focus:outline-none focus:border-acid"
              min={10}
              max={600}
            />
          </div>
          {savedField === 'rest' && (
            <div className="px-4 py-1 bg-iron-800">
              <span className="font-mono text-[10px] text-acid uppercase tracking-widest">Saved</span>
            </div>
          )}
        </div>
      </div>

      {/* Workout Program */}
      <div className="mx-5 mb-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-iron-400 mb-2">Workout Program</p>
        <div className="bg-iron-900 border border-iron-700">
          <div className="px-4 py-3 flex items-center justify-between">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-widest text-iron-300 block mb-1">
                {activeProgram.name}
              </span>
              <div className="flex gap-1.5 flex-wrap">
                {activeProgram.days.map(d => (
                  <span
                    key={d.key}
                    className="px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest"
                    style={{ backgroundColor: d.color + '25', color: d.color, border: `1px solid ${d.color}40` }}
                  >
                    {d.label}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={() => setShowProgramPicker(true)}
              className="font-mono text-[10px] uppercase tracking-widest text-acid border border-acid px-3 py-1.5 active:opacity-70 ml-3 shrink-0"
            >
              Change
            </button>
          </div>
          {savedField === 'program' && (
            <div className="px-4 py-1 bg-iron-800">
              <span className="font-mono text-[10px] text-acid uppercase tracking-widest">Saved</span>
            </div>
          )}
        </div>
      </div>

      {/* Calorie Profile */}
      {showCalorieProfile && fp && (
        <div className="mx-5 mb-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-iron-400 mb-2">Calorie Profile</p>
          <div className="bg-iron-900 border border-iron-700">
            {(
              [
                { field: 'biologicalSex', label: 'Biological Sex', value: fp.biologicalSex === 'male' ? 'Male' : 'Female' },
                { field: 'age', label: 'Age', value: `${fp.age} yrs` },
                { field: 'heightCm', label: 'Height', value: `${fp.heightCm} cm` },
                { field: 'bodyWeightKg', label: 'Body Weight', value: `${fp.bodyWeightKg} kg` },
                { field: 'fitnessLevel', label: 'Fitness Level', value: FITNESS_LEVEL_LABELS[fp.fitnessLevel] },
                { field: 'primaryGoal', label: 'Primary Goal', value: GOAL_LABELS[fp.primaryGoal] },
                { field: 'bodyFatPct', label: 'Body Fat %', value: fp.bodyFatPct ? `${fp.bodyFatPct}%` : '—' },
              ] as { field: EditingField; label: string; value: string }[]
            ).map(({ field, label, value }, i, arr) => (
              <div key={field as string}>
                <button
                  onClick={() => openEditField(field)}
                  className={`w-full px-4 py-3 flex items-center justify-between active:bg-iron-800 ${
                    i < arr.length - 1 ? 'border-b border-iron-700' : ''
                  }`}
                >
                  <span className="font-mono text-[11px] uppercase tracking-widest text-iron-300">{label}</span>
                  <div className="flex items-center gap-2">
                    {savedField === field && (
                      <span className="font-mono text-[10px] text-acid uppercase tracking-widest">Saved</span>
                    )}
                    <span className="font-mono text-sm text-white">{value}</span>
                    <span className="text-iron-500 text-xs">›</span>
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Account */}
      <div className="mx-5 mb-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-iron-400 mb-2">Account</p>
        <div className="bg-iron-900 border border-iron-700">
          <div className="px-4 py-3 flex items-center gap-3 border-b border-iron-700">
            {user?.photoURL && (
              <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full" />
            )}
            <div>
              <p className="font-sans text-sm text-white">{user?.displayName}</p>
              <p className="font-mono text-[10px] text-iron-400">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="w-full px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-red-400 text-left active:bg-iron-800"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Calorie profile bottom-sheet modal (unchanged logic) */}
      {editingField !== null && fp && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setEditingField(null)} />
          <div className="relative bg-iron-900 border-t-2 border-acid px-5 pt-5 pb-10">
            <p className="font-mono text-[10px] uppercase tracking-widest text-iron-400 mb-4">
              {editingField === 'biologicalSex' && 'Biological Sex'}
              {editingField === 'age' && 'Age (years)'}
              {editingField === 'heightCm' && 'Height (cm)'}
              {editingField === 'bodyWeightKg' && 'Body Weight (kg)'}
              {editingField === 'fitnessLevel' && 'Fitness Level'}
              {editingField === 'primaryGoal' && 'Primary Goal'}
              {editingField === 'bodyFatPct' && 'Body Fat % (optional)'}
            </p>
            {editingField === 'biologicalSex' && (
              <div className="flex gap-3">
                {(['male', 'female'] as BiologicalSex[]).map(s => (
                  <button key={s} onClick={() => saveField('biologicalSex', s)}
                    className={`flex-1 py-3 font-mono text-[11px] uppercase tracking-widest border ${fp.biologicalSex === s ? 'bg-acid text-black border-acid' : 'border-iron-600 text-white'}`}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            {(editingField === 'age' || editingField === 'heightCm' || editingField === 'bodyWeightKg') && (
              <div className="flex gap-3">
                <input autoFocus type="number" value={tempValue} onChange={e => setTempValue(e.target.value)}
                  className="flex-1 bg-iron-800 border border-iron-600 text-white font-mono text-lg px-4 py-3 focus:outline-none focus:border-acid" />
                <button onClick={() => saveField(editingField, tempValue)}
                  className="px-6 py-3 bg-acid text-black font-mono text-[11px] uppercase tracking-widest">Save</button>
              </div>
            )}
            {editingField === 'fitnessLevel' && (
              <div className="flex flex-col gap-2">
                {(Object.keys(FITNESS_LEVEL_LABELS) as FitnessLevel[]).map(level => (
                  <button key={level} onClick={() => saveField('fitnessLevel', level)}
                    className={`w-full py-3 font-mono text-[11px] uppercase tracking-widest border text-left px-4 ${fp.fitnessLevel === level ? 'bg-acid text-black border-acid' : 'border-iron-600 text-white'}`}>
                    {FITNESS_LEVEL_LABELS[level]}
                  </button>
                ))}
              </div>
            )}
            {editingField === 'primaryGoal' && (
              <div className="flex flex-col gap-2">
                {(Object.keys(GOAL_LABELS) as PrimaryGoal[]).map(goal => (
                  <button key={goal} onClick={() => saveField('primaryGoal', goal)}
                    className={`w-full py-3 font-mono text-[11px] uppercase tracking-widest border text-left px-4 ${fp.primaryGoal === goal ? 'bg-acid text-black border-acid' : 'border-iron-600 text-white'}`}>
                    {GOAL_LABELS[goal]}
                  </button>
                ))}
              </div>
            )}
            {editingField === 'bodyFatPct' && (
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <input autoFocus type="number" value={tempValue} onChange={e => setTempValue(e.target.value)}
                    placeholder="e.g. 15"
                    className="flex-1 bg-iron-800 border border-iron-600 text-white font-mono text-lg px-4 py-3 focus:outline-none focus:border-acid placeholder:text-iron-600" />
                  <button onClick={() => saveField('bodyFatPct', tempValue)}
                    className="px-6 py-3 bg-acid text-black font-mono text-[11px] uppercase tracking-widest">Save</button>
                </div>
                <button onClick={() => saveField('bodyFatPct', '')}
                  className="font-mono text-[10px] uppercase tracking-widest text-iron-500 text-left">
                  Clear (set to none)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Program picker bottom-sheet */}
      {showProgramPicker && !showCustomBuilder && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowProgramPicker(false)} />
          <div className="relative bg-iron-900 border-t-2 border-acid px-5 pt-5 pb-10 max-h-[80vh] overflow-y-auto">
            <p className="font-mono text-[10px] uppercase tracking-widest text-iron-400 mb-4">Choose Program</p>

            {[...PRESET_PROGRAMS, ...customPrograms].map(prog => (
              <div key={prog.id} className="flex items-center justify-between border-b border-iron-800 py-3">
                <button
                  onClick={() => handleSelectProgram(prog.id)}
                  className="flex-1 text-left"
                >
                  <span className={`font-mono text-[11px] uppercase tracking-widest block mb-1 ${activeProgram.id === prog.id ? 'text-acid' : 'text-white'}`}>
                    {prog.name}
                    {activeProgram.id === prog.id && ' ✓'}
                  </span>
                  <div className="flex gap-1 flex-wrap">
                    {prog.days.map(d => (
                      <span key={d.key} className="px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest"
                        style={{ backgroundColor: d.color + '25', color: d.color }}>
                        {d.label}
                      </span>
                    ))}
                  </div>
                </button>
                {!prog.isPreset && (
                  <button
                    onClick={() => handleDeleteCustom(prog.id)}
                    className="ml-3 font-mono text-[10px] uppercase tracking-widest text-red-400 px-2 py-1 border border-red-900 shrink-0"
                  >
                    Del
                  </button>
                )}
              </div>
            ))}

            <button
              onClick={() => setShowCustomBuilder(true)}
              className="w-full mt-4 py-3 font-mono text-[11px] uppercase tracking-widest text-acid border border-acid"
            >
              + Create Custom
            </button>
          </div>
        </div>
      )}

      {/* Custom program builder */}
      {showProgramPicker && showCustomBuilder && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setShowCustomBuilder(false); setShowProgramPicker(false) }} />
          <div className="relative bg-iron-900 border-t-2 border-acid px-5 pt-5 pb-10 max-h-[85vh] overflow-y-auto">
            <p className="font-mono text-[10px] uppercase tracking-widest text-iron-400 mb-4">Create Custom Program</p>

            <input
              autoFocus
              placeholder="Program name (e.g. My Split)"
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              className="w-full bg-iron-800 border border-iron-600 text-white font-sans px-4 py-3 mb-4 focus:outline-none focus:border-acid placeholder:text-iron-600"
            />

            <p className="font-mono text-[10px] uppercase tracking-widest text-iron-400 mb-2">Days (in rotation order)</p>
            <div className="flex flex-col gap-2 mb-4">
              {customDays.map((d, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: CUSTOM_PALETTE[i % CUSTOM_PALETTE.length] }}
                  />
                  <input
                    placeholder={`Day ${i + 1} name (e.g. Upper)`}
                    value={d.label}
                    onChange={e => {
                      const next = [...customDays]
                      next[i] = { label: e.target.value }
                      setCustomDays(next)
                    }}
                    className="flex-1 bg-iron-800 border border-iron-600 text-white font-sans px-3 py-2 focus:outline-none focus:border-acid placeholder:text-iron-600 text-sm"
                  />
                  {customDays.length > 1 && (
                    <button
                      onClick={() => setCustomDays(prev => prev.filter((_, j) => j !== i))}
                      className="font-mono text-iron-500 text-lg px-2 hover:text-red-400"
                    >
                      −
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => setCustomDays(prev => [...prev, { label: '' }])}
              className="w-full py-2 font-mono text-[10px] uppercase tracking-widest text-iron-400 border border-iron-700 mb-4"
            >
              + Add Day
            </button>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowCustomBuilder(false); setCustomName(''); setCustomDays([{ label: '' }]) }}
                className="flex-1 py-3 border border-iron-600 font-mono text-xs uppercase tracking-wider text-iron-400"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCustom}
                disabled={!customName.trim() || customDays.every(d => !d.label.trim())}
                className="flex-1 py-3 bg-acid text-black font-mono text-xs uppercase tracking-wider disabled:opacity-40"
              >
                Save Program
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check and test**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: 0 errors, all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/screens/SettingsScreen.tsx
git commit -m "feat: SettingsScreen workout program section with picker and custom builder"
```

---

## Task 7: OnboardingScreen — Program Picker Step

**Files:**
- Modify: `src/screens/OnboardingScreen.tsx`

- [ ] **Step 1: Add program selection as step 1**

Read the current OnboardingScreen and apply these changes:

1. Change `TOTAL_STEPS` from `7` to `8`
2. Add `selectedProgramId` state: `const [selectedProgramId, setSelectedProgramId] = useState('ppl')`
3. Insert step 1 JSX (program picker grid) before the existing step 1 content
4. Shift all existing `step === N` checks up by 1 (old step 1 → new step 2, through old step 7 → new step 8)
5. In the final save step (new step 8, was step 7), after calling `saveFitnessProfile`, also call `setActiveProgramId(user!.uid, selectedProgramId)` — import `setActiveProgramId` from `../services/profileService`

The step 1 content to insert at the top of the `return` JSX, inside the existing wrapper:

```typescript
// Add import at top of file:
import { PRESET_PROGRAMS, CUSTOM_PALETTE, makeDayKey } from '../data/programs'
import { setActiveProgramId } from '../services/profileService'
import type { WorkoutProgram, ProgramDay } from '../types'

// Add state:
const [selectedProgramId, setSelectedProgramId] = useState('ppl')

// Step 1 JSX block (insert before existing step === 1 block):
{step === 1 && (
  <div className="flex flex-col flex-1">
    <p className="font-mono text-iron-500 text-[10px] uppercase tracking-widest mb-2">Step 1 of {TOTAL_STEPS}</p>
    <h2 className="font-display text-4xl text-white mb-2">YOUR SPLIT</h2>
    <p className="font-sans text-iron-400 text-sm mb-6">Choose how you structure your training week.</p>
    <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
      {PRESET_PROGRAMS.map(prog => (
        <button
          key={prog.id}
          onClick={() => setSelectedProgramId(prog.id)}
          className="w-full text-left border p-4 transition-colors"
          style={{
            borderColor: selectedProgramId === prog.id ? '#E8FF3D' : '#333',
            backgroundColor: selectedProgramId === prog.id ? '#E8FF3D08' : 'transparent',
          }}
        >
          <span className="font-mono text-[11px] uppercase tracking-widest text-white block mb-2">
            {prog.name}
          </span>
          <div className="flex gap-1.5 flex-wrap">
            {prog.days.map(d => (
              <span
                key={d.key}
                className="px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest"
                style={{ backgroundColor: d.color + '25', color: d.color, border: `1px solid ${d.color}40` }}
              >
                {d.label}
              </span>
            ))}
          </div>
        </button>
      ))}
    </div>
    <button
      onClick={() => setStep(2)}
      className="mt-6 w-full py-4 bg-acid text-black font-sans font-bold uppercase text-sm"
      style={{ letterSpacing: '0.12em' }}
    >
      Continue
    </button>
    <button
      onClick={() => setStep(2)}
      className="mt-3 font-mono text-iron-500 text-[10px] uppercase tracking-widest text-center w-full"
    >
      Skip — use Push / Pull / Legs
    </button>
  </div>
)}
```

In the final save handler (now step 8), add this line after `saveFitnessProfile(...)`:

```typescript
await setActiveProgramId(user!.uid, selectedProgramId)
```

- [ ] **Step 2: Type-check and test**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: 0 errors, all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/screens/OnboardingScreen.tsx
git commit -m "feat: OnboardingScreen adds program picker as step 1"
```

---

## Task 8: ExercisesScreen — Program-Aware Templates

**Files:**
- Modify: `src/screens/ExercisesScreen.tsx`

- [ ] **Step 1: Replace `src/screens/ExercisesScreen.tsx`**

The exercise category tabs (Push/Pull/Legs) stay for browsing. A "Template for:" selector row is added between the tab bar and exercise list, showing the active program's days as pills. Selecting a pill loads that day's template. Checkboxes toggle exercises in/out of the selected day's template.

```typescript
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import type { Exercise, Template, WorkoutType, ProgramDay, WorkoutProgram } from '../types'
import { getExercises, addExercise, updateExercise, deleteExercise } from '../services/exerciseService'
import { getTemplate, saveTemplate } from '../services/templateService'
import { getProfile } from '../services/profileService'
import { getProgramById, PRESET_PROGRAMS } from '../data/programs'
import ExerciseCard from '../components/ExerciseCard'

const CATEGORY_TABS: WorkoutType[] = ['push', 'pull', 'legs']
const CATEGORY_LABELS: Record<string, string> = { push: 'PUSH', pull: 'PULL', legs: 'LEGS' }
const CATEGORY_COLORS: Record<string, string> = { push: '#60A5FA', pull: '#4ADE80', legs: '#FB923C' }

const EMPTY_FORM = { name: '', category: 'push' as WorkoutType, muscleGroup: '' }

export default function ExercisesScreen() {
  const { user } = useAuth()
  const uid = user!.uid

  const [activeCategory, setActiveCategory] = useState<WorkoutType>('push')
  const [activeProgram, setActiveProgram] = useState<WorkoutProgram>(PRESET_PROGRAMS[0])
  const [activeDayKey, setActiveDayKey] = useState(PRESET_PROGRAMS[0].days[0].key)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [templates, setTemplates] = useState<Record<string, Template>>({})
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Exercise | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    async function load() {
      const [exs, profile] = await Promise.all([getExercises(uid), getProfile(uid)])
      setExercises(exs)
      const prog = getProgramById(profile?.activeProgramId, profile?.customPrograms)
      setActiveProgram(prog)
      setActiveDayKey(prog.days[0].key)
      const loaded = await Promise.all(prog.days.map(d => getTemplate(uid, d.key)))
      const map: Record<string, Template> = {}
      prog.days.forEach((d, i) => { map[d.key] = loaded[i] })
      setTemplates(map)
    }
    load()
  }, [uid])

  const categoryExercises = exercises.filter(e => e.category === activeCategory)
  const currentTemplate = templates[activeDayKey] ?? { type: activeDayKey, exerciseIds: [] }
  const activeCategoryColor = CATEGORY_COLORS[activeCategory] ?? '#E8FF3D'
  const activeDayObj = activeProgram.days.find(d => d.key === activeDayKey) ?? activeProgram.days[0]

  const openAdd = () => {
    setEditTarget(null)
    setForm({ ...EMPTY_FORM, category: activeCategory })
    setShowModal(true)
  }

  const openEdit = (exercise: Exercise) => {
    setEditTarget(exercise)
    setForm({ name: exercise.name, category: exercise.category, muscleGroup: exercise.muscleGroup })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.muscleGroup.trim()) return
    if (editTarget) {
      await updateExercise(uid, editTarget.id, form)
      setExercises(prev => prev.map(e => e.id === editTarget.id ? { ...e, ...form } : e))
    } else {
      const created = await addExercise(uid, form)
      setExercises(prev => [...prev, created])
    }
    setShowModal(false)
  }

  const handleDelete = async (id: string) => {
    await deleteExercise(uid, id)
    setExercises(prev => prev.filter(e => e.id !== id))
    for (const day of activeProgram.days) {
      const t = templates[day.key]
      if (t?.exerciseIds.includes(id)) {
        const updated = { ...t, exerciseIds: t.exerciseIds.filter(eid => eid !== id) }
        await saveTemplate(uid, updated)
        setTemplates(prev => ({ ...prev, [day.key]: updated }))
      }
    }
  }

  const handleToggleTemplate = async (exerciseId: string) => {
    const t = currentTemplate
    const ids = t.exerciseIds.includes(exerciseId)
      ? t.exerciseIds.filter(id => id !== exerciseId)
      : [...t.exerciseIds, exerciseId]
    const updated = { ...t, exerciseIds: ids }
    await saveTemplate(uid, updated)
    setTemplates(prev => ({ ...prev, [activeDayKey]: updated }))
  }

  return (
    <div className="min-h-screen bg-iron-950 pb-24">
      <div className="h-0.5 w-full" style={{ backgroundColor: activeCategoryColor }} />

      <div className="px-5 pt-10 pb-4">
        <h1 className="font-display text-5xl text-white leading-none">LIFTS</h1>
        <p className="font-mono text-iron-500 text-[10px] uppercase tracking-widest mt-1">
          Exercises & Templates
        </p>
      </div>

      {/* Category tab bar — always push/pull/legs */}
      <div className="flex border-b border-iron-700 mx-5 mb-0">
        {CATEGORY_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveCategory(tab)}
            className="flex-1 py-3 font-mono text-xs uppercase tracking-wider transition-colors relative"
            style={{ color: activeCategory === tab ? CATEGORY_COLORS[tab] : '#555' }}
          >
            {CATEGORY_LABELS[tab]}
            {activeCategory === tab && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: CATEGORY_COLORS[tab] }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Template day selector */}
      <div className="px-5 pt-3 pb-2 flex items-center gap-2 flex-wrap">
        <span className="font-mono text-iron-500 text-[9px] uppercase tracking-widest shrink-0">Template for:</span>
        {activeProgram.days.map(d => (
          <button
            key={d.key}
            onClick={() => setActiveDayKey(d.key)}
            className="px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest border transition-colors"
            style={{
              borderColor: activeDayKey === d.key ? d.color : '#333',
              backgroundColor: activeDayKey === d.key ? d.color + '20' : 'transparent',
              color: activeDayKey === d.key ? d.color : '#555',
            }}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Template count */}
      <div className="px-5 mb-3">
        <p className="font-mono text-iron-500 text-[10px] uppercase tracking-widest">
          {currentTemplate.exerciseIds.length} in {activeDayObj.label} template · {categoryExercises.length} {CATEGORY_LABELS[activeCategory]} exercises
        </p>
      </div>

      {/* Exercise list */}
      <div className="flex flex-col gap-px mx-5 mb-5">
        {categoryExercises.length === 0 && (
          <div className="border border-iron-700 p-8 text-center">
            <p className="font-mono text-iron-500 text-xs uppercase tracking-wider">No exercises yet</p>
          </div>
        )}
        {categoryExercises.map(ex => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            inTemplate={currentTemplate.exerciseIds.includes(ex.id)}
            onToggleTemplate={handleToggleTemplate}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        ))}
      </div>

      <div className="px-5">
        <button
          onClick={openAdd}
          className="w-full py-4 font-sans font-bold uppercase text-sm text-black transition-opacity active:opacity-80"
          style={{ backgroundColor: activeCategoryColor, letterSpacing: '0.12em' }}
        >
          + Add Exercise
        </button>
      </div>

      {/* Add/Edit modal — category stays push/pull/legs */}
      {showModal && (
        <div className="fixed inset-0 bg-black/85 flex items-end z-50" onClick={() => setShowModal(false)}>
          <div
            className="bg-iron-900 w-full border-t-2"
            style={{ borderColor: CATEGORY_COLORS[form.category] ?? '#E8FF3D' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 flex flex-col gap-4">
              <h2 className="font-display text-3xl text-white">
                {editTarget ? 'EDIT LIFT' : 'NEW LIFT'}
              </h2>
              <input
                className="w-full bg-iron-800 border border-iron-600 px-4 py-3 text-white font-sans outline-none focus:border-acid transition-colors placeholder-iron-500"
                placeholder="Exercise name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
              <input
                className="w-full bg-iron-800 border border-iron-600 px-4 py-3 text-white font-sans outline-none focus:border-acid transition-colors placeholder-iron-500"
                placeholder="Muscle group (e.g. Chest)"
                value={form.muscleGroup}
                onChange={e => setForm(f => ({ ...f, muscleGroup: e.target.value }))}
              />
              <div className="flex border border-iron-700">
                {CATEGORY_TABS.map((tab, i) => (
                  <button
                    key={tab}
                    onClick={() => setForm(f => ({ ...f, category: tab }))}
                    className="flex-1 py-3 font-mono text-xs uppercase tracking-wider transition-colors"
                    style={{
                      backgroundColor: form.category === tab ? CATEGORY_COLORS[tab] + '20' : 'transparent',
                      color: form.category === tab ? CATEGORY_COLORS[tab] : '#555',
                      borderRight: i < CATEGORY_TABS.length - 1 ? '1px solid #222' : 'none',
                    }}
                  >
                    {CATEGORY_LABELS[tab]}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-4 border border-iron-600 font-mono text-xs uppercase tracking-wider text-iron-400"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 py-4 font-sans font-bold uppercase text-sm text-black"
                  style={{ backgroundColor: CATEGORY_COLORS[form.category] ?? '#E8FF3D', letterSpacing: '0.12em' }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check and test**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: 0 errors, all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/screens/ExercisesScreen.tsx
git commit -m "feat: ExercisesScreen templates driven by active program days"
```

---

## Task 9: Cleanup — Delete ppl.ts, Final Verification

**Files:**
- Delete: `src/utils/ppl.ts`
- Delete: `src/utils/ppl.test.ts` (if it exists — rotation.test.ts covers the same logic)

- [ ] **Step 1: Check for remaining references to ppl.ts**

```bash
grep -r "from.*utils/ppl" src/
```

Expected: no output (all screens migrated in tasks 4-8)

- [ ] **Step 2: Delete ppl.ts**

```bash
rm src/utils/ppl.ts
```

- [ ] **Step 3: Check for ppl.test.ts**

```bash
ls src/utils/ppl.test.ts 2>/dev/null && echo "exists" || echo "not found"
```

If it exists, delete it:

```bash
rm src/utils/ppl.test.ts
```

- [ ] **Step 4: Run full type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass (programs.test.ts + rotation.test.ts + calorieCalc + utils)

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: remove ppl.ts — replaced by rotation.ts; workout programs complete"
```
