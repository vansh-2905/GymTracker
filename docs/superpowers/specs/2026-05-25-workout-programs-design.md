# Workout Programs Design
_2026-05-25_

## Overview

Replace the hardcoded Push/Pull/Legs rotation with a first-class "workout program" concept. Users choose from built-in presets or create custom programs with their own day names. The active program drives calendar projections, TodayScreen next-day labels, template tabs in ExercisesScreen, and accent colors throughout.

---

## Data Model

### New types (`src/types/index.ts`)

```typescript
// Widened from 'push' | 'pull' | 'legs' to string
export type WorkoutType = string

export interface ProgramDay {
  key: string    // Firestore-safe key, e.g. 'push', 'upper', 'full_body'
  label: string  // Display name, e.g. 'Push', 'Upper', 'Full Body'
  color: string  // Hex color, e.g. '#60A5FA'
}

export interface WorkoutProgram {
  id: string            // 'ppl' | 'upper_lower' | 'full_body' | 'hiit' | UUID for custom
  name: string          // 'Push / Pull / Legs', 'Upper / Lower', etc.
  days: ProgramDay[]    // Ordered rotation — cycles from index 0
  isPreset: boolean
}
```

### `UserProfile` additions

```typescript
activeProgramId: string          // default 'ppl'
customPrograms?: WorkoutProgram[]
```

### What does NOT change

- `Exercise.category` stays `'push' | 'pull' | 'legs'` — muscle group classification, independent of program
- Firestore template paths stay `users/{uid}/templates/{dayKey}` — PPL keys are identical, new programs add new doc IDs
- Past workout docs (`type: 'push' | 'pull' | 'legs'`) are never rewritten

---

## Preset Programs (`src/data/programs.ts`)

| Program ID | Name | Days (in order) |
|---|---|---|
| `ppl` | Push / Pull / Legs | Push #60A5FA → Pull #4ADE80 → Legs #FB923C |
| `upper_lower` | Upper / Lower | Upper #A78BFA → Lower #F472B6 |
| `full_body` | Full Body | Full Body #34D399 |
| `hiit` | HIIT | HIIT #F59E0B → Strength #6366F1 |

---

## Custom Programs

- User gives the program a name and an ordered list of day names
- `key` auto-generated: label lowercased + spaces replaced with `_` (e.g. "Chest Day" → `chest_day`); if duplicate within program, append `_2`, `_3`
- Colors auto-assigned cycling through a fixed palette of 8 colors
- Stored in `UserProfile.customPrograms` as `WorkoutProgram` objects with UUID `id` and `isPreset: false`
- Minimum 1 day required to save
- If the active custom program is deleted, auto-switch to `ppl`

---

## Architecture — Files Changed

### New files

| File | Purpose |
|---|---|
| `src/data/programs.ts` | Preset `WorkoutProgram` objects; exported as `PRESET_PROGRAMS` |
| `src/utils/rotation.ts` | Generalized rotation logic replacing `ppl.ts` |

### `src/utils/rotation.ts` API

```typescript
// Returns the next ProgramDay after the given key
nextDayInProgram(lastKey: string | null, program: WorkoutProgram): ProgramDay

// Returns the projected ProgramDay for targetDate given last workout info
getProjectedDay(
  lastKey: string,
  lastDate: string,
  targetDate: string,
  program: WorkoutProgram,
): ProgramDay
```

### Modified files

| File | Change |
|---|---|
| `src/types/index.ts` | Add `ProgramDay`, `WorkoutProgram`; update `UserProfile`; widen `WorkoutType` |
| `src/utils/ppl.ts` | Delete; callers migrate to `rotation.ts` |
| `src/services/profileService.ts` | Read/write `activeProgramId` + `customPrograms` |
| `src/screens/OnboardingScreen.tsx` | New first step: program picker |
| `src/screens/SettingsScreen.tsx` | New "WORKOUT PROGRAM" section |
| `src/screens/TodayScreen.tsx` | Load active program; use `rotation.ts` for next day |
| `src/screens/CalendarScreen.tsx` | Use active program for projection dot colors |
| `src/screens/ExercisesScreen.tsx` | Templates tab sub-tabs driven by active program days |
| `src/screens/ActiveWorkoutScreen.tsx` | Accent bar color from active program day color |

---

## UX Flow

### Onboarding (new step 1 — before biometrics)

- Screen title: "CHOOSE YOUR SPLIT"
- Grid of preset tiles: each shows program name + a row of colored day chips
- "Create Custom" tile at the end
- Custom builder: name field + ordered day name inputs with +/− buttons
- Defaults to PPL if skipped
- Selecting a preset or completing custom builder advances to the next onboarding step

### Settings — "WORKOUT PROGRAM" section

- Displays current program name + row of colored day chips
- "Change" button opens a bottom-sheet:
  - Preset rows (name + day chips)
  - User's custom programs (name + day chips + delete button)
  - "Create Custom" row at the bottom
- Custom builder in-sheet: name field + day list with add/remove
- Same CHALK design: `font-mono` labels, sharp edges, acid accent

### ExercisesScreen — Templates tab

- Sub-tabs derived from `activeProgram.days` array
- PPL users: Push / Pull / Legs (unchanged)
- Full Body users: single "Full Body" tab
- Upper/Lower users: Upper / Lower
- Each tab loads/saves template at `users/{uid}/templates/{day.key}`

### TodayScreen

- "Next workout" label shows active program next day label (e.g. "UPPER DAY")
- Type-override chips show active program's day labels + colors

### Calendar

- Future projection dots: cycle through `activeProgram.days` using `getProjectedDay()`
- Past workout dots: use color from active program day matching `workout.type`; fall back to acid yellow `#E8FF3D` if no match (e.g. old PPL workouts after switching to a different program)

---

## Program Switching Behavior

When the user switches programs (in Settings or after onboarding):

1. `activeProgramId` updated in `UserProfile`
2. `lastWorkoutType` reset to `null` — next workout starts at `program.days[0]`
3. Past workout Firestore docs **untouched** — type keys preserved forever
4. Calendar past dots fall back to acid yellow if old key has no color in new program
5. Calendar future projections start fresh from `program.days[0]`

This is forward-only: no data migration, no history rewrite.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| `lastWorkoutType` not found in new program's days | Next day defaults to `program.days[0]` |
| Duplicate day label in custom builder | Key gets `_2`, `_3` suffix |
| Empty custom program (0 days) | Save button disabled |
| Active custom program deleted | Auto-switch to PPL |
| Past workout type not in active program | Calendar dot falls back to acid yellow |

---

## Testing

- `src/utils/rotation.test.ts` replaces `src/utils/ppl.test.ts`
- Tests: `nextDayInProgram` and `getProjectedDay` with 1-day, 2-day, 3-day, 5-day sequences
- PPL preset passes through the same logic (port existing ppl tests)
- `src/data/programs.test.ts`: snapshot test that all presets have non-empty days and unique keys per program
