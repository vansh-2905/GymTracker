# AI Coach Feature — Design Spec
**Date:** 2026-05-24  
**Status:** Approved for implementation

---

## Overview

A persistent AI chat interface (5th BottomNav tab: "COACH") that answers questions about the user's workout history and provides personalized fitness coaching. Uses Claude API with tool use — no RAG pipeline. The AI has access to all workout data and user profile information.

---

## Architecture

Three layers:

### 1. Frontend — `CoachScreen.tsx`
- 5th tab in `BottomNav`, label `COACH`, chat bubble SVG icon, acid yellow top-line indicator
- Chat UI: scrollable message list + fixed bottom input
- On mount: fetches last 50 messages from Firestore for persistent history
- On send: writes user message to Firestore immediately, POSTs to Netlify function, writes assistant reply on response
- Empty state: 4 tappable suggestion chips that fill + send on tap

### 2. Netlify Function — `netlify/functions/coach.ts`
- Receives `{ idToken, message, history: Message[] }` (last 10 messages for context window)
- Verifies Firebase ID token server-side → extracts `uid` (never trusted from client)
- Fetches `UserProfile` + `FitnessProfile` from Firestore → builds system prompt
- Calls Claude API (`claude-sonnet-4-6`) with tools defined
- Handles tool calls: executes Firestore queries via Firebase Admin SDK, returns results to Claude
- Returns `{ reply: string }` to client

### 3. Firestore (existing + new)
- **Read:** existing workout collections — no schema changes
- **New:** `users/{uid}/coach/messages/{id}` for persistent chat history

---

## System Prompt

Injected on every request. Contains:

```
You are a personal gym coach. Answer questions about the user's workouts and provide 
personalized fitness advice. Use the provided tools to fetch workout data when needed. 
For general fitness knowledge questions or profile-based calculations (maintenance 
calories, macros, BMI), answer directly without tools.

USER PROFILE:
- Weight unit: {weightUnit}
- Rest timer default: {restDefaultSeconds}s
- Age: {age}, Sex: {sex}, Height: {height}cm, Body weight: {bodyWeight}kg
- Fitness level: {fitnessLevel}, Primary goal: {primaryGoal}, Body fat: {bodyFat}

WORKOUT DATA SCHEMA (WorkoutSet fields):
- id: string
- exerciseId: string
- exerciseName: string
- setNumber: number
- reps: number
- weight: number ({weightUnit})
- activeDuration: number (seconds — time under tension for the set)
- restDuration: number (seconds — rest taken after the set)
- kcal?: number (estimated calories burned, may be absent if user skipped onboarding)
- createdAt: Timestamp

When new fields are added to WorkoutSet in the future, append them here.

Today's date: {YYYY-MM-DD}
```

The schema comment is the only thing that needs updating when new fields are added to `WorkoutSet`.

---

## Tools

All tools return **complete raw Firestore documents** — every field on every set, unfiltered. Claude performs all aggregation and reasoning. This design is future-proof: new fields on `WorkoutSet` automatically flow to Claude; only the system prompt schema comment needs updating.

### `getWorkoutDay(date: string)`
Returns all sets logged on a specific date plus the workout metadata (type, completed).

```ts
// Input
{ date: "2026-05-24" }

// Output
{
  workout: { type: "push" | "pull" | "legs", completed: boolean },
  sets: WorkoutSet[]  // full objects, all fields
}
```

Use cases: daily volume, "how was my workout on X", day-to-day comparisons.

### `getWorkoutsInRange(startDate: string, endDate: string)`
Returns all workouts and their full sets between two dates (inclusive).

```ts
// Input
{ startDate: "2026-05-01", endDate: "2026-05-24" }

// Output
Array<{
  date: string,
  type: "push" | "pull" | "legs",
  completed: boolean,
  sets: WorkoutSet[]
}>
```

Use cases: weekly summaries, overtraining analysis, PPL balance, volume trends, streaks.

### `getExerciseHistory(exerciseName: string, limit?: number)`
Returns all logged sets for a specific exercise across all time, most recent first. Default limit: 100.

```ts
// Input
{ exerciseName: "Bench Press", limit: 50 }

// Output
Array<{
  date: string,
  sets: WorkoutSet[]
}>
```

Use cases: PRs, progress tracking, plateau detection, "when did I last do X".

---

## Question Categories

| Question type | Example | Data source | Tool calls |
|---|---|---|---|
| Pure fitness knowledge | "How long should I rest between sets?" | Claude training | None |
| Profile-based computation | "What are my maintenance calories?" | System prompt | None |
| Single-day analysis | "How much did I lift on Monday?" | Firestore | `getWorkoutDay` |
| Historical analysis | "Am I overtraining?" | Firestore | `getWorkoutsInRange` |
| Exercise-specific | "Show my bench press progress" | Firestore | `getExerciseHistory` |

---

## Conversation Persistence

**Firestore schema:**
```
users/{uid}/coach/messages/{id}
  role: "user" | "assistant"
  content: string
  createdAt: Timestamp
```

- On mount: load last 50 messages (ordered by `createdAt` asc) for display
- On send: last 10 messages sent to Netlify function as `history` for Claude context
- User message written to Firestore immediately (before function returns) for perceived speed
- Assistant reply written after function responds

---

## UI Design

**CHALK Athletic Brutalism** — consistent with existing screens.

- Acid yellow (`#E8FF3D`) top accent bar and active tab indicator
- `font-display` (Bebas Neue) for "COACH" header
- `font-mono` (JetBrains Mono) for labels and timestamps
- `font-sans` (DM Sans) for message text

**Message bubbles:**
- User: right-aligned, `bg-acid text-black`, sharp edges
- Assistant: left-aligned, `bg-iron-800 text-white`, sharp edges

**Empty state:** 4 tappable suggestion chips centered on screen:
- `AM I OVERTRAINING?`
- `WHAT ARE MY MAINTENANCE CALORIES?`
- `SHOW MY BENCH PROGRESS`
- `HOW WAS THIS WEEK?`

Tapping a chip fills the input and sends immediately.

**Loading state:** Animated three-dot indicator in an `iron-800` bubble while Claude is processing.

**Clear button:** `font-mono text-[10px]` in header — deletes all messages from Firestore after confirmation.

---

## Auth & Security

- Client sends Firebase ID token (`user.getIdToken()`) in every request header
- Netlify function verifies token with Firebase Admin SDK — `uid` extracted server-side
- `ANTHROPIC_API_KEY` and `FIREBASE_SERVICE_ACCOUNT` live only in Netlify env vars
- No Firebase credentials in client bundle

---

## Error Handling

- Function timeout / error → assistant bubble shows `"Something went wrong — try again."`
- User message already written to Firestore before error, so history is never lost
- Empty response from tool (no workout on that date) → Claude tells user naturally: "No workout logged for that date."

---

## Environment Variables (Netlify)

| Variable | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase service account JSON (stringified) |

---

## File Changes

```
netlify/
  functions/
    coach.ts              # New: Netlify serverless function

src/
  screens/
    CoachScreen.tsx       # New: chat UI, 5th tab
  components/
    BottomNav.tsx         # Update: add COACH tab (5th item)
  App.tsx                 # Update: add /coach route + CoachScreen import
  types/index.ts          # Update: add ChatMessage type
```

No changes to existing services, hooks, or workout data schema.
