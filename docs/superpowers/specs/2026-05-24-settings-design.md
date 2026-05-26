# Settings Screen — Design Spec
*GymTracker PWA · 2026-05-24*

## Overview
A 4th tab in BottomNav (`/settings`) with three sections: Preferences, Calorie Profile, and Account. Consistent with CHALK design system.

## Data Model Changes

### `UserProfile` (existing Firestore doc: `users/{uid}/data/profile`)
Add one field:
```ts
restDefaultSeconds: number  // default 90
```
New service function in `profileService.ts`:
```ts
updateRestDefault(uid: string, seconds: number): Promise<void>
```

### `FitnessProfile` — no schema changes needed.

## `useTimer` Change
`useTimer` hardcodes `90` in two places. Change signature to accept `restDefault: number` parameter. `ActiveWorkoutScreen` reads `profile.restDefaultSeconds` (falling back to `90`) and passes it in.

## `SettingsScreen.tsx`

### Preferences Section
- **Weight unit**: `KG` / `LBS` two-button toggle. Saves immediately via `updateWeightUnit()`. Reads current value from `UserProfile`.
- **Rest timer default**: Numeric text input (seconds). Saves on blur via `updateRestDefault()`. Shows current `profile.restDefaultSeconds`.

### Calorie Profile Section
- Hidden if `fitnessProfile` is null or `fitnessProfile.skipped === true`.
- Inline rows for each biometric field:
  - Biological Sex (male / female)
  - Age (number)
  - Height in cm (number)
  - Body Weight in kg (number)
  - Fitness Level (beginner / intermediate / active / advanced / athlete)
  - Primary Goal (weight_loss / muscle_gain / maintenance / endurance / general_health)
  - Body Fat % (optional, nullable)
- Each row is tappable → opens a bottom-sheet modal with the same picker/input style as OnboardingScreen.
- On save: recompute `userMetFactor` via `computeUserMetFactor()`, write full updated `FitnessProfile` via `saveFitnessProfile()`.

### Account Section
- Display user's Google avatar, display name, and email.
- "Sign Out" button → calls `useAuth().signOut()`.

## Navigation

### `BottomNav.tsx`
Add 4th tab: gear SVG icon, label `SETTINGS`, route `/settings`. Active indicator follows same acid top-line pattern.

### `App.tsx`
Add `<Route path="/settings" element={<SettingsScreen />} />`.

## Design Constraints (CHALK)
- `bg-iron-950` page base, section cards `bg-iron-900 border border-iron-700`
- `h-0.5 bg-acid` top accent bar
- `font-mono text-[10px] uppercase tracking-widest` for section labels
- Bottom-sheet modals: `border-t-2 border-acid bg-iron-900`
- Buttons: uppercase, `tracking-[0.12em]`, sharp edges, `text-black` on colored backgrounds
- Save confirmation: brief inline "Saved" flash on the row (no toast library needed)
