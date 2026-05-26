# Calorie Tracking — Design Spec
**Date:** 2026-05-23  
**Status:** Approved

---

## Overview

Add calorie burn estimation to GymTracker at three levels: per set, per exercise, and daily workout total. Data is stored on each set doc in Firestore so a future AI interface can query it directly without recomputing. The formula is baked client-side using MET-based exercise science (ACSM Compendium of Physical Activities, Harris-Benedict metabolic adjustments, Schuenke et al. EPOC coefficients).

A one-time onboarding wizard collects body/fitness profile data after first sign-in. Profile answers are stored as raw fields plus a derived `userMetFactor` coefficient. If the user updates their profile, only future sets get the new factor — past kcal is a historical record.

---

## 1. Data Model

### New doc: `users/{uid}/data/fitnessProfile`

```ts
interface FitnessProfile {
  biologicalSex: 'male' | 'female'
  age: number
  heightCm: number
  bodyWeightKg: number
  fitnessLevel: 'beginner' | 'intermediate' | 'active' | 'advanced' | 'athlete'
  primaryGoal: 'weight_loss' | 'muscle_gain' | 'maintenance' | 'endurance' | 'general_health'
  bodyFatPct: string | null          // e.g. '15_20', null if skipped
  userMetFactor: number              // derived coefficient, stored for fast access
  skipped: boolean                   // true if user clicked "Skip for now"
  completedAt: string                // YYYY-MM-DD
}
```

### Extended `WorkoutSet`

Add one field to the existing `WorkoutSet` interface and Firestore set docs:

```ts
kcal: number   // written at log time; absent on sets logged before onboarding
```

Existing `UserProfile` doc is **untouched**.

---

## 2. Onboarding Wizard

**Route:** `/onboarding` — full-screen, no BottomNav shown.

**Trigger:** In `AuthContext`, after first Google sign-in, check if `fitnessProfile` doc exists. If not, navigate to `/onboarding` before Today. Exercises are still seeded on first sign-in as before.

**Steps (one question per screen):**

| Step | Question | Input type |
|------|----------|------------|
| 1 | Biological sex | Two large tap cards (Male / Female) |
| 2 | Age | Number input, min 13 max 100 |
| 3 | Height | Number input, cm or ft/in toggle |
| 4 | Body weight | Number input, kg or lbs toggle (respects existing weightUnit pref) |
| 5 | Fitness level | Single-select list (5 options) |
| 6 | Primary goal | Single-select list (5 options) |
| 7 | Body fat % | Single-select list (7 options) + "Skip this step" — optional |

**UX rules:**
- `font-display` (Bebas Neue) for question text, `font-mono` inputs/labels, acid yellow Continue button
- Back arrow on steps 2–7
- "Skip for now" link on every step — writes profile with safe defaults (`male`, 25, 170 cm, 75 kg, `intermediate`, `general_health`, `null` body fat) and `skipped: true`
- Progress indicator (e.g. `2 / 7`) in `font-mono` top-right
- On completion: compute `userMetFactor`, write `FitnessProfile`, navigate to `/`

---

## 3. Calorie Calculation Utility

**File:** `src/utils/calorieCalc.ts` — pure functions, no Firestore imports.

### `computeUserMetFactor(profile: FitnessProfile): number`

```
sexFactor:
  male   → 1.00
  female → 0.87

ageFactor:
  age < 25  → 1.05
  25–39     → 1.00
  40–54     → 0.95
  55+       → 0.88

fitnessLevelFactor:
  beginner     → 1.05
  intermediate → 1.00
  active       → 0.95
  advanced     → 0.90
  athlete      → 0.85

userMetFactor = sexFactor × ageFactor × fitnessLevelFactor
```

### `calculateSetKcal(set: WorkoutSet, userMetFactor: number, bodyWeightKg: number): number`

```
baseMET:
  weight = 0 (bodyweight exercise) → 4.0
  reps 1–6                         → 6.0  (heavy)
  reps 7–12                        → 5.0  (moderate)
  reps 13+                         → 3.5  (light)

kcal = baseMET × userMetFactor × bodyWeightKg × (activeDuration / 3600) × 1.15
         ↑ MET         ↑ profile adj.   ↑ mass        ↑ time in hours        ↑ EPOC

return rounded to 1 decimal place
```

**Sources:** ACSM Compendium of Physical Activities (Ainsworth et al. 2011) for MET values; Harris-Benedict for sex/age adjustments; Schuenke et al. (2002) for the 15% EPOC bonus on resistance training.

---

## 4. Set Logging Integration

In `ActiveWorkoutScreen`, when a set is saved:

1. Read `fitnessProfile` from Firestore (loaded once on screen mount, stored in state)
2. Call `calculateSetKcal(set, profile.userMetFactor, profile.bodyWeightKg)`
3. Write `kcal` alongside the other set fields via `workoutService.addSet`

If `fitnessProfile` is null (user skipped and never completed), omit `kcal` from the set doc — display nothing rather than 0.

---

## 5. Display Integration

### SetRow
Small `font-mono text-[10px] text-iron-400` kcal badge on the trailing edge of each logged set row.  
Example: `4.2 kcal` — only rendered when `set.kcal` is defined.

### ActiveWorkoutScreen
Per-exercise kcal subtotal shown below the exercise name header.  
`Σ set.kcal` for all sets under that exercise block.  
Format: `font-mono text-[11px] text-acid` — e.g. `12.6 kcal`.

### WorkoutSummary sheet
Total kcal as a stat alongside duration in the summary header row.  
Format: `font-mono` figure with `kcal` label — e.g. `184 kcal`.  
Shown for both live and past workouts (past workouts: sum of stored `kcal` fields).

### TodayScreen
Small kcal figure below the PPL type display — only if today's workout has sets with `kcal`.  
Format: `font-mono text-[12px] text-iron-400` — e.g. `184 kcal burned`.

**Past sets (no `kcal` field):** display nothing — never show 0.

---

## 6. Profile Editing

A "Body Profile" section accessible from the TodayScreen (small profile icon or link in the header area). Renders the same wizard steps pre-filled with current values. On save: recompute `userMetFactor`, update `fitnessProfile` doc. Past set `kcal` values are unchanged.

Scope of profile editing UI is a follow-on feature — can be a simple vertical form rather than a wizard for the edit case.

---

## 7. New Files

| File | Purpose |
|------|---------|
| `src/screens/OnboardingScreen.tsx` | Multi-step wizard UI |
| `src/utils/calorieCalc.ts` | Pure calorie formula functions |
| `src/services/fitnessProfileService.ts` | Firestore CRUD for `fitnessProfile` doc |

## 8. Modified Files

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `FitnessProfile` type; add `kcal?` to `WorkoutSet` |
| `src/auth/AuthContext.tsx` | Check for `fitnessProfile` on sign-in; redirect to `/onboarding` if absent |
| `src/App.tsx` | Add `/onboarding` route |
| `src/services/workoutService.ts` | Accept optional `kcal` in `addSet` |
| `src/components/SetRow.tsx` | Render kcal badge |
| `src/screens/ActiveWorkoutScreen.tsx` | Load fitnessProfile; compute+store kcal; show per-exercise subtotals |
| `src/components/WorkoutSummary.tsx` | Show total kcal stat |
| `src/screens/TodayScreen.tsx` | Show session kcal |
