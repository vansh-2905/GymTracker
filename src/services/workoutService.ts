import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc,
  getDocs, query, orderBy, where, limit, documentId, Timestamp,
  type DocumentData
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Workout, WorkoutSet, WorkoutType } from '../types'

function workoutRef(uid: string, date: string) {
  return doc(db, 'users', uid, 'workouts', date)
}

function setsCol(uid: string, date: string) {
  return collection(db, 'users', uid, 'workouts', date, 'sets')
}

function workoutsCol(uid: string) {
  return collection(db, 'users', uid, 'workouts')
}

function mapWorkoutDoc(date: string, data: DocumentData): Workout {
  return {
    date,
    type: data['type'] as WorkoutType,
    startTime: (data['startTime'] as Timestamp).toDate(),
    endTime: data['endTime'] ? (data['endTime'] as Timestamp).toDate() : null,
    completed: data['completed'] as boolean,
  }
}

function mapSetDoc(id: string, data: DocumentData): WorkoutSet {
  return {
    id,
    exerciseId: data['exerciseId'] as string,
    exerciseName: data['exerciseName'] as string,
    setNumber: data['setNumber'] as number,
    reps: data['reps'] !== undefined ? (data['reps'] as number) : undefined,
    weight: data['weight'] !== undefined ? (data['weight'] as number) : undefined,
    sides: data['sides'] as WorkoutSet['sides'] | undefined,
    isTimed: data['isTimed'] as boolean | undefined,
    activeDuration: data['activeDuration'] as number,
    restDuration: data['restDuration'] as number,
    kcal: data['kcal'] !== undefined ? (data['kcal'] as number) : undefined,
    createdAt: (data['createdAt'] as Timestamp).toDate(),
  } as WorkoutSet
}

export async function getWorkout(uid: string, date: string): Promise<Workout | null> {
  const snap = await getDoc(workoutRef(uid, date))
  if (!snap.exists()) return null
  return mapWorkoutDoc(date, snap.data())
}

export async function startWorkout(uid: string, date: string, type: WorkoutType): Promise<Workout> {
  const startTime = new Date()
  await setDoc(workoutRef(uid, date), {
    type,
    startTime: Timestamp.fromDate(startTime),
    endTime: null,
    completed: false,
  })
  return { date, type, startTime, endTime: null, completed: false }
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
  return snap.docs.map(d => mapSetDoc(d.id, d.data()))
}

export async function getWorkoutsInRange(
  uid: string,
  startDate: string,
  endDate: string,
): Promise<Workout[]> {
  // Workout doc IDs are YYYY-MM-DD dates, so a documentId range query fetches
  // only the requested window instead of the user's entire history.
  const q = query(
    workoutsCol(uid),
    where(documentId(), '>=', startDate),
    where(documentId(), '<=', endDate),
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => mapWorkoutDoc(d.id, d.data()))
}

export async function updateSet(
  uid: string,
  date: string,
  setId: string,
  updates:
    | { reps: number; weight: number; sides?: never; isTimed?: never }
    | { sides: { left: { reps: number; weight: number }; right: { reps: number; weight: number } }; reps?: never; weight?: never; isTimed?: never }
    | { isTimed: true; activeDuration: number; weight?: number; reps?: never; sides?: never },
): Promise<void> {
  await updateDoc(doc(setsCol(uid, date), setId), updates)
}

export async function deleteSet(uid: string, date: string, setId: string): Promise<void> {
  await deleteDoc(doc(setsCol(uid, date), setId))
}

export async function deleteWorkout(uid: string, date: string): Promise<void> {
  const setsSnap = await getDocs(setsCol(uid, date))
  await Promise.all(setsSnap.docs.map(d => deleteDoc(d.ref)))
  await deleteDoc(workoutRef(uid, date))
}

// Returns all sets of the most recent `workoutCount` workouts before `beforeDate`,
// most recent first. Fetched with one limited query for the dates plus parallel
// set reads, so callers can derive per-exercise history from a single fetch
// instead of re-querying the whole history for every exercise.
export async function getRecentWorkoutSets(
  uid: string,
  beforeDate: string,
  workoutCount = 10,
): Promise<{ date: string; sets: WorkoutSet[] }[]> {
  const dq = query(
    workoutsCol(uid),
    where(documentId(), '<', beforeDate),
    orderBy(documentId(), 'desc'),
    limit(workoutCount),
  )
  const snap = await getDocs(dq)
  const dates = snap.docs.map(d => d.id)
  const setsPerDate = await Promise.all(dates.map(d => getSets(uid, d)))
  return dates.map((date, i) => ({ date, sets: setsPerDate[i] }))
}
