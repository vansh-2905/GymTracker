# Calorie Tracking Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-set, per-exercise, and daily calorie burn estimates powered by a first-time onboarding wizard and a MET-based formula baked client-side, with kcal stored on each Firestore set doc for future AI querying.

**Architecture:** A new `FitnessProfile` Firestore doc (`users/{uid}/data/fitnessProfile`) stores biometric answers plus a precomputed `userMetFactor` coefficient. When a set is logged in `ActiveWorkoutScreen`, kcal is computed client-side via `calorieCalc.ts` and written to the set doc. Calorie figures are surfaced in SetRow (per set), ActiveWorkoutScreen (per exercise), WorkoutSummary (workout total), and TodayScreen (daily total). A 7-step full-screen wizard runs after first sign-in; returning users skip it.

**Tech Stack:** React 18, TypeScript strict + verbatimModuleSyntax, Firebase Firestore v10, Tailwind CSS v3 (iron/acid/CHALK design tokens), Vitest + @testing-library/react

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/types/index.ts` | Modify | Add `FitnessProfile`, `BiologicalSex`, `FitnessLevel`, `PrimaryGoal` types; add `kcal?` to `WorkoutSet` |
| `src/utils/calorieCalc.ts` | Create | Pure MET-based formula: `computeUserMetFactor`, `calculateSetKcal` |
| `src/utils/calorieCalc.test.ts` | Create | Vitest unit tests for both formula functions |
| `src/services/fitnessProfileService.ts` | Create | Firestore CRUD for `fitnessProfile` doc |
| `src/screens/OnboardingScreen.tsx` | Create | 7-step onboarding wizard |
| `src/auth/AuthContext.tsx` | Modify | Add `needsOnboarding` state + `completeOnboarding`, async check `fitnessProfile` on auth state change |
| `src/App.tsx` | Modify | Render `OnboardingScreen` when `needsOnboarding` is true |
| `src/services/workoutService.ts` | Modify | `getSets` and `getRecentExerciseSets` read optional `kcal` field |
| `src/screens/ActiveWorkoutScreen.tsx` | Modify | Load profile on mount; compute + write `kcal` when logging a set; show per-exercise kcal subtotals |
| `src/components/SetRow.tsx` | Modify | Add `kcal` badge on trailing edge of logged set row |
| `src/components/WorkoutSummary.tsx` | Modify | Show total kcal stat in sticky header |
| `src/screens/TodayScreen.tsx` | Modify | Load today's sets; show session kcal below workout status |

---

### Task 1: Extend types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add FitnessProfile type and kcal to WorkoutSet**

Open `src/types/index.ts`. Add these new types and extend `WorkoutSet`:

```ts
export type WorkoutType = 'push' | 'pull' | 'legs'
export type WeightUnit = 'kg' | 'lbs'
export type BiologicalSex = 'male' | 'female'
export type FitnessLevel = 'beginner' | 'intermediate' | 'active' | 'advanced' | 'athlete'
export type PrimaryGoal = 'weight_loss' | 'muscle_gain' | 'maintenance' | 'endurance' | 'general_health'

export interface UserProfile {
  lastWorkoutType: WorkoutType | null
  lastWorkoutDate: string | null
  weightUnit: WeightUnit
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
```

- [ ] **Step 2: Verify type check passes**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add FitnessProfile type and optional kcal field to WorkoutSet"
```

---

### Task 2: Calorie calculation utility + tests (TDD)

**Files:**
- Create: `src/utils/calorieCalc.test.ts`
- Create: `src/utils/calorieCalc.ts`

- [ ] **Step 1: Write failing tests**

Create `src/utils/calorieCalc.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeUserMetFactor, calculateSetKcal } from './calorieCalc'

describe('computeUserMetFactor', () => {
  it('returns 1.0 for baseline: male, age 30, intermediate', () => {
    expect(computeUserMetFactor('male', 30, 'intermediate')).toBe(1.0)
  })
  it('applies female sex factor (0.87)', () => {
    expect(computeUserMetFactor('female', 30, 'intermediate')).toBeCloseTo(0.87, 5)
  })
  it('applies age factor 1.05 for under 25', () => {
    expect(computeUserMetFactor('male', 20, 'intermediate')).toBeCloseTo(1.05, 5)
  })
  it('applies age factor 1.0 for age 25–39', () => {
    expect(computeUserMetFactor('male', 35, 'intermediate')).toBeCloseTo(1.0, 5)
  })
  it('applies age factor 0.95 for age 40–54', () => {
    expect(computeUserMetFactor('male', 45, 'intermediate')).toBeCloseTo(0.95, 5)
  })
  it('applies age factor 0.88 for age 55+', () => {
    expect(computeUserMetFactor('male', 60, 'intermediate')).toBeCloseTo(0.88, 5)
  })
  it('applies fitness factor 1.05 for beginner', () => {
    expect(computeUserMetFactor('male', 30, 'beginner')).toBeCloseTo(1.05, 5)
  })
  it('applies fitness factor 0.85 for athlete', () => {
    expect(computeUserMetFactor('male', 30, 'athlete')).toBeCloseTo(0.85, 5)
  })
  it('combines all three factors multiplicatively', () => {
    // female (0.87) * age<25 (1.05) * active (0.95) = 0.867...
    expect(computeUserMetFactor('female', 22, 'active')).toBeCloseTo(0.87 * 1.05 * 0.95, 5)
  })
})

describe('calculateSetKcal', () => {
  it('returns 0 for zero activeDuration', () => {
    expect(calculateSetKcal(10, 60, 0, 1.0, 80)).toBe(0)
  })
  it('uses bodyweight MET (4.0) when weight is 0', () => {
    // 4.0 * 1.0 * 80 * (60/3600) * 1.15 ≈ 6.1
    expect(calculateSetKcal(10, 0, 60, 1.0, 80)).toBeCloseTo(6.1, 0)
  })
  it('uses heavy MET (6.0) for 1–6 reps', () => {
    // 6.0 * 1.0 * 80 * (60/3600) * 1.15 ≈ 9.2
    expect(calculateSetKcal(5, 100, 60, 1.0, 80)).toBeCloseTo(9.2, 0)
  })
  it('uses heavy MET (6.0) for exactly 6 reps', () => {
    expect(calculateSetKcal(6, 100, 60, 1.0, 80)).toBeCloseTo(9.2, 0)
  })
  it('uses moderate MET (5.0) for 7–12 reps', () => {
    // 5.0 * 1.0 * 80 * (60/3600) * 1.15 ≈ 7.7
    expect(calculateSetKcal(10, 60, 60, 1.0, 80)).toBeCloseTo(7.7, 0)
  })
  it('uses light MET (3.5) for 13+ reps', () => {
    // 3.5 * 1.0 * 80 * (60/3600) * 1.15 ≈ 5.4
    expect(calculateSetKcal(15, 40, 60, 1.0, 80)).toBeCloseTo(5.4, 0)
  })
  it('scales linearly with bodyWeightKg', () => {
    const light = calculateSetKcal(10, 60, 60, 1.0, 60)
    const heavy = calculateSetKcal(10, 60, 60, 1.0, 90)
    expect(heavy / light).toBeCloseTo(90 / 60, 1)
  })
  it('scales linearly with activeDuration', () => {
    const short = calculateSetKcal(10, 60, 30, 1.0, 80)
    const long = calculateSetKcal(10, 60, 60, 1.0, 80)
    expect(long / short).toBeCloseTo(2, 1)
  })
  it('rounds result to 1 decimal place', () => {
    const result = calculateSetKcal(10, 60, 61, 1.0, 80)
    const asString = result.toString()
    expect(asString).toMatch(/^\d+(\.\d)?$/)
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npx vitest run src/utils/calorieCalc.test.ts
```

Expected: FAIL — `Cannot find module './calorieCalc'`

- [ ] **Step 3: Implement calorieCalc.ts**

Create `src/utils/calorieCalc.ts`:

```ts
import type { BiologicalSex, FitnessLevel } from '../types'

const FITNESS_FACTORS: Record<FitnessLevel, number> = {
  beginner: 1.05,
  intermediate: 1.00,
  active: 0.95,
  advanced: 0.90,
  athlete: 0.85,
}

export function computeUserMetFactor(
  biologicalSex: BiologicalSex,
  age: number,
  fitnessLevel: FitnessLevel,
): number {
  const sexFactor = biologicalSex === 'male' ? 1.0 : 0.87
  const ageFactor = age < 25 ? 1.05 : age < 40 ? 1.0 : age < 55 ? 0.95 : 0.88
  return sexFactor * ageFactor * FITNESS_FACTORS[fitnessLevel]
}

export function calculateSetKcal(
  reps: number,
  weight: number,
  activeDuration: number,
  userMetFactor: number,
  bodyWeightKg: number,
): number {
  if (activeDuration === 0) return 0
  const baseMET = weight === 0 ? 4.0 : reps <= 6 ? 6.0 : reps <= 12 ? 5.0 : 3.5
  const raw = baseMET * userMetFactor * bodyWeightKg * (activeDuration / 3600) * 1.15
  return Math.round(raw * 10) / 10
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npx vitest run src/utils/calorieCalc.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/calorieCalc.ts src/utils/calorieCalc.test.ts
git commit -m "feat: add MET-based calorie calculation utility with Vitest tests"
```

---

### Task 3: Fitness profile service

**Files:**
- Create: `src/services/fitnessProfileService.ts`

- [ ] **Step 1: Create the service**

Create `src/services/fitnessProfileService.ts`:

```ts
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { FitnessProfile } from '../types'

function fitnessProfileRef(uid: string) {
  return doc(db, 'users', uid, 'data', 'fitnessProfile')
}

export async function getFitnessProfile(uid: string): Promise<FitnessProfile | null> {
  const snap = await getDoc(fitnessProfileRef(uid))
  if (!snap.exists()) return null
  return snap.data() as FitnessProfile
}

export async function saveFitnessProfile(uid: string, profile: FitnessProfile): Promise<void> {
  await setDoc(fitnessProfileRef(uid), profile)
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/fitnessProfileService.ts
git commit -m "feat: add fitnessProfileService for Firestore biometric profile CRUD"
```

---

### Task 4: Onboarding wizard screen

**Files:**
- Create: `src/screens/OnboardingScreen.tsx`

The wizard uses the CHALK design language: `font-display` (Bebas Neue) for question text, `font-mono` (JetBrains Mono) for labels/inputs, acid yellow (`#E8FF3D`) Continue button, `bg-iron-950` background, `border-iron-700` for unselected options.

- [ ] **Step 1: Create OnboardingScreen.tsx**

Create `src/screens/OnboardingScreen.tsx`:

```tsx
import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { saveFitnessProfile } from '../services/fitnessProfileService'
import { computeUserMetFactor } from '../utils/calorieCalc'
import type { BiologicalSex, FitnessLevel, PrimaryGoal } from '../types'

const TOTAL_STEPS = 7

const FITNESS_OPTIONS: { label: string; value: FitnessLevel }[] = [
  { label: 'Beginner — I rarely or never exercise', value: 'beginner' },
  { label: 'Intermediate — I exercise 1–3 times a week', value: 'intermediate' },
  { label: 'Active — I exercise 4–5 times a week', value: 'active' },
  { label: 'Advanced — I train 6+ times a week', value: 'advanced' },
  { label: 'Athlete — I train at a competitive level', value: 'athlete' },
]

const GOAL_OPTIONS: { label: string; value: PrimaryGoal }[] = [
  { label: 'Lose weight / burn fat', value: 'weight_loss' },
  { label: 'Build muscle / gain strength', value: 'muscle_gain' },
  { label: 'Maintain current fitness', value: 'maintenance' },
  { label: 'Improve endurance / cardio', value: 'endurance' },
  { label: 'General health and wellness', value: 'general_health' },
]

const BODY_FAT_OPTIONS = [
  { label: 'Under 10%', value: 'under_10' },
  { label: '10–15%', value: '10_15' },
  { label: '15–20%', value: '15_20' },
  { label: '20–25%', value: '20_25' },
  { label: '25–30%', value: '25_30' },
  { label: 'Over 30%', value: 'over_30' },
  { label: "I don't know", value: 'unknown' },
]

const DEFAULTS = {
  biologicalSex: 'male' as BiologicalSex,
  age: 25,
  heightCm: 170,
  bodyWeightKg: 75,
  fitnessLevel: 'intermediate' as FitnessLevel,
  primaryGoal: 'general_health' as PrimaryGoal,
}

interface Props {
  onComplete: () => void
}

export default function OnboardingScreen({ onComplete }: Props) {
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  const [biologicalSex, setBiologicalSex] = useState<BiologicalSex | null>(null)
  const [age, setAge] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ftin'>('cm')
  const [heightFt, setHeightFt] = useState('')
  const [heightIn, setHeightIn] = useState('')
  const [bodyWeightVal, setBodyWeightVal] = useState('')
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg')
  const [fitnessLevel, setFitnessLevel] = useState<FitnessLevel | null>(null)
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoal | null>(null)
  const [bodyFatPct, setBodyFatPct] = useState<string | null>(null)

  function resolvedHeightCm(): number {
    if (heightUnit === 'cm') return parseFloat(heightCm) || DEFAULTS.heightCm
    const ft = parseFloat(heightFt) || 0
    const inches = parseFloat(heightIn) || 0
    return Math.round(ft * 30.48 + inches * 2.54)
  }

  function resolvedWeightKg(): number {
    const val = parseFloat(bodyWeightVal)
    if (!val) return DEFAULTS.bodyWeightKg
    return weightUnit === 'kg' ? val : Math.round((val / 2.205) * 10) / 10
  }

  function todayStr(): string {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const canContinue =
    (step === 1 && biologicalSex !== null) ||
    (step === 2 && age !== '' && parseInt(age) >= 13 && parseInt(age) <= 100) ||
    (step === 3 && (heightUnit === 'cm' ? heightCm !== '' : heightFt !== '')) ||
    (step === 4 && bodyWeightVal !== '') ||
    (step === 5 && fitnessLevel !== null) ||
    (step === 6 && primaryGoal !== null) ||
    step === 7

  async function handleFinish(skipped: boolean) {
    setSaving(true)
    const sex = skipped ? DEFAULTS.biologicalSex : (biologicalSex ?? DEFAULTS.biologicalSex)
    const ageVal = skipped ? DEFAULTS.age : (parseInt(age) || DEFAULTS.age)
    const hCm = skipped ? DEFAULTS.heightCm : resolvedHeightCm()
    const wKg = skipped ? DEFAULTS.bodyWeightKg : resolvedWeightKg()
    const level = skipped ? DEFAULTS.fitnessLevel : (fitnessLevel ?? DEFAULTS.fitnessLevel)
    const goal = skipped ? DEFAULTS.primaryGoal : (primaryGoal ?? DEFAULTS.primaryGoal)
    const userMetFactor = computeUserMetFactor(sex, ageVal, level)

    await saveFitnessProfile(user!.uid, {
      biologicalSex: sex,
      age: ageVal,
      heightCm: hCm,
      bodyWeightKg: wKg,
      fitnessLevel: level,
      primaryGoal: goal,
      bodyFatPct: skipped ? null : bodyFatPct,
      userMetFactor,
      skipped,
      completedAt: todayStr(),
    })
    onComplete()
  }

  const optionCls = (selected: boolean) =>
    `w-full text-left px-4 py-4 border font-sans text-sm transition-all ${
      selected
        ? 'border-acid bg-acid/10 text-white'
        : 'border-iron-700 text-iron-400 hover:border-iron-500'
    }`

  const unitBtnCls = (active: boolean) =>
    `font-mono text-xs px-4 py-2 border tracking-widest transition-colors ${
      active ? 'border-acid text-acid' : 'border-iron-700 text-iron-400'
    }`

  const inputCls =
    'bg-iron-900 border border-iron-700 text-white font-mono text-3xl px-4 py-4 outline-none focus:border-acid'

  return (
    <div className="min-h-screen bg-iron-950 text-white flex flex-col">
      <div className="h-0.5 w-full bg-acid" />

      {/* Top bar */}
      <div className="flex justify-between items-center px-5 pt-5">
        {step > 1 ? (
          <button
            onClick={() => setStep(s => s - 1)}
            className="font-mono text-iron-400 text-xs hover:text-white transition-colors"
          >
            ← BACK
          </button>
        ) : (
          <div />
        )}
        <span className="font-mono text-iron-400 text-[10px] tracking-widest">
          {step} / {TOTAL_STEPS}
        </span>
        <button
          onClick={() => handleFinish(true)}
          className="font-mono text-iron-500 text-[10px] tracking-widest hover:text-iron-300 transition-colors"
        >
          SKIP
        </button>
      </div>

      {/* Step content */}
      <div className="flex-1 flex flex-col justify-center px-5 pb-32">
        {step === 1 && (
          <div>
            <p className="font-mono text-iron-400 text-[10px] tracking-widest uppercase mb-3">ABOUT YOU</p>
            <h1 className="font-display text-4xl leading-tight mb-10">
              WHAT IS YOUR<br />BIOLOGICAL SEX?
            </h1>
            <div className="grid grid-cols-2 gap-4">
              {(['male', 'female'] as BiologicalSex[]).map(s => (
                <button
                  key={s}
                  onClick={() => setBiologicalSex(s)}
                  className={`py-10 border font-display text-2xl transition-all ${
                    biologicalSex === s
                      ? 'border-acid bg-acid/10 text-acid'
                      : 'border-iron-700 text-iron-400 hover:border-iron-500'
                  }`}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="font-mono text-iron-400 text-[10px] tracking-widest uppercase mb-3">ABOUT YOU</p>
            <h1 className="font-display text-4xl leading-tight mb-10">WHAT IS<br />YOUR AGE?</h1>
            <div className="flex items-end gap-3">
              <input
                type="number"
                inputMode="numeric"
                min={13}
                max={100}
                value={age}
                onChange={e => setAge(e.target.value)}
                placeholder="25"
                className={`${inputCls} w-28`}
              />
              <span className="font-mono text-iron-400 text-sm tracking-widest pb-4">YEARS</span>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <p className="font-mono text-iron-400 text-[10px] tracking-widest uppercase mb-3">ABOUT YOU</p>
            <h1 className="font-display text-4xl leading-tight mb-6">WHAT IS<br />YOUR HEIGHT?</h1>
            <div className="flex gap-2 mb-6">
              {(['cm', 'ftin'] as const).map(u => (
                <button key={u} onClick={() => setHeightUnit(u)} className={unitBtnCls(heightUnit === u)}>
                  {u === 'cm' ? 'CM' : 'FT / IN'}
                </button>
              ))}
            </div>
            {heightUnit === 'cm' ? (
              <div className="flex items-end gap-3">
                <input
                  type="number"
                  inputMode="numeric"
                  value={heightCm}
                  onChange={e => setHeightCm(e.target.value)}
                  placeholder="170"
                  className={`${inputCls} w-28`}
                />
                <span className="font-mono text-iron-400 text-sm tracking-widest pb-4">CM</span>
              </div>
            ) : (
              <div className="flex items-end gap-4">
                <div className="flex items-end gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={heightFt}
                    onChange={e => setHeightFt(e.target.value)}
                    placeholder="5"
                    className={`${inputCls} w-20`}
                  />
                  <span className="font-mono text-iron-400 text-sm tracking-widest pb-4">FT</span>
                </div>
                <div className="flex items-end gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={heightIn}
                    onChange={e => setHeightIn(e.target.value)}
                    placeholder="10"
                    className={`${inputCls} w-20`}
                  />
                  <span className="font-mono text-iron-400 text-sm tracking-widest pb-4">IN</span>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div>
            <p className="font-mono text-iron-400 text-[10px] tracking-widest uppercase mb-3">ABOUT YOU</p>
            <h1 className="font-display text-4xl leading-tight mb-6">YOUR BODY<br />WEIGHT?</h1>
            <div className="flex gap-2 mb-6">
              {(['kg', 'lbs'] as const).map(u => (
                <button key={u} onClick={() => setWeightUnit(u)} className={unitBtnCls(weightUnit === u)}>
                  {u.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-3">
              <input
                type="number"
                inputMode="decimal"
                value={bodyWeightVal}
                onChange={e => setBodyWeightVal(e.target.value)}
                placeholder={weightUnit === 'kg' ? '75' : '165'}
                className={`${inputCls} w-32`}
              />
              <span className="font-mono text-iron-400 text-sm tracking-widest pb-4">
                {weightUnit.toUpperCase()}
              </span>
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <p className="font-mono text-iron-400 text-[10px] tracking-widest uppercase mb-3">YOUR TRAINING</p>
            <h1 className="font-display text-4xl leading-tight mb-8">FITNESS<br />LEVEL?</h1>
            <div className="space-y-2">
              {FITNESS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFitnessLevel(opt.value)}
                  className={optionCls(fitnessLevel === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 6 && (
          <div>
            <p className="font-mono text-iron-400 text-[10px] tracking-widest uppercase mb-3">YOUR TRAINING</p>
            <h1 className="font-display text-4xl leading-tight mb-8">PRIMARY<br />GOAL?</h1>
            <div className="space-y-2">
              {GOAL_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setPrimaryGoal(opt.value)}
                  className={optionCls(primaryGoal === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 7 && (
          <div>
            <p className="font-mono text-iron-400 text-[10px] tracking-widest uppercase mb-3">OPTIONAL</p>
            <h1 className="font-display text-4xl leading-tight mb-2">BODY FAT<br />PERCENTAGE?</h1>
            <p className="font-mono text-iron-500 text-[10px] tracking-widest mb-8">
              IMPROVES CALORIE ACCURACY
            </p>
            <div className="space-y-2">
              {BODY_FAT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setBodyFatPct(prev => prev === opt.value ? null : opt.value)}
                  className={optionCls(bodyFatPct === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fixed bottom button */}
      <div className="fixed bottom-0 left-0 right-0 p-5 bg-iron-950 border-t border-iron-800">
        {step < TOTAL_STEPS ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={!canContinue}
            className="w-full py-4 bg-acid text-black font-sans font-bold uppercase disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
            style={{ letterSpacing: '0.12em' }}
          >
            CONTINUE
          </button>
        ) : (
          <button
            onClick={() => handleFinish(false)}
            disabled={saving}
            className="w-full py-4 bg-acid text-black font-sans font-bold uppercase disabled:opacity-50 transition-opacity"
            style={{ letterSpacing: '0.12em' }}
          >
            {saving ? 'SAVING…' : 'FINISH'}
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/screens/OnboardingScreen.tsx
git commit -m "feat: add 7-step onboarding wizard for biometric profile collection"
```

---

### Task 5: AuthContext — needsOnboarding state

**Files:**
- Modify: `src/auth/AuthContext.tsx`

The `onAuthStateChanged` callback is currently synchronous — it sets `user` and calls `setLoading(false)` immediately. We need it to also async-check for `fitnessProfile` before clearing the loading state, so the spinner stays up until we know whether to show onboarding.

- [ ] **Step 1: Replace AuthContext.tsx**

Replace the full file with:

```tsx
import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth, googleProvider } from '../firebase'

interface AuthContextValue {
  user: User | null
  loading: boolean
  needsOnboarding: boolean
  completeOnboarding: () => void
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        const { getFitnessProfile } = await import('../services/fitnessProfileService')
        const fp = await getFitnessProfile(u.uid)
        setNeedsOnboarding(!fp)
      } else {
        setNeedsOnboarding(false)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const signIn = async () => {
    const result = await signInWithPopup(auth, googleProvider)
    const { getProfile, initProfile } = await import('../services/profileService')
    const { seedDefaultExercises } = await import('../utils/seedExercises')
    const profile = await getProfile(result.user.uid)
    if (!profile) {
      await initProfile(result.user.uid)
      await seedDefaultExercises(result.user.uid)
    }
  }

  const signOutUser = async () => {
    await signOut(auth)
  }

  const completeOnboarding = () => setNeedsOnboarding(false)

  return (
    <AuthContext.Provider
      value={{ user, loading, needsOnboarding, completeOnboarding, signIn, signOut: signOutUser }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/auth/AuthContext.tsx
git commit -m "feat: add needsOnboarding flag to AuthContext, check fitnessProfile on auth state change"
```

---

### Task 6: App.tsx — render OnboardingScreen for new users

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add OnboardingScreen conditional render**

Replace the full file with:

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import SignInScreen from './auth/SignInScreen'
import BottomNav from './components/BottomNav'
import TodayScreen from './screens/TodayScreen'
import ActiveWorkoutScreen from './screens/ActiveWorkoutScreen'
import CalendarScreen from './screens/CalendarScreen'
import ExercisesScreen from './screens/ExercisesScreen'
import OnboardingScreen from './screens/OnboardingScreen'

export default function App() {
  const { user, loading, needsOnboarding, completeOnboarding } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <SignInScreen />
  if (needsOnboarding) return <OnboardingScreen onComplete={completeOnboarding} />

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-iron-950 text-white pb-20">
        <Routes>
          <Route path="/" element={<TodayScreen />} />
          <Route path="/workout/:date" element={<ActiveWorkoutScreen />} />
          <Route path="/calendar" element={<CalendarScreen />} />
          <Route path="/exercises" element={<ExercisesScreen />} />
        </Routes>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}
```

- [ ] **Step 2: Type check and full test suite**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: no errors, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: gate app behind OnboardingScreen for users without fitnessProfile"
```

---

### Task 7: workoutService — read kcal from set docs

**Files:**
- Modify: `src/services/workoutService.ts`

`getSets` and `getRecentExerciseSets` both map Firestore documents to `WorkoutSet` objects. Neither currently reads the `kcal` field. Add it as optional to both mappings.

- [ ] **Step 1: Update both set mappings to include kcal**

In `getSets` (the `.map(d => { ... })` block, around line 57–71), add `kcal` after `restDuration`:

```ts
      restDuration: data['restDuration'] as number,
      kcal: data['kcal'] !== undefined ? (data['kcal'] as number) : undefined,
      createdAt: (data['createdAt'] as Timestamp).toDate(),
```

Apply the identical change inside `getRecentExerciseSets` (the inner `.map(d => { ... })` block, around line 128–141).

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/workoutService.ts
git commit -m "feat: read optional kcal field from Firestore set documents in getSets and getRecentExerciseSets"
```

---

### Task 8: ActiveWorkoutScreen — compute + store kcal, show per-exercise subtotal

**Files:**
- Modify: `src/screens/ActiveWorkoutScreen.tsx`

This is the most involved task. Read the current file before editing to confirm exact variable names.

- [ ] **Step 1: Read the current file**

```bash
cat -n src/screens/ActiveWorkoutScreen.tsx
```

Note the variable names used for: reps value in the log-set modal, weight value, elapsed time from timer, and where `logSet` is called. The observations confirm `pendingWeight` exists; reps and elapsed variable names may vary.

- [ ] **Step 2: Add fitnessProfile import and state**

At the top of the file, add these imports alongside existing ones:

```ts
import { getFitnessProfile } from '../services/fitnessProfileService'
import { calculateSetKcal } from '../utils/calorieCalc'
import type { FitnessProfile } from '../types'
```

Inside the component, add one state variable alongside the existing `useState` declarations:

```ts
const [fitnessProfile, setFitnessProfile] = useState<FitnessProfile | null>(null)
```

- [ ] **Step 3: Load fitnessProfile on mount**

Inside the existing `useEffect` that loads workout data and sets (the one that calls `getWorkout` and `getSets`), add a single call to load the fitness profile:

```ts
const fp = await getFitnessProfile(uid)
setFitnessProfile(fp)
```

Add this alongside the other data-loading calls in the effect. It's a single `getDoc` read — no listener.

- [ ] **Step 4: Compute kcal when logging a set**

Locate the handler that calls `logSet` (triggered when the user confirms a completed set in the log-set modal). Before the `logSet` call, compute kcal using the actual variable names you found in Step 1 for reps, weight, and elapsed duration:

```ts
const kcal = fitnessProfile
  ? calculateSetKcal(
      /* reps: */ <reps variable>,
      /* weight: */ parseFloat(<weight variable>) || 0,
      /* activeDuration: */ <elapsed seconds variable>,
      fitnessProfile.userMetFactor,
      fitnessProfile.bodyWeightKg,
    )
  : undefined
```

Then pass `kcal` into the `logSet` call:

```ts
const logged = await logSet(uid, date, {
  // ... existing fields ...
  kcal,
  createdAt: new Date(),
})
```

Since `WorkoutSet.kcal` is `number | undefined` and `logSet` takes `Omit<WorkoutSet, 'id'>`, TypeScript accepts this without changes to the service.

- [ ] **Step 5: Add per-exercise kcal subtotal**

In the JSX where each exercise's logged sets are displayed (the section that renders the exercise name header and the sets list below it), add a kcal subtotal immediately after the exercise name. Use the `sets` state array which holds all logged sets for the session:

```tsx
{(() => {
  const exerciseKcal = sets
    .filter(s => s.exerciseId === selectedExercise.id && s.kcal !== undefined)
    .reduce((sum, s) => sum + (s.kcal ?? 0), 0)
  if (exerciseKcal === 0) return null
  return (
    <p className="font-mono text-[11px] text-acid tracking-widest mt-0.5">
      {Math.round(exerciseKcal * 10) / 10} KCAL
    </p>
  )
})()}
```

- [ ] **Step 6: Type check and full test suite**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: no errors, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/screens/ActiveWorkoutScreen.tsx
git commit -m "feat: compute and persist kcal per set, show per-exercise kcal subtotal in active workout"
```

---

### Task 9: SetRow — kcal badge

**Files:**
- Modify: `src/components/SetRow.tsx`

SetRow renders reps, weight, and duration for each logged set. It has a foreground content div that slides left on swipe. The kcal badge goes inside that foreground div, on the trailing edge before the edit icon.

- [ ] **Step 1: Add kcal badge**

Inside the foreground row content div, after the existing reps/weight/duration spans and before the edit icon, add:

```tsx
{set.kcal !== undefined && (
  <span className="font-mono text-[10px] text-iron-500">
    {set.kcal} kcal
  </span>
)}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/SetRow.tsx
git commit -m "feat: show kcal badge on logged set rows in SetRow"
```

---

### Task 10: WorkoutSummary — total kcal stat

**Files:**
- Modify: `src/components/WorkoutSummary.tsx`

`WorkoutSummary` already receives `sets: WorkoutSet[]`. Compute total kcal from the sets and show it in the sticky header.

- [ ] **Step 1: Add total kcal to the summary header**

After `const color = TYPE_COLOR[workout.type] ?? '#E8FF3D'`, add:

```ts
const totalKcal = sets.reduce((sum, s) => sum + (s.kcal ?? 0), 0)
const hasKcal = sets.some(s => s.kcal !== undefined)
```

In the sticky header `<div>` (the one with class `sticky top-0 bg-iron-900 ...`), add this after the `<h2>` that shows `{workout.type.toUpperCase()} DAY`:

```tsx
{hasKcal && (
  <p className="font-mono text-[10px] tracking-widest mt-1" style={{ color }}>
    {Math.round(totalKcal)} KCAL BURNED
  </p>
)}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/WorkoutSummary.tsx
git commit -m "feat: show total kcal burned in WorkoutSummary sticky header"
```

---

### Task 11: TodayScreen — session kcal

**Files:**
- Modify: `src/screens/TodayScreen.tsx`

TodayScreen currently loads `profile` and `todayWorkout` but not sets. We load today's sets (only when a workout exists) to compute the session kcal total.

- [ ] **Step 1: Load sets and compute session kcal**

Add this import at the top alongside existing service imports:

```ts
import { getSets } from '../services/workoutService'
```

Inside the component, add a state variable:

```ts
const [sessionKcal, setSessionKcal] = useState<number | null>(null)
```

Inside the `load()` async function, update the block that handles `existing` workout to also load sets:

```ts
if (existing) {
  setTodayWorkout({ exists: true, completed: existing.completed })
  const todaySets = await getSets(uid, date)
  const hasKcal = todaySets.some(s => s.kcal !== undefined)
  if (hasKcal) {
    setSessionKcal(todaySets.reduce((sum, s) => sum + (s.kcal ?? 0), 0))
  }
} else {
  setTodayWorkout({ exists: false, completed: false })
}
```

- [ ] **Step 2: Render session kcal in JSX**

In the TodayScreen JSX, locate the workout status section (the area with the Start/Continue Workout button). Add the kcal display below the button:

```tsx
{sessionKcal !== null && sessionKcal > 0 && (
  <p className="font-mono text-iron-400 text-[12px] tracking-widest mt-3">
    {Math.round(sessionKcal)} KCAL BURNED TODAY
  </p>
)}
```

- [ ] **Step 3: Type check and full test suite**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: no errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/screens/TodayScreen.tsx
git commit -m "feat: show session kcal on Today screen"
```

---

### Task 12: End-to-end smoke test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Open `http://localhost:5173` in a browser (or Safari on iPhone via local IP for mobile testing).

- [ ] **Step 2: Verify onboarding flow for new users**

1. If already signed in, sign out
2. Sign in with Google → onboarding wizard should appear immediately
3. Complete all 7 steps → should land on Today screen
4. Sign out and sign in again → wizard should NOT appear (profile exists)

- [ ] **Step 3: Verify kcal display at all three levels**

1. Start a workout from Today screen
2. Log one set → confirm a kcal badge appears in the SetRow (e.g. `4.2 kcal`)
3. Log 2 more sets for the same exercise → confirm per-exercise kcal subtotal updates
4. Switch exercises, log sets → confirm subtotal resets per exercise
5. Open WorkoutSummary on a past day (Calendar → tap a completed day) → confirm total kcal in header
6. Return to Today screen → confirm session kcal appears below the workout button

- [ ] **Step 4: Verify skip flow**

1. Open incognito / clear IndexedDB, sign in fresh
2. Click SKIP on step 1 → lands on Today screen
3. Log a set → confirm kcal badge still appears (default profile produces a valid `userMetFactor`)

- [ ] **Step 5: Final build check**

```bash
npm run build
```

Expected: build completes with no errors.
