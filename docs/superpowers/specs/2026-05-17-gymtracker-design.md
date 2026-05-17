# GymTracker — Design Spec
**Date:** 2026-05-17  
**Status:** Approved

---

## Overview

A personal gym tracking PWA (Progressive Web App) for logging workouts on a Push/Pull/Legs rotation. Built to be added to the iPhone home screen and used daily. Tracks sets, reps, weight, active set duration, and rest duration per set. Includes a calendar view and an exercise/template manager.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 18 + Vite |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Auth | Firebase Auth (Google sign-in) |
| Database | Firebase Firestore |
| Hosting | Netlify (static deploy) |
| PWA | vite-plugin-pwa (manifest + service worker) |

---

## Screens (4 total, bottom-nav layout)

### 1. Today
- Displays what workout is due today (Push / Pull / Legs) based on PPL rotation.
- Shows date, workout type badge, and a "Start Workout" button.
- Option to override the day type (e.g., skip or swap Push ↔ Pull).
- If a workout for today already exists, shows a summary with an "Edit" option.

### 2. Active Workout
- Launched from the Today screen.
- Shows the list of exercises from the template for that day's type.
- For each exercise:
  - List of logged sets (reps, weight, active duration, rest duration).
  - "Start Set" button → starts the **set timer** (counts up from 0).
  - "Stop Set" button → stops set timer, saves `activeDuration`, prompts for reps + weight, then starts the **rest timer**.
  - **Rest timer** counts down from 90 seconds. Goes negative (shown in red) if exceeded.
  - "Start Next Set" button → saves `restDuration`, resets both timers.
- "Finish Workout" button at the bottom → saves `endTime`, marks workout `completed: true`.
- Exercises can be added or removed from the active session (not just from the template).

### 3. Calendar
- Monthly calendar view.
- Each day cell is color-coded by workout type (Push = blue, Pull = green, Legs = orange, Rest = grey).
- Completed days show a checkmark. Incomplete/skipped days show a dot.
- Tapping a past day opens a read-only summary of that workout (exercises, sets, reps, weights, durations).
- Current day is highlighted. Future days show the projected PPL type based on rotation.

### 4. Exercises & Templates
- Three tabs: **Push | Pull | Legs**.
- Each tab shows exercises in that category from the user's exercise library.
- Each exercise card shows:
  - Name, muscle group.
  - Toggle to include/exclude from the template for that day type.
  - Drag handle to reorder within the template.
- "Add Exercise" button → modal with fields: name, category (Push/Pull/Legs), muscle group.
- Edit and delete actions on each exercise card.
- Template order is saved per day type (Push template, Pull template, Legs template).

---

## Data Model (Firestore)

```
users/{uid}/
  profile
    lastWorkoutType: "push" | "pull" | "legs"
    lastWorkoutDate: string (YYYY-MM-DD)
    weightUnit: "kg" | "lbs"

  exercises/{exerciseId}
    name: string
    category: "push" | "pull" | "legs"
    muscleGroup: string

  templates/{type}              // type = "push" | "pull" | "legs"
    exercises: string[]         // ordered list of exerciseIds

  workouts/{YYYY-MM-DD}
    type: "push" | "pull" | "legs"
    startTime: Timestamp
    endTime: Timestamp | null
    completed: boolean

  workouts/{date}/sets/{setId}
    exerciseId: string
    exerciseName: string        // denormalized for read simplicity
    setNumber: number
    reps: number
    weight: number
    activeDuration: number      // seconds
    restDuration: number        // seconds (can exceed 90)
    createdAt: Timestamp
```

---

## Timer Flow

1. User taps **Start Set** → set timer counts up (React state, `setInterval` every second).
2. User taps **Stop Set** → `activeDuration` recorded → reps + weight entry modal appears.
3. On modal confirm → rest timer starts, counting down from 90s.
4. Rest timer reaches 0 → continues into negative (displayed in red with a `−` prefix).
5. User taps **Start Next Set** → `restDuration` saved → set written to Firestore → timers reset.
6. Timers are React state only — no Firestore writes mid-set. Write happens on set completion.

---

## PPL Rotation Logic

- Sequence: Push → Pull → Legs → Push → Pull → Legs → ...
- On workout completion, `profile.lastWorkoutType` and `profile.lastWorkoutDate` are updated.
- Today screen derives the next type from `lastWorkoutType` (next in sequence).
- If `lastWorkoutDate === today`, the workout is already started/done for today.
- User can manually override the type for any given day before starting.
- Calendar projects future days based on the current rotation state.

---

## PWA / iPhone Home Screen

- `vite-plugin-pwa` generates `manifest.webmanifest` and a service worker via Workbox.
- Manifest config:
  - `display: "standalone"` — removes browser chrome when launched from home screen.
  - `theme_color`, `background_color` set to match app branding.
  - Icon set: 192×192 and 512×512 PNG.
- Safari shows "Add to Home Screen" in the share sheet on first visit.
- Service worker caches app shell for offline access (workout logging works offline; syncs to Firestore when back online).

---

## Auth Flow

- Firebase Auth with Google sign-in provider.
- On app load: check `onAuthStateChanged`. If unauthenticated → show sign-in screen (Google button only).
- All Firestore reads/writes are scoped to `users/{uid}/` — Firestore security rules enforce this.
- Sign-out available from a settings menu (top-right icon on Today screen).

---

## Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## Error Handling & Edge Cases

- If the user closes the app mid-set (timer running), the timer state is lost — sets are only persisted on completion, so no partial data is written.
- If no workouts exist yet (new user), Today screen prompts to set up first workout type.
- Weight unit (kg/lbs) is set on first login and stored in `profile.weightUnit`. Consistently applied across all views.
- Offline: Firestore offline persistence is enabled. Queued writes sync when connectivity returns.

---

## Out of Scope

- Social features, sharing workouts.
- Progress charts / analytics (can be added later).
- Multiple PPL schedules or non-PPL programs.
- Push notifications / reminders.
