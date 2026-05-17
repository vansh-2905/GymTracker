import {
  doc, getDoc, setDoc, updateDoc, collection, addDoc,
  getDocs, query, orderBy, Timestamp
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Workout, WorkoutSet, WorkoutType } from '../types'

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
    type: d['type'] as WorkoutType,
    startTime: (d['startTime'] as Timestamp).toDate(),
    endTime: d['endTime'] ? (d['endTime'] as Timestamp).toDate() : null,
    completed: d['completed'] as boolean,
  }
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
  return snap.docs.map(d => {
    const data = d.data()
    return {
      id: d.id,
      exerciseId: data['exerciseId'] as string,
      exerciseName: data['exerciseName'] as string,
      setNumber: data['setNumber'] as number,
      reps: data['reps'] as number,
      weight: data['weight'] as number,
      activeDuration: data['activeDuration'] as number,
      restDuration: data['restDuration'] as number,
      createdAt: (data['createdAt'] as Timestamp).toDate(),
    } as WorkoutSet
  })
}

export async function getWorkoutsInRange(
  uid: string,
  startDate: string,
  endDate: string,
): Promise<Workout[]> {
  const col = collection(db, 'users', uid, 'workouts')
  const snap = await getDocs(col)
  return snap.docs
    .filter(d => d.id >= startDate && d.id <= endDate)
    .map(d => {
      const data = d.data()
      return {
        date: d.id,
        type: data['type'] as WorkoutType,
        startTime: (data['startTime'] as Timestamp).toDate(),
        endTime: data['endTime'] ? (data['endTime'] as Timestamp).toDate() : null,
        completed: data['completed'] as boolean,
      } as Workout
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}
