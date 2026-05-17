# GymTracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first PWA for tracking Push/Pull/Legs gym workouts with set timers, rest timers, calendar history, and a combined exercise library + template manager — backed by Firebase and hosted on Netlify.

**Architecture:** React 18 + Vite SPA with React Router for four screens (Today, Active Workout, Calendar, Exercises & Templates). All state is synced to Firestore under `users/{uid}/`; timers live only in React state and are written to Firestore on set completion. Firebase Auth (Google) gates all data access.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind CSS, Firebase v10 (Auth + Firestore), vite-plugin-pwa, React Router v6, Vitest, Netlify.

---

## File Map

```
GymTracker/
├── public/
│   └── icons/
│       ├── icon-192.png          # PWA icon (placeholder — replace before launch)
│       └── icon-512.png
├── src/
│   ├── main.tsx                  # Entry point, wraps App in AuthProvider
│   ├── App.tsx                   # Router, BottomNav, screen routing
│   ├── firebase.ts               # Firebase app init, auth + firestore exports
│   ├── types/index.ts            # All shared TypeScript types
│   ├── utils/ppl.ts              # PPL rotation pure logic
│   ├── auth/
│   │   ├── AuthContext.tsx       # AuthProvider + useAuth hook
│   │   └── SignInScreen.tsx      # Google sign-in UI
│   ├── services/
│   │   ├── profileService.ts     # profile doc CRUD
│   │   ├── exerciseService.ts    # exercises collection CRUD
│   │   ├── templateService.ts    # templates collection CRUD
│   │   └── workoutService.ts     # workouts + sets CRUD
│   ├── hooks/
│   │   └── useTimer.ts           # set timer (up) + rest timer (down, goes negative)
│   ├── components/
│   │   ├── BottomNav.tsx         # Four-tab bottom navigation
│   │   ├── TimerDisplay.tsx      # Formatted timer display (handles negative)
│   │   ├── SetRow.tsx            # One logged set row (reps, weight, durations)
│   │   ├── ExerciseCard.tsx      # Exercise card with toggle + drag handle
│   │   └── WorkoutSummary.tsx    # Read-only past workout modal
│   └── screens/
│       ├── TodayScreen.tsx       # PPL rotation, start workout
│       ├── ActiveWorkoutScreen.tsx  # Live workout: timer + set logging
│       ├── CalendarScreen.tsx    # Monthly calendar, tap to see history
│       └── ExercisesScreen.tsx   # Exercises + template tabs (Push/Pull/Legs)
├── firestore.rules               # Firestore security rules
├── netlify.toml                  # SPA redirect rule
├── vite.config.ts
├── tailwind.config.js
├── vitest.config.ts
└── .env.example
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tailwind.config.js`, `vitest.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `.env.example`, `netlify.toml`

- [ ] **Step 1: Scaffold Vite project**

```bash
cd /Users/vansh/Documents/GymTracker
npm create vite@latest . -- --template react-ts
```

- [ ] **Step 2: Install dependencies**

```bash
npm install firebase react-router-dom@6
npm install -D tailwindcss postcss autoprefixer vite-plugin-pwa workbox-window vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
npx tailwindcss init -p
```

- [ ] **Step 3: Replace `vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'GymTracker',
        short_name: 'GymTracker',
        description: 'Track your Push Pull Legs workouts',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
    }),
  ],
})
```

- [ ] **Step 4: Replace `tailwind.config.js`**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

- [ ] **Step 5: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

- [ ] **Step 6: Create `src/test-setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 7: Replace `src/index.css` with Tailwind directives**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 8: Create `netlify.toml`**

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

- [ ] **Step 9: Create `.env.example`**

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

- [ ] **Step 10: Create `src/App.tsx` (empty shell)**

```tsx
export default function App() {
  return <div className="min-h-screen bg-gray-950 text-white">GymTracker</div>
}
```

- [ ] **Step 11: Replace `src/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 12: Run dev server to verify scaffold works**

```bash
npm run dev
```

Expected: Dev server starts, browser shows "GymTracker" on dark background.

- [ ] **Step 13: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Vite + React + Tailwind + PWA project"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Create `src/types/index.ts`**

```typescript
export type WorkoutType = 'push' | 'pull' | 'legs'
export type WeightUnit = 'kg' | 'lbs'

export interface UserProfile {
  lastWorkoutType: WorkoutType | null
  lastWorkoutDate: string | null  // YYYY-MM-DD
  weightUnit: WeightUnit
}

export interface Exercise {
  id: string
  name: string
  category: WorkoutType
  muscleGroup: string
}

export interface Template {
  type: WorkoutType
  exerciseIds: string[]  // ordered
}

export interface WorkoutSet {
  id: string
  exerciseId: string
  exerciseName: string
  setNumber: number
  reps: number
  weight: number
  activeDuration: number   // seconds
  restDuration: number     // seconds (can exceed 90)
  createdAt: Date
}

export interface Workout {
  date: string             // YYYY-MM-DD, also the doc ID
  type: WorkoutType
  startTime: Date
  endTime: Date | null
  completed: boolean
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 3: Firebase Setup

**Files:**
- Create: `src/firebase.ts`

- [ ] **Step 1: Create a Firebase project**

Go to https://console.firebase.google.com → New project → "GymTracker" → Enable Google Analytics: No.

- [ ] **Step 2: Enable Firestore**

Firebase console → Firestore Database → Create database → Start in production mode → Choose region (us-central1 or nearest).

- [ ] **Step 3: Enable Google Auth**

Firebase console → Authentication → Sign-in method → Google → Enable → Save.

- [ ] **Step 4: Get Firebase config**

Firebase console → Project settings → Your apps → Add app → Web → Register → Copy the config object.

- [ ] **Step 5: Create `.env` with your config values**

```bash
cp .env.example .env
# Fill in the values from Firebase console
```

- [ ] **Step 6: Create `src/firebase.ts`**

```typescript
import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
export const db = getFirestore(app)

enableIndexedDbPersistence(db).catch(() => {
  // Offline persistence unavailable (e.g., multiple tabs) — silently continue
})
```

- [ ] **Step 7: Commit**

```bash
git add src/firebase.ts .env.example
git commit -m "feat: initialize Firebase app with Auth and Firestore"
```

---

## Task 4: Auth Context + Sign-In Screen

**Files:**
- Create: `src/auth/AuthContext.tsx`, `src/auth/SignInScreen.tsx`
- Modify: `src/main.tsx`, `src/App.tsx`

- [ ] **Step 1: Create `src/auth/AuthContext.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider } from '../firebase'

interface AuthContextValue {
  user: User | null
  loading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return unsub
  }, [])

  const signIn = async () => {
    await signInWithPopup(auth, googleProvider)
  }

  const signOutUser = async () => {
    await signOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut: signOutUser }}>
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

- [ ] **Step 2: Create `src/auth/SignInScreen.tsx`**

```tsx
import { useAuth } from './AuthContext'

export default function SignInScreen() {
  const { signIn } = useAuth()

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-2">GymTracker</h1>
        <p className="text-gray-400">Log your Push · Pull · Legs</p>
      </div>
      <button
        onClick={signIn}
        className="flex items-center gap-3 bg-white text-gray-900 font-semibold px-6 py-3 rounded-xl shadow-lg active:scale-95 transition-transform"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Update `src/App.tsx` to gate on auth**

```tsx
import { useAuth } from './auth/AuthContext'
import SignInScreen from './auth/SignInScreen'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <SignInScreen />

  return <div className="min-h-screen bg-gray-950 text-white">Logged in as {user.displayName}</div>
}
```

- [ ] **Step 4: Update `src/main.tsx` to wrap with AuthProvider**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { AuthProvider } from './auth/AuthContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
)
```

- [ ] **Step 5: Run and verify sign-in works**

```bash
npm run dev
```

Expected: Sign-in screen appears. Clicking "Continue with Google" opens Google OAuth popup. After sign-in, shows "Logged in as [Your Name]".

- [ ] **Step 6: Commit**

```bash
git add src/auth/ src/App.tsx src/main.tsx
git commit -m "feat: add Firebase Auth with Google sign-in"
```

---

## Task 5: PPL Rotation Logic + Tests

**Files:**
- Create: `src/utils/ppl.ts`, `src/utils/ppl.test.ts`

- [ ] **Step 1: Write failing tests in `src/utils/ppl.test.ts`**

```typescript
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
  it('returns push N days later cycling correctly', () => {
    // legs → push → pull → legs
    expect(getProjectedType('legs', '2026-05-15', '2026-05-18')).toBe('legs')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/utils/ppl.test.ts
```

Expected: FAIL — `getProjectedType` and `nextWorkoutType` not found.

- [ ] **Step 3: Create `src/utils/ppl.ts`**

```typescript
import { WorkoutType } from '../types'

const SEQUENCE: WorkoutType[] = ['push', 'pull', 'legs']

export function nextWorkoutType(last: WorkoutType | null): WorkoutType {
  if (!last) return 'push'
  const idx = SEQUENCE.indexOf(last)
  return SEQUENCE[(idx + 1) % 3]
}

// Returns the projected workout type for `targetDate` given the last completed
// workout. Steps through the rotation one day at a time from lastDate.
export function getProjectedType(
  lastType: WorkoutType,
  lastDate: string,
  targetDate: string,
): WorkoutType {
  const last = new Date(lastDate)
  const target = new Date(targetDate)
  const days = Math.round((target.getTime() - last.getTime()) / 86_400_000)
  if (days <= 0) return lastType
  let type = lastType
  for (let i = 0; i < days; i++) type = nextWorkoutType(type)
  return type
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/utils/ppl.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/
git commit -m "feat: add PPL rotation logic with tests"
```

---

## Task 6: Profile Service

**Files:**
- Create: `src/services/profileService.ts`

- [ ] **Step 1: Create `src/services/profileService.ts`**

```typescript
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { UserProfile, WorkoutType } from '../types'

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
```

- [ ] **Step 2: Commit**

```bash
git add src/services/profileService.ts
git commit -m "feat: add profile service for PPL state and weight unit"
```

---

## Task 7: Exercise Service

**Files:**
- Create: `src/services/exerciseService.ts`

- [ ] **Step 1: Create `src/services/exerciseService.ts`**

```typescript
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, where
} from 'firebase/firestore'
import { db } from '../firebase'
import { Exercise, WorkoutType } from '../types'

function exercisesCol(uid: string) {
  return collection(db, 'users', uid, 'exercises')
}

export async function getExercises(uid: string): Promise<Exercise[]> {
  const snap = await getDocs(exercisesCol(uid))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Exercise))
}

export async function getExercisesByCategory(uid: string, category: WorkoutType): Promise<Exercise[]> {
  const q = query(exercisesCol(uid), where('category', '==', category))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Exercise))
}

export async function addExercise(
  uid: string,
  exercise: Omit<Exercise, 'id'>,
): Promise<Exercise> {
  const ref = await addDoc(exercisesCol(uid), exercise)
  return { id: ref.id, ...exercise }
}

export async function updateExercise(
  uid: string,
  id: string,
  updates: Partial<Omit<Exercise, 'id'>>,
): Promise<void> {
  await updateDoc(doc(exercisesCol(uid), id), updates)
}

export async function deleteExercise(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(exercisesCol(uid), id))
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/exerciseService.ts
git commit -m "feat: add exercise service (CRUD)"
```

---

## Task 8: Template Service

**Files:**
- Create: `src/services/templateService.ts`

- [ ] **Step 1: Create `src/services/templateService.ts`**

```typescript
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { Template, WorkoutType } from '../types'

function templateRef(uid: string, type: WorkoutType) {
  return doc(db, 'users', uid, 'templates', type)
}

export async function getTemplate(uid: string, type: WorkoutType): Promise<Template> {
  const snap = await getDoc(templateRef(uid, type))
  if (!snap.exists()) return { type, exerciseIds: [] }
  return { type, ...snap.data() } as Template
}

export async function saveTemplate(uid: string, template: Template): Promise<void> {
  await setDoc(templateRef(uid, template.type), { exerciseIds: template.exerciseIds })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/templateService.ts
git commit -m "feat: add template service"
```

---

## Task 9: Workout Service

**Files:**
- Create: `src/services/workoutService.ts`

- [ ] **Step 1: Create `src/services/workoutService.ts`**

```typescript
import {
  doc, getDoc, setDoc, updateDoc, collection, addDoc,
  getDocs, query, orderBy, Timestamp
} from 'firebase/firestore'
import { db } from '../firebase'
import { Workout, WorkoutSet, WorkoutType } from '../types'

function workoutRef(uid: string, date: string) {
  return doc(db, 'users', uid, 'workouts', date)
}

function setsCol(uid: string, date: string) {
  return collection(db, 'users', uid, 'workouts', date, 'sets')
}

export async function getWorkout(uid: string, date: string): Promise<Workout | null> {
  const snap = await getDoc(workoutRef(uid, date))
  if (!snap.exists()) return null
  const d = snap.data()
  return {
    date,
    type: d.type,
    startTime: d.startTime.toDate(),
    endTime: d.endTime ? d.endTime.toDate() : null,
    completed: d.completed,
  }
}

export async function startWorkout(uid: string, date: string, type: WorkoutType): Promise<Workout> {
  const workout: Omit<Workout, 'date'> = {
    type,
    startTime: new Date(),
    endTime: null,
    completed: false,
  }
  await setDoc(workoutRef(uid, date), {
    ...workout,
    startTime: Timestamp.fromDate(workout.startTime),
    endTime: null,
  })
  return { date, ...workout }
}

export async function completeWorkout(uid: string, date: string): Promise<void> {
  await updateDoc(workoutRef(uid, date), {
    completed: true,
    endTime: Timestamp.fromDate(new Date()),
  })
}

export async function logSet(uid: string, date: string, set: Omit<WorkoutSet, 'id'>): Promise<WorkoutSet> {
  const ref = await addDoc(setsCol(uid, date), {
    ...set,
    createdAt: Timestamp.fromDate(set.createdAt),
  })
  return { id: ref.id, ...set }
}

export async function getSets(uid: string, date: string): Promise<WorkoutSet[]> {
  const q = query(setsCol(uid, date), orderBy('createdAt'))
  const snap = await getDocs(q)
  return snap.docs.map(d => {
    const data = d.data()
    return {
      id: d.id,
      exerciseId: data.exerciseId,
      exerciseName: data.exerciseName,
      setNumber: data.setNumber,
      reps: data.reps,
      weight: data.weight,
      activeDuration: data.activeDuration,
      restDuration: data.restDuration,
      createdAt: data.createdAt.toDate(),
    } as WorkoutSet
  })
}

export async function getWorkoutsInRange(
  uid: string,
  startDate: string,
  endDate: string,
): Promise<Workout[]> {
  // Fetches all workouts; filters in-memory since date is the doc ID
  const col = collection(db, 'users', uid, 'workouts')
  const snap = await getDocs(col)
  return snap.docs
    .filter(d => d.id >= startDate && d.id <= endDate)
    .map(d => {
      const data = d.data()
      return {
        date: d.id,
        type: data.type,
        startTime: data.startTime.toDate(),
        endTime: data.endTime ? data.endTime.toDate() : null,
        completed: data.completed,
      } as Workout
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/workoutService.ts
git commit -m "feat: add workout service (CRUD for workouts and sets)"
```

---

## Task 10: Timer Hook + Tests

**Files:**
- Create: `src/hooks/useTimer.ts`, `src/hooks/useTimer.test.ts`

- [ ] **Step 1: Write failing tests in `src/hooks/useTimer.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTimer } from './useTimer'

describe('useTimer', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('set timer starts at 0 and increments', () => {
    const { result } = renderHook(() => useTimer())
    act(() => { result.current.startSet() })
    act(() => { vi.advanceTimersByTime(3000) })
    expect(result.current.setSeconds).toBe(3)
  })

  it('stopSet returns elapsed seconds and starts rest timer', () => {
    const { result } = renderHook(() => useTimer())
    act(() => { result.current.startSet() })
    act(() => { vi.advanceTimersByTime(5000) })
    let elapsed = 0
    act(() => { elapsed = result.current.stopSet() })
    expect(elapsed).toBe(5)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.restSeconds).toBe(89)
  })

  it('rest timer goes negative after 90 seconds', () => {
    const { result } = renderHook(() => useTimer())
    act(() => { result.current.startSet() })
    act(() => { result.current.stopSet() })
    act(() => { vi.advanceTimersByTime(100_000) })
    expect(result.current.restSeconds).toBeLessThan(0)
  })

  it('resetTimers clears both timers to initial state', () => {
    const { result } = renderHook(() => useTimer())
    act(() => { result.current.startSet() })
    act(() => { vi.advanceTimersByTime(3000) })
    act(() => { result.current.stopSet() })
    act(() => { result.current.resetTimers() })
    expect(result.current.setSeconds).toBe(0)
    expect(result.current.restSeconds).toBe(90)
    expect(result.current.phase).toBe('idle')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/hooks/useTimer.test.ts
```

Expected: FAIL — `useTimer` not found.

- [ ] **Step 3: Create `src/hooks/useTimer.ts`**

```typescript
import { useState, useRef, useCallback } from 'react'

export type TimerPhase = 'idle' | 'set' | 'rest'

export function useTimer() {
  const [setSeconds, setSetSeconds] = useState(0)
  const [restSeconds, setRestSeconds] = useState(90)
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
    setRestSeconds(90)
    setPhase('rest')
    intervalRef.current = setInterval(() => setRestSeconds(s => s - 1), 1000)
    return elapsed
  }, [])

  const resetTimers = useCallback(() => {
    clearInterval_()
    setSecondsRef.current = 0
    setSetSeconds(0)
    setRestSeconds(90)
    setPhase('idle')
  }, [])

  return { setSeconds, restSeconds, phase, startSet, stopSet, resetTimers }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/hooks/useTimer.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/
git commit -m "feat: add useTimer hook with set and rest timer logic"
```

---

## Task 11: Bottom Nav + App Shell with Routing

**Files:**
- Create: `src/components/BottomNav.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/components/BottomNav.tsx`**

```tsx
import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/',          label: 'Today',    icon: '🏠' },
  { to: '/calendar',  label: 'Calendar', icon: '📅' },
  { to: '/exercises', label: 'Exercises',icon: '💪' },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex">
      {tabs.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center py-3 text-xs gap-1 transition-colors ${
              isActive ? 'text-indigo-400' : 'text-gray-500'
            }`
          }
        >
          <span className="text-xl">{tab.icon}</span>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
```

- [ ] **Step 2: Replace `src/App.tsx` with full routing shell**

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import SignInScreen from './auth/SignInScreen'
import BottomNav from './components/BottomNav'
import TodayScreen from './screens/TodayScreen'
import ActiveWorkoutScreen from './screens/ActiveWorkoutScreen'
import CalendarScreen from './screens/CalendarScreen'
import ExercisesScreen from './screens/ExercisesScreen'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <SignInScreen />

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950 text-white pb-20">
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

- [ ] **Step 3: Create placeholder screens (so routing compiles)**

Create `src/screens/TodayScreen.tsx`:
```tsx
export default function TodayScreen() {
  return <div className="p-6 pt-12 text-white">Today</div>
}
```

Create `src/screens/ActiveWorkoutScreen.tsx`:
```tsx
export default function ActiveWorkoutScreen() {
  return <div className="p-6 pt-12 text-white">Active Workout</div>
}
```

Create `src/screens/CalendarScreen.tsx`:
```tsx
export default function CalendarScreen() {
  return <div className="p-6 pt-12 text-white">Calendar</div>
}
```

Create `src/screens/ExercisesScreen.tsx`:
```tsx
export default function ExercisesScreen() {
  return <div className="p-6 pt-12 text-white">Exercises</div>
}
```

- [ ] **Step 4: Run dev server and verify routing works**

```bash
npm run dev
```

Expected: App loads with bottom nav; tapping tabs navigates between placeholder screens.

- [ ] **Step 5: Commit**

```bash
git add src/components/BottomNav.tsx src/App.tsx src/screens/
git commit -m "feat: add bottom nav and React Router shell with placeholder screens"
```

---

## Task 12: Exercises & Templates Screen

**Files:**
- Create: `src/components/ExerciseCard.tsx`
- Modify: `src/screens/ExercisesScreen.tsx`

- [ ] **Step 1: Create `src/components/ExerciseCard.tsx`**

```tsx
import { Exercise } from '../types'

interface Props {
  exercise: Exercise
  inTemplate: boolean
  onToggleTemplate: (id: string) => void
  onEdit: (exercise: Exercise) => void
  onDelete: (id: string) => void
}

export default function ExerciseCard({ exercise, inTemplate, onToggleTemplate, onEdit, onDelete }: Props) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex items-center gap-3">
      <button
        onClick={() => onToggleTemplate(exercise.id)}
        className={`w-6 h-6 rounded-full border-2 flex-shrink-0 transition-colors ${
          inTemplate ? 'bg-indigo-500 border-indigo-500' : 'border-gray-500'
        }`}
      />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white truncate">{exercise.name}</p>
        <p className="text-xs text-gray-400">{exercise.muscleGroup}</p>
      </div>
      <button onClick={() => onEdit(exercise)} className="text-gray-400 px-2 py-1 text-sm">Edit</button>
      <button onClick={() => onDelete(exercise.id)} className="text-red-400 px-2 py-1 text-sm">Del</button>
    </div>
  )
}
```

- [ ] **Step 2: Replace `src/screens/ExercisesScreen.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { Exercise, Template, WorkoutType } from '../types'
import { getExercises, addExercise, updateExercise, deleteExercise } from '../services/exerciseService'
import { getTemplate, saveTemplate } from '../services/templateService'
import ExerciseCard from '../components/ExerciseCard'

const TABS: WorkoutType[] = ['push', 'pull', 'legs']
const TAB_LABELS: Record<WorkoutType, string> = { push: 'Push', pull: 'Pull', legs: 'Legs' }

const EMPTY_FORM = { name: '', category: 'push' as WorkoutType, muscleGroup: '' }

export default function ExercisesScreen() {
  const { user } = useAuth()
  const uid = user!.uid

  const [activeTab, setActiveTab] = useState<WorkoutType>('push')
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [templates, setTemplates] = useState<Record<WorkoutType, Template>>({
    push: { type: 'push', exerciseIds: [] },
    pull: { type: 'pull', exerciseIds: [] },
    legs: { type: 'legs', exerciseIds: [] },
  })
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Exercise | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    getExercises(uid).then(setExercises)
    Promise.all(TABS.map(t => getTemplate(uid, t))).then(([push, pull, legs]) => {
      setTemplates({ push, pull, legs })
    })
  }, [uid])

  const tabExercises = exercises.filter(e => e.category === activeTab)
  const currentTemplate = templates[activeTab]

  const openAdd = () => {
    setEditTarget(null)
    setForm({ ...EMPTY_FORM, category: activeTab })
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
    // Remove from templates if present
    for (const type of TABS) {
      const t = templates[type]
      if (t.exerciseIds.includes(id)) {
        const updated = { ...t, exerciseIds: t.exerciseIds.filter(eid => eid !== id) }
        await saveTemplate(uid, updated)
        setTemplates(prev => ({ ...prev, [type]: updated }))
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
    setTemplates(prev => ({ ...prev, [activeTab]: updated }))
  }

  return (
    <div className="p-4 pt-12">
      <h1 className="text-2xl font-bold mb-4">Exercises & Templates</h1>

      {/* Tabs */}
      <div className="flex rounded-xl bg-gray-800 p-1 mb-4">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === tab ? 'bg-indigo-600 text-white' : 'text-gray-400'
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Exercise list */}
      <div className="flex flex-col gap-2 mb-4">
        {tabExercises.length === 0 && (
          <p className="text-gray-500 text-center py-8">No exercises yet. Add one below.</p>
        )}
        {tabExercises.map(ex => (
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

      <button
        onClick={openAdd}
        className="w-full py-3 bg-indigo-600 rounded-xl font-semibold active:bg-indigo-700"
      >
        + Add Exercise
      </button>

      {/* Add/Edit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-50" onClick={() => setShowModal(false)}>
          <div className="bg-gray-900 w-full rounded-t-2xl p-6 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">{editTarget ? 'Edit Exercise' : 'Add Exercise'}</h2>
            <input
              className="bg-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none"
              placeholder="Exercise name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
            <input
              className="bg-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none"
              placeholder="Muscle group (e.g. Chest)"
              value={form.muscleGroup}
              onChange={e => setForm(f => ({ ...f, muscleGroup: e.target.value }))}
            />
            <div className="flex rounded-xl bg-gray-800 p-1">
              {TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setForm(f => ({ ...f, category: tab }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    form.category === tab ? 'bg-indigo-600 text-white' : 'text-gray-400'
                  }`}
                >
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 bg-gray-700 rounded-xl">Cancel</button>
              <button onClick={handleSave} className="flex-1 py-3 bg-indigo-600 rounded-xl font-semibold">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Run dev and verify exercises screen works end-to-end**

```bash
npm run dev
```

Expected: Navigate to Exercises tab. Add an exercise (name, muscle group, category). It appears in the list. Toggle the circle to include it in the template (circle fills indigo). Delete it — it disappears.

- [ ] **Step 4: Commit**

```bash
git add src/screens/ExercisesScreen.tsx src/components/ExerciseCard.tsx
git commit -m "feat: build Exercises & Templates screen with CRUD and template toggling"
```

---

## Task 13: Today Screen

**Files:**
- Modify: `src/screens/TodayScreen.tsx`

- [ ] **Step 1: Replace `src/screens/TodayScreen.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { UserProfile, WorkoutType } from '../types'
import { getProfile, initProfile, updateLastWorkout } from '../services/profileService'
import { getWorkout, startWorkout } from '../services/workoutService'
import { nextWorkoutType } from '../utils/ppl'

const TYPE_LABELS: Record<WorkoutType, string> = { push: 'Push', pull: 'Pull', legs: 'Legs' }
const TYPE_COLORS: Record<WorkoutType, string> = {
  push: 'bg-blue-600',
  pull: 'bg-green-600',
  legs: 'bg-orange-600',
}

function todayDate(): string {
  return new Date().toISOString().split('T')[0]
}

export default function TodayScreen() {
  const { user, signOut } = useAuth()
  const uid = user!.uid
  const navigate = useNavigate()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [dueType, setDueType] = useState<WorkoutType>('push')
  const [todayWorkout, setTodayWorkout] = useState<{ exists: boolean; completed: boolean } | null>(null)
  const [overrideType, setOverrideType] = useState<WorkoutType | null>(null)
  const [loading, setLoading] = useState(true)

  const date = todayDate()

  useEffect(() => {
    async function load() {
      let p = await getProfile(uid)
      if (!p) p = await initProfile(uid)
      setProfile(p)
      const next = nextWorkoutType(p.lastWorkoutType)
      setDueType(next)
      const existing = await getWorkout(uid, date)
      if (existing) setTodayWorkout({ exists: true, completed: existing.completed })
      else setTodayWorkout({ exists: false, completed: false })
      setLoading(false)
    }
    load()
  }, [uid, date])

  const selectedType = overrideType ?? dueType

  const handleStart = async () => {
    await startWorkout(uid, date, selectedType)
    await updateLastWorkout(uid, selectedType, date)
    navigate(`/workout/${date}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 pt-12">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">Today</h1>
          <p className="text-gray-400 text-sm">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        <button onClick={signOut} className="text-gray-400 text-sm">Sign out</button>
      </div>

      <div className="bg-gray-800 rounded-2xl p-6 mb-6 text-center">
        <p className="text-gray-400 text-sm mb-2">Due today</p>
        <span className={`inline-block px-6 py-2 rounded-full text-white font-bold text-xl ${TYPE_COLORS[selectedType]}`}>
          {TYPE_LABELS[selectedType]}
        </span>
      </div>

      {/* Override */}
      <div className="mb-6">
        <p className="text-gray-400 text-sm mb-2">Override workout type</p>
        <div className="flex rounded-xl bg-gray-800 p-1">
          {(['push', 'pull', 'legs'] as WorkoutType[]).map(type => (
            <button
              key={type}
              onClick={() => setOverrideType(type === dueType && overrideType === type ? null : type)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                selectedType === type ? 'bg-indigo-600 text-white' : 'text-gray-400'
              }`}
            >
              {TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {todayWorkout?.exists ? (
        <button
          onClick={() => navigate(`/workout/${date}`)}
          className="w-full py-4 bg-indigo-600 rounded-2xl font-bold text-lg active:bg-indigo-700"
        >
          {todayWorkout.completed ? 'View Today\'s Workout' : 'Continue Workout'}
        </button>
      ) : (
        <button
          onClick={handleStart}
          className="w-full py-4 bg-indigo-600 rounded-2xl font-bold text-lg active:bg-indigo-700"
        >
          Start {TYPE_LABELS[selectedType]} Workout
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run dev and verify Today screen**

```bash
npm run dev
```

Expected: Today screen shows the due workout type (Push on first use). Override buttons switch the type. "Start Push Workout" button appears. Tapping it navigates to `/workout/YYYY-MM-DD`.

- [ ] **Step 3: Commit**

```bash
git add src/screens/TodayScreen.tsx
git commit -m "feat: build Today screen with PPL rotation and workout override"
```

---

## Task 14: Timer Components + Active Workout Screen

**Files:**
- Create: `src/components/TimerDisplay.tsx`, `src/components/SetRow.tsx`
- Modify: `src/screens/ActiveWorkoutScreen.tsx`

- [ ] **Step 1: Create `src/components/TimerDisplay.tsx`**

```tsx
interface Props {
  seconds: number
  label: string
  negative?: boolean
}

function format(secs: number): string {
  const abs = Math.abs(secs)
  const m = Math.floor(abs / 60).toString().padStart(2, '0')
  const s = (abs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function TimerDisplay({ seconds, label, negative }: Props) {
  const isNeg = seconds < 0
  return (
    <div className="text-center">
      <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-4xl font-mono font-bold ${isNeg ? 'text-red-400' : negative ? 'text-white' : 'text-white'}`}>
        {isNeg ? '−' : ''}{format(seconds)}
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/SetRow.tsx`**

```tsx
import { WorkoutSet } from '../types'

interface Props {
  set: WorkoutSet
  unit: string
}

function fmtTime(secs: number): string {
  const m = Math.floor(Math.abs(secs) / 60)
  const s = Math.abs(secs) % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export default function SetRow({ set, unit }: Props) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
      <span className="text-gray-400 text-sm w-6">#{set.setNumber}</span>
      <span className="font-semibold">{set.reps} reps</span>
      <span className="font-semibold">{set.weight}{unit}</span>
      <span className="text-gray-400 text-xs">{fmtTime(set.activeDuration)} active</span>
      <span className="text-gray-400 text-xs">{fmtTime(set.restDuration)} rest</span>
    </div>
  )
}
```

- [ ] **Step 3: Replace `src/screens/ActiveWorkoutScreen.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Exercise, WorkoutSet, WorkoutType } from '../types'
import { getProfile } from '../services/profileService'
import { getTemplate } from '../services/templateService'
import { getExercises } from '../services/exerciseService'
import { completeWorkout, getWorkout, getSets, logSet } from '../services/workoutService'
import { useTimer } from '../hooks/useTimer'
import TimerDisplay from '../components/TimerDisplay'
import SetRow from '../components/SetRow'

export default function ActiveWorkoutScreen() {
  const { date } = useParams<{ date: string }>()
  const { user } = useAuth()
  const uid = user!.uid
  const navigate = useNavigate()

  const [exercises, setExercises] = useState<Exercise[]>([])
  const [sets, setSets] = useState<WorkoutSet[]>([])
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null)
  const [workoutType, setWorkoutType] = useState<WorkoutType>('push')
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg')
  const [pendingReps, setPendingReps] = useState('')
  const [pendingWeight, setPendingWeight] = useState('')
  const [showSetModal, setShowSetModal] = useState(false)
  const [pendingActiveDuration, setPendingActiveDuration] = useState(0)
  const [loading, setLoading] = useState(true)

  const { setSeconds, restSeconds, phase, startSet, stopSet, resetTimers } = useTimer()

  useEffect(() => {
    if (!date) return
    async function load() {
      const [profile, existingWorkout, existingSets] = await Promise.all([
        getProfile(uid),
        getWorkout(uid, date!),
        getSets(uid, date!),
      ])
      const unit = profile?.weightUnit ?? 'kg'
      setWeightUnit(unit)
      // Read type from the workout doc itself — profile.lastWorkoutType may differ if user overrode
      const type: WorkoutType = existingWorkout?.type ?? profile?.lastWorkoutType ?? 'push'
      setWorkoutType(type)
      const template = await getTemplate(uid, type)
      const allExercises = await getExercises(uid)
      const templateExercises = template.exerciseIds
        .map(id => allExercises.find(e => e.id === id))
        .filter(Boolean) as Exercise[]
      setExercises(templateExercises)
      setSets(existingSets)
      if (templateExercises.length > 0) setActiveExercise(templateExercises[0])
      setLoading(false)
    }
    load()
  }, [uid, date])

  const handleStopSet = () => {
    const elapsed = stopSet()
    setPendingActiveDuration(elapsed)
    setPendingReps('')
    setPendingWeight('')
    setShowSetModal(true)
  }

  const handleSaveSet = async () => {
    if (!activeExercise || !date) return
    const reps = parseInt(pendingReps)
    const weight = parseFloat(pendingWeight)
    if (isNaN(reps) || isNaN(weight)) return

    const existingForExercise = sets.filter(s => s.exerciseId === activeExercise.id)
    const setNumber = existingForExercise.length + 1
    const restDuration = 90 - restSeconds  // how many seconds of rest taken so far

    const newSet = await logSet(uid, date, {
      exerciseId: activeExercise.id,
      exerciseName: activeExercise.name,
      setNumber,
      reps,
      weight,
      activeDuration: pendingActiveDuration,
      restDuration,
      createdAt: new Date(),
    })
    setSets(prev => [...prev, newSet])
    setShowSetModal(false)
  }

  const handleStartNextSet = () => {
    setShowSetModal(false)
    resetTimers()
    startSet()
  }

  const handleFinish = async () => {
    if (!date) return
    await completeWorkout(uid, date)
    navigate('/')
  }

  const setsForActive = sets.filter(s => s.exerciseId === activeExercise?.id)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 pt-10 flex flex-col min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate('/')} className="text-gray-400">← Back</button>
        <h1 className="font-bold text-lg capitalize">{workoutType} Day</h1>
        <button onClick={handleFinish} className="text-green-400 text-sm font-semibold">Finish</button>
      </div>

      {/* Exercise selector */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {exercises.map(ex => (
          <button
            key={ex.id}
            onClick={() => { setActiveExercise(ex); resetTimers() }}
            className={`px-3 py-2 rounded-xl text-sm whitespace-nowrap font-medium flex-shrink-0 ${
              activeExercise?.id === ex.id ? 'bg-indigo-600' : 'bg-gray-800'
            }`}
          >
            {ex.name}
          </button>
        ))}
      </div>

      {/* Timer area */}
      <div className="bg-gray-800 rounded-2xl p-6 mb-4 flex flex-col items-center gap-4">
        {phase === 'rest' ? (
          <>
            <TimerDisplay seconds={restSeconds} label="Rest" negative />
            <p className="text-gray-400 text-sm">Resting… tap when ready for next set</p>
          </>
        ) : (
          <TimerDisplay seconds={setSeconds} label={phase === 'set' ? 'Set in progress' : 'Ready'} />
        )}

        <div className="flex gap-3 w-full">
          {phase === 'idle' && (
            <button
              onClick={startSet}
              className="flex-1 py-3 bg-indigo-600 rounded-xl font-bold active:bg-indigo-700"
            >
              Start Set
            </button>
          )}
          {phase === 'set' && (
            <button
              onClick={handleStopSet}
              className="flex-1 py-3 bg-red-600 rounded-xl font-bold active:bg-red-700"
            >
              Stop Set
            </button>
          )}
          {phase === 'rest' && (
            <button
              onClick={handleStartNextSet}
              className="flex-1 py-3 bg-indigo-600 rounded-xl font-bold active:bg-indigo-700"
            >
              Start Next Set
            </button>
          )}
        </div>
      </div>

      {/* Logged sets */}
      {setsForActive.length > 0 && (
        <div className="bg-gray-800 rounded-2xl p-4 mb-4">
          <p className="text-sm text-gray-400 mb-2 font-medium">{activeExercise?.name} — Sets logged</p>
          {setsForActive.map(s => <SetRow key={s.id} set={s} unit={weightUnit} />)}
        </div>
      )}

      {/* Set detail modal (reps + weight entry) */}
      {showSetModal && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-50">
          <div className="bg-gray-900 w-full rounded-t-2xl p-6 flex flex-col gap-4">
            <h2 className="text-lg font-bold">Log Set</h2>
            <p className="text-gray-400 text-sm">Set time: {pendingActiveDuration}s</p>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-gray-400 mb-1 block">Reps</label>
                <input
                  type="number"
                  className="w-full bg-gray-800 rounded-xl px-4 py-3 text-white text-center text-xl outline-none"
                  placeholder="12"
                  value={pendingReps}
                  onChange={e => setPendingReps(e.target.value)}
                  inputMode="numeric"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-400 mb-1 block">Weight ({weightUnit})</label>
                <input
                  type="number"
                  className="w-full bg-gray-800 rounded-xl px-4 py-3 text-white text-center text-xl outline-none"
                  placeholder="60"
                  value={pendingWeight}
                  onChange={e => setPendingWeight(e.target.value)}
                  inputMode="decimal"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowSetModal(false); resetTimers() }} className="flex-1 py-3 bg-gray-700 rounded-xl">Discard</button>
              <button onClick={handleSaveSet} className="flex-1 py-3 bg-indigo-600 rounded-xl font-bold">Save Set</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run dev and do a full workout flow test**

```bash
npm run dev
```

Expected:
1. Today screen → Start Push Workout → navigates to `/workout/YYYY-MM-DD`
2. Select an exercise from the horizontal scroll
3. Tap "Start Set" → timer counts up
4. Tap "Stop Set" → modal shows with reps/weight fields
5. Enter reps (e.g. 10) and weight (e.g. 60) → Save Set
6. Rest timer counts down from 90 → goes red and negative past 0
7. Tap "Start Next Set" → resets
8. Tap "Finish" → returns to Today screen

- [ ] **Step 5: Commit**

```bash
git add src/screens/ActiveWorkoutScreen.tsx src/components/TimerDisplay.tsx src/components/SetRow.tsx
git commit -m "feat: build Active Workout screen with set/rest timers and set logging"
```

---

## Task 15: Calendar Screen

**Files:**
- Create: `src/components/WorkoutSummary.tsx`
- Modify: `src/screens/CalendarScreen.tsx`

- [ ] **Step 1: Create `src/components/WorkoutSummary.tsx`**

```tsx
import { Workout, WorkoutSet } from '../types'

interface Props {
  workout: Workout
  sets: WorkoutSet[]
  weightUnit: string
  onClose: () => void
}

function groupByExercise(sets: WorkoutSet[]): Record<string, WorkoutSet[]> {
  return sets.reduce((acc, s) => {
    if (!acc[s.exerciseName]) acc[s.exerciseName] = []
    acc[s.exerciseName].push(s)
    return acc
  }, {} as Record<string, WorkoutSet[]>)
}

export default function WorkoutSummary({ workout, sets, weightUnit, onClose }: Props) {
  const grouped = groupByExercise(sets)
  return (
    <div className="fixed inset-0 bg-black/70 flex items-end z-50" onClick={onClose}>
      <div className="bg-gray-900 w-full rounded-t-2xl p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold capitalize">{workout.type} — {workout.date}</h2>
          <button onClick={onClose} className="text-gray-400">✕</button>
        </div>
        {Object.entries(grouped).map(([name, exerciseSets]) => (
          <div key={name} className="mb-4">
            <p className="font-semibold text-indigo-300 mb-2">{name}</p>
            {exerciseSets.map(s => (
              <div key={s.id} className="flex justify-between text-sm py-1 text-gray-300">
                <span>Set {s.setNumber}</span>
                <span>{s.reps} reps</span>
                <span>{s.weight}{weightUnit}</span>
              </div>
            ))}
          </div>
        ))}
        {sets.length === 0 && <p className="text-gray-400">No sets recorded.</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace `src/screens/CalendarScreen.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { Workout, WorkoutSet, WorkoutType } from '../types'
import { getWorkoutsInRange, getSets } from '../services/workoutService'
import { getProfile } from '../services/profileService'
import { getProjectedType } from '../utils/ppl'
import WorkoutSummary from '../components/WorkoutSummary'

const TYPE_DOT: Record<WorkoutType, string> = {
  push: 'bg-blue-500',
  pull: 'bg-green-500',
  legs: 'bg-orange-500',
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

export default function CalendarScreen() {
  const { user } = useAuth()
  const uid = user!.uid

  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [workouts, setWorkouts] = useState<Record<string, Workout>>({})
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null)
  const [selectedSets, setSelectedSets] = useState<WorkoutSet[]>([])
  const [weightUnit, setWeightUnit] = useState('kg')
  const [lastType, setLastType] = useState<WorkoutType | null>(null)
  const [lastDate, setLastDate] = useState<string | null>(null)

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
      }
    })
  }, [uid, viewYear, viewMonth])

  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

  const handleDayPress = async (dateStr: string) => {
    const w = workouts[dateStr]
    if (!w) return
    const sets = await getSets(uid, dateStr)
    setSelectedSets(sets)
    setSelectedWorkout(w)
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
  const monthName = new Date(viewYear, viewMonth).toLocaleString('default', { month: 'long', year: 'numeric' })

  return (
    <div className="p-4 pt-12">
      <h1 className="text-2xl font-bold mb-4">Calendar</h1>

      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="text-gray-400 px-3 py-2">‹</button>
        <span className="font-semibold">{monthName}</span>
        <button onClick={nextMonth} className="text-gray-400 px-3 py-2">›</button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className="text-center text-xs text-gray-500 py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
          const workout = workouts[dateStr]
          const isToday = dateStr === today
          const isFuture = dateStr > today

          let projected: WorkoutType | null = null
          if (isFuture && lastType && lastDate) {
            projected = getProjectedType(lastType, lastDate, dateStr)
          }

          return (
            <button
              key={dateStr}
              onClick={() => handleDayPress(dateStr)}
              className={`aspect-square rounded-xl flex flex-col items-center justify-center relative
                ${isToday ? 'ring-2 ring-indigo-400' : ''}
                ${workout ? 'bg-gray-800' : 'bg-gray-900'}
              `}
            >
              <span className={`text-sm font-medium ${isToday ? 'text-indigo-300' : 'text-white'}`}>{day}</span>
              {workout && (
                <span className={`w-2 h-2 rounded-full mt-0.5 ${TYPE_DOT[workout.type]} ${workout.completed ? 'opacity-100' : 'opacity-40'}`} />
              )}
              {!workout && isFuture && projected && (
                <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${TYPE_DOT[projected]} opacity-20`} />
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-4 justify-center">
        {(['push','pull','legs'] as WorkoutType[]).map(t => (
          <div key={t} className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className={`w-2 h-2 rounded-full ${TYPE_DOT[t]}`} />
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </div>
        ))}
      </div>

      {selectedWorkout && (
        <WorkoutSummary
          workout={selectedWorkout}
          sets={selectedSets}
          weightUnit={weightUnit}
          onClose={() => setSelectedWorkout(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Run dev and verify Calendar screen**

```bash
npm run dev
```

Expected: Calendar shows current month. Today's date has an indigo ring. Completed workouts show a colored dot. Tapping a workout day opens a bottom-sheet summary with sets grouped by exercise. Future days show faint projected type dots.

- [ ] **Step 4: Commit**

```bash
git add src/screens/CalendarScreen.tsx src/components/WorkoutSummary.tsx
git commit -m "feat: build Calendar screen with workout history and PPL projection"
```

---

## Task 16: Firestore Security Rules + PWA Icons + Netlify Deploy

**Files:**
- Create: `firestore.rules`, `public/icons/icon-192.png`, `public/icons/icon-512.png`

- [ ] **Step 1: Create `firestore.rules`**

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

- [ ] **Step 2: Deploy Firestore rules via Firebase console**

Firebase console → Firestore → Rules tab → Replace with the rules above → Publish.

- [ ] **Step 3: Create placeholder PWA icons**

```bash
# Create a simple colored square as placeholder icon (replace with real icon before launch)
# Use any image editor to create 192x192 and 512x512 PNG files
# Place them at public/icons/icon-192.png and public/icons/icon-512.png
# Quick option: use an online generator like realfavicongenerator.net
```

As a temporary placeholder you can download any PNG and resize it — the app will still install without a real icon.

- [ ] **Step 4: Build for production and verify**

```bash
npm run build
```

Expected: Build succeeds in `dist/` with no TypeScript errors.

- [ ] **Step 5: Connect to Netlify**

1. Go to https://netlify.com → Add new site → Import from Git (or drag-and-drop the `dist/` folder for a quick test)
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Add environment variables from your `.env` file in Netlify → Site settings → Environment variables

- [ ] **Step 6: Add Firebase authorized domain**

Firebase console → Authentication → Settings → Authorized domains → Add your Netlify domain (e.g. `gymtracker-xyz.netlify.app`).

- [ ] **Step 7: Commit**

```bash
git add firestore.rules netlify.toml public/
git commit -m "feat: add Firestore security rules and Netlify deploy config"
```

- [ ] **Step 8: Test iPhone home screen install**

Open the Netlify URL in Safari on iPhone → Share → Add to Home Screen → Open app. Expected: Launches full-screen without browser chrome.

---

## Task 17: Seed Default Exercises (Optional Quality-of-Life)

**Files:**
- Create: `src/utils/seedExercises.ts`

- [ ] **Step 1: Create `src/utils/seedExercises.ts`**

```typescript
import { addExercise } from '../services/exerciseService'
import { saveTemplate } from '../services/templateService'
import { Exercise, WorkoutType } from '../types'

const DEFAULT_EXERCISES: Omit<Exercise, 'id'>[] = [
  // Push
  { name: 'Bench Press', category: 'push', muscleGroup: 'Chest' },
  { name: 'Overhead Press', category: 'push', muscleGroup: 'Shoulders' },
  { name: 'Incline Dumbbell Press', category: 'push', muscleGroup: 'Chest' },
  { name: 'Lateral Raises', category: 'push', muscleGroup: 'Shoulders' },
  { name: 'Tricep Pushdown', category: 'push', muscleGroup: 'Triceps' },
  // Pull
  { name: 'Deadlift', category: 'pull', muscleGroup: 'Back' },
  { name: 'Pull-ups', category: 'pull', muscleGroup: 'Back' },
  { name: 'Barbell Row', category: 'pull', muscleGroup: 'Back' },
  { name: 'Face Pulls', category: 'pull', muscleGroup: 'Rear Delts' },
  { name: 'Bicep Curl', category: 'pull', muscleGroup: 'Biceps' },
  // Legs
  { name: 'Squat', category: 'legs', muscleGroup: 'Quads' },
  { name: 'Romanian Deadlift', category: 'legs', muscleGroup: 'Hamstrings' },
  { name: 'Leg Press', category: 'legs', muscleGroup: 'Quads' },
  { name: 'Leg Curl', category: 'legs', muscleGroup: 'Hamstrings' },
  { name: 'Calf Raises', category: 'legs', muscleGroup: 'Calves' },
]

export async function seedDefaultExercises(uid: string): Promise<void> {
  const created: Record<WorkoutType, string[]> = { push: [], pull: [], legs: [] }
  for (const ex of DEFAULT_EXERCISES) {
    const added = await addExercise(uid, ex)
    created[ex.category].push(added.id)
  }
  // Set default templates with all exercises in order
  await saveTemplate(uid, { type: 'push', exerciseIds: created.push })
  await saveTemplate(uid, { type: 'pull', exerciseIds: created.pull })
  await saveTemplate(uid, { type: 'legs', exerciseIds: created.legs })
}
```

- [ ] **Step 2: Call seed on first login in `src/auth/AuthContext.tsx`**

Add to the `signIn` function after sign-in succeeds:

```typescript
// In AuthContext.tsx, update the signIn function:
const signIn = async () => {
  const result = await signInWithPopup(auth, googleProvider)
  // Check if this is a new user
  const { getProfile, initProfile } = await import('../services/profileService')
  const { seedDefaultExercises } = await import('../utils/seedExercises')
  const profile = await getProfile(result.user.uid)
  if (!profile) {
    await initProfile(result.user.uid)
    await seedDefaultExercises(result.user.uid)
  }
}
```

- [ ] **Step 3: Test with a fresh account**

Sign in with a Google account that hasn't used the app. Expected: Exercises & Templates screen pre-populated with 15 default exercises, all included in their respective templates.

- [ ] **Step 4: Commit**

```bash
git add src/utils/seedExercises.ts src/auth/AuthContext.tsx
git commit -m "feat: seed default PPL exercises on first login"
```
