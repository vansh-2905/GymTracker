# Settings Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Settings screen as a 4th BottomNav tab with weight unit toggle, rest timer default, inline calorie profile editing, and sign-out.

**Architecture:** `UserProfile` gains `restDefaultSeconds`; `useTimer` accepts it as a parameter via internal ref; `SettingsScreen` loads both Firestore docs on mount and edits them in-place via a shared bottom-sheet modal pattern.

**Tech Stack:** React 18, TypeScript (strict, verbatimModuleSyntax), Firebase Firestore, Tailwind CSS v3, React Router v6, Vitest.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/types/index.ts` | Add `restDefaultSeconds?: number` to `UserProfile` |
| Modify | `src/services/profileService.ts` | Add `updateRestDefault()` |
| Modify | `src/hooks/useTimer.ts` | Accept `restDefault` param, use ref internally |
| Modify | `src/screens/ActiveWorkoutScreen.tsx` | Store restDefault in state, pass to useTimer, fix restDuration calc |
| Create | `src/screens/SettingsScreen.tsx` | Full settings UI |
| Modify | `src/components/BottomNav.tsx` | Add 4th gear tab for `/settings` |
| Modify | `src/App.tsx` | Add `/settings` route |

---

### Task 1: Extend UserProfile type and profileService

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/services/profileService.ts`

- [ ] **Step 1: Add `restDefaultSeconds` to `UserProfile`**

Open `src/types/index.ts`. Change `UserProfile` to:

```ts
export interface UserProfile {
  lastWorkoutType: WorkoutType | null
  lastWorkoutDate: string | null
  weightUnit: WeightUnit
  restDefaultSeconds?: number
}
```

The field is optional so existing Firestore documents without it remain valid — callers fall back to `?? 90`.

- [ ] **Step 2: Add `updateRestDefault` to profileService**

Open `src/services/profileService.ts`. Append after `updateWeightUnit`:

```ts
export async function updateRestDefault(uid: string, seconds: number): Promise<void> {
  await updateDoc(profileRef(uid), { restDefaultSeconds: seconds })
}
```

- [ ] **Step 3: Verify type-check passes**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/services/profileService.ts
git commit -m "feat: add restDefaultSeconds to UserProfile and profileService"
```

---

### Task 2: Parameterize useTimer + wire ActiveWorkoutScreen

**Files:**
- Modify: `src/hooks/useTimer.ts`
- Modify: `src/screens/ActiveWorkoutScreen.tsx`

- [ ] **Step 1: Update `useTimer` to accept `restDefault`**

Replace the entire content of `src/hooks/useTimer.ts` with:

```ts
import { useState, useRef, useCallback, useEffect } from 'react'

export type TimerPhase = 'idle' | 'set' | 'rest'

export function useTimer(restDefault = 90) {
  const restDefaultRef = useRef(restDefault)
  useEffect(() => { restDefaultRef.current = restDefault }, [restDefault])

  const [setSeconds, setSetSeconds] = useState(0)
  const [restSeconds, setRestSeconds] = useState(restDefault)
  const [phase, setPhase] = useState<TimerPhase>('idle')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Ref mirrors setSeconds so stopSet can read it synchronously (useState is async)
  const setSecondsRef = useRef(0)

  const clearInterval_ = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const startSet = useCallback(() => {
    clearInterval_()
    setSecondsRef.current = 0
    setSetSeconds(0)
    setPhase('set')
    intervalRef.current = setInterval(() => {
      setSecondsRef.current += 1
      setSetSeconds(setSecondsRef.current)
    }, 1000)
  }, [])

  const stopSet = useCallback((): number => {
    clearInterval_()
    const elapsed = setSecondsRef.current
    setRestSeconds(restDefaultRef.current)
    setPhase('rest')
    intervalRef.current = setInterval(() => setRestSeconds(s => s - 1), 1000)
    return elapsed
  }, [])

  const resetTimers = useCallback(() => {
    clearInterval_()
    setSecondsRef.current = 0
    setSetSeconds(0)
    setRestSeconds(restDefaultRef.current)
    setPhase('idle')
  }, [])

  return { setSeconds, restSeconds, phase, startSet, stopSet, resetTimers }
}
```

Key changes: `restDefault = 90` param, `restDefaultRef` keeps the latest value, `stopSet` and `resetTimers` use `restDefaultRef.current`.

- [ ] **Step 2: Wire `restDefault` in `ActiveWorkoutScreen`**

In `src/screens/ActiveWorkoutScreen.tsx`, make these targeted edits:

**2a.** Add `restDefault` state just before the `useTimer` call (around line 48):

Find:
```ts
  const [fitnessProfile, setFitnessProfile] = useState<FitnessProfile | null>(null)
```
Change to:
```ts
  const [fitnessProfile, setFitnessProfile] = useState<FitnessProfile | null>(null)
  const [restDefault, setRestDefault] = useState(90)
```

**2b.** Pass it to `useTimer` (line 50):

Find:
```ts
  const { setSeconds, restSeconds, phase, startSet, stopSet, resetTimers } = useTimer()
```
Change to:
```ts
  const { setSeconds, restSeconds, phase, startSet, stopSet, resetTimers } = useTimer(restDefault)
```

**2c.** Set it when the profile loads (inside the effect, after `getProfile` resolves — around line 62 where `profile?.weightUnit` is read):

Find:
```ts
      const unit = profile?.weightUnit ?? 'kg'
```
Change to:
```ts
      const unit = profile?.weightUnit ?? 'kg'
      setRestDefault(profile?.restDefaultSeconds ?? 90)
```

**2d.** Fix the `restDuration` calculation (line 126):

Find:
```ts
    const restDuration = 90 - restSeconds
```
Change to:
```ts
    const restDuration = restDefault - restSeconds
```

Also add `restDefault` to the `useCallback` dependency array for `handleSaveSet` if it has one. Search for `useCallback` around line 120 and add `restDefault` to its deps array. If it's a plain function, no change needed.

- [ ] **Step 3: Verify type-check and tests pass**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: 0 type errors, 29 tests passing.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useTimer.ts src/screens/ActiveWorkoutScreen.tsx
git commit -m "feat: parameterize useTimer restDefault, wire through ActiveWorkoutScreen"
```

---

### Task 3: Create SettingsScreen

**Files:**
- Create: `src/screens/SettingsScreen.tsx`

The screen has three card sections. Calorie profile fields open a shared bottom-sheet modal controlled by `editingField` state. On save, `computeUserMetFactor` is recomputed and the full `FitnessProfile` is written back to Firestore.

- [ ] **Step 1: Create `src/screens/SettingsScreen.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { getProfile, updateWeightUnit, updateRestDefault } from '../services/profileService'
import { getFitnessProfile, saveFitnessProfile } from '../services/fitnessProfileService'
import { computeUserMetFactor } from '../utils/calorieCalc'
import type { UserProfile, FitnessProfile, BiologicalSex, FitnessLevel, PrimaryGoal, WeightUnit } from '../types'

type EditingField =
  | 'biologicalSex'
  | 'age'
  | 'heightCm'
  | 'bodyWeightKg'
  | 'fitnessLevel'
  | 'primaryGoal'
  | 'bodyFatPct'
  | null

const FITNESS_LEVEL_LABELS: Record<FitnessLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  active: 'Active',
  advanced: 'Advanced',
  athlete: 'Athlete',
}

const GOAL_LABELS: Record<PrimaryGoal, string> = {
  weight_loss: 'Weight Loss',
  muscle_gain: 'Muscle Gain',
  maintenance: 'Maintenance',
  endurance: 'Endurance',
  general_health: 'General Health',
}

export default function SettingsScreen() {
  const { user, signOut } = useAuth()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [fp, setFp] = useState<FitnessProfile | null>(null)
  const [editingField, setEditingField] = useState<EditingField>(null)
  const [tempValue, setTempValue] = useState<string>('')
  const [restInput, setRestInput] = useState('')
  const [savedField, setSavedField] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    Promise.all([getProfile(user.uid), getFitnessProfile(user.uid)]).then(
      ([profile, fitnessProfile]) => {
        setUserProfile(profile)
        setFp(fitnessProfile)
        setRestInput(String(profile?.restDefaultSeconds ?? 90))
      },
    )
  }, [user])

  const flashSaved = (field: string) => {
    setSavedField(field)
    setTimeout(() => setSavedField(null), 1500)
  }

  const handleWeightUnit = async (unit: WeightUnit) => {
    if (!user || !userProfile) return
    await updateWeightUnit(user.uid, unit)
    setUserProfile({ ...userProfile, weightUnit: unit })
    flashSaved('weightUnit')
  }

  const handleRestBlur = async () => {
    if (!user) return
    const parsed = parseInt(restInput, 10)
    if (isNaN(parsed) || parsed < 10) return
    const clamped = Math.min(parsed, 600)
    await updateRestDefault(user.uid, clamped)
    setRestInput(String(clamped))
    if (userProfile) setUserProfile({ ...userProfile, restDefaultSeconds: clamped })
    flashSaved('rest')
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
    if (field === 'biologicalSex') updated.biologicalSex = value as BiologicalSex
    else if (field === 'age') updated.age = parseInt(value, 10)
    else if (field === 'heightCm') updated.heightCm = parseFloat(value)
    else if (field === 'bodyWeightKg') updated.bodyWeightKg = parseFloat(value)
    else if (field === 'fitnessLevel') updated.fitnessLevel = value as FitnessLevel
    else if (field === 'primaryGoal') updated.primaryGoal = value as PrimaryGoal
    else if (field === 'bodyFatPct') updated.bodyFatPct = value === '' ? null : value
    updated.userMetFactor = computeUserMetFactor(updated.biologicalSex, updated.age, updated.fitnessLevel)
    await saveFitnessProfile(user.uid, updated)
    setFp(updated)
    setEditingField(null)
    flashSaved(field)
  }

  const showCalorieProfile = fp !== null && !fp.skipped

  return (
    <div className="min-h-screen bg-iron-950 text-white pb-24">
      <div className="h-0.5 bg-acid" />
      <div className="px-5 pt-6 pb-4">
        <h1 className="font-display text-3xl tracking-wide text-white">SETTINGS</h1>
      </div>

      {/* Preferences */}
      <div className="mx-5 mb-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-iron-400 mb-2">Preferences</p>
        <div className="bg-iron-900 border border-iron-700">
          {/* Weight unit */}
          <div className="px-4 py-3 flex items-center justify-between border-b border-iron-700">
            <span className="font-mono text-[11px] uppercase tracking-widest text-iron-300">Weight Unit</span>
            <div className="flex gap-1">
              {(['kg', 'lbs'] as WeightUnit[]).map(u => (
                <button
                  key={u}
                  onClick={() => handleWeightUnit(u)}
                  className={`px-3 py-1 font-mono text-[11px] uppercase tracking-widest border transition-colors ${
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

          {/* Rest timer */}
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

      {/* Bottom-sheet modal */}
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
                  <button
                    key={s}
                    onClick={() => saveField('biologicalSex', s)}
                    className={`flex-1 py-3 font-mono text-[11px] uppercase tracking-widest border ${
                      fp.biologicalSex === s ? 'bg-acid text-black border-acid' : 'border-iron-600 text-white'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {(editingField === 'age' || editingField === 'heightCm' || editingField === 'bodyWeightKg') && (
              <div className="flex gap-3">
                <input
                  autoFocus
                  type="number"
                  value={tempValue}
                  onChange={e => setTempValue(e.target.value)}
                  className="flex-1 bg-iron-800 border border-iron-600 text-white font-mono text-lg px-4 py-3 focus:outline-none focus:border-acid"
                />
                <button
                  onClick={() => saveField(editingField, tempValue)}
                  className="px-6 py-3 bg-acid text-black font-mono text-[11px] uppercase tracking-widest"
                >
                  Save
                </button>
              </div>
            )}

            {editingField === 'fitnessLevel' && (
              <div className="flex flex-col gap-2">
                {(Object.keys(FITNESS_LEVEL_LABELS) as FitnessLevel[]).map(level => (
                  <button
                    key={level}
                    onClick={() => saveField('fitnessLevel', level)}
                    className={`w-full py-3 font-mono text-[11px] uppercase tracking-widest border text-left px-4 ${
                      fp.fitnessLevel === level ? 'bg-acid text-black border-acid' : 'border-iron-600 text-white'
                    }`}
                  >
                    {FITNESS_LEVEL_LABELS[level]}
                  </button>
                ))}
              </div>
            )}

            {editingField === 'primaryGoal' && (
              <div className="flex flex-col gap-2">
                {(Object.keys(GOAL_LABELS) as PrimaryGoal[]).map(goal => (
                  <button
                    key={goal}
                    onClick={() => saveField('primaryGoal', goal)}
                    className={`w-full py-3 font-mono text-[11px] uppercase tracking-widest border text-left px-4 ${
                      fp.primaryGoal === goal ? 'bg-acid text-black border-acid' : 'border-iron-600 text-white'
                    }`}
                  >
                    {GOAL_LABELS[goal]}
                  </button>
                ))}
              </div>
            )}

            {editingField === 'bodyFatPct' && (
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <input
                    autoFocus
                    type="number"
                    value={tempValue}
                    onChange={e => setTempValue(e.target.value)}
                    placeholder="e.g. 15"
                    className="flex-1 bg-iron-800 border border-iron-600 text-white font-mono text-lg px-4 py-3 focus:outline-none focus:border-acid placeholder:text-iron-600"
                  />
                  <button
                    onClick={() => saveField('bodyFatPct', tempValue)}
                    className="px-6 py-3 bg-acid text-black font-mono text-[11px] uppercase tracking-widest"
                  >
                    Save
                  </button>
                </div>
                <button
                  onClick={() => saveField('bodyFatPct', '')}
                  className="font-mono text-[10px] uppercase tracking-widest text-iron-500 text-left"
                >
                  Clear (set to none)
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify type-check passes**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/screens/SettingsScreen.tsx
git commit -m "feat: add SettingsScreen with preferences, calorie profile, and account sections"
```

---

### Task 4: Wire BottomNav + App routing

**Files:**
- Modify: `src/components/BottomNav.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Read BottomNav to understand the tab array structure**

Open `src/components/BottomNav.tsx` and find the tabs array. It currently has 3 entries (Today `/`, Calendar `/calendar`, Exercises `/exercises`). Each has a `to` path, a label, and an `icon` JSX element.

- [ ] **Step 2: Add the Settings tab to BottomNav**

Find the closing bracket of the tabs array (after the Exercises entry) and add a 4th tab. The exact code to insert depends on the array format — insert a new entry like the others:

```ts
{
  to: '/settings',
  label: 'SETTINGS',
  icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
},
```

- [ ] **Step 3: Add the `/settings` route to App.tsx**

Open `src/App.tsx`. Add the import:

```ts
import SettingsScreen from './screens/SettingsScreen'
```

Inside `<Routes>`, add after the `/exercises` route:

```tsx
<Route path="/settings" element={<SettingsScreen />} />
```

- [ ] **Step 4: Verify type-check and full test suite**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: 0 errors, 29 tests passing.

- [ ] **Step 5: Start dev server and manually verify**

```bash
npm run dev
```

Open `http://localhost:5173` in a browser. Verify:
- Settings tab appears in BottomNav with gear icon
- Tapping it loads the Settings screen
- Weight unit toggle switches between KG and LBS, shows "Saved" flash
- Rest timer input accepts a number, saves on blur
- Calorie profile section appears (if onboarding was completed), each row opens the correct modal
- Changing a field recomputes `userMetFactor` and saves to Firestore
- Sign Out button signs the user out and returns to the sign-in screen

- [ ] **Step 6: Commit**

```bash
git add src/components/BottomNav.tsx src/App.tsx
git commit -m "feat: add Settings tab to BottomNav and wire /settings route"
```
