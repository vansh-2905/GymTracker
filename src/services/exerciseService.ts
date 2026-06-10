import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc, type DocumentData
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Exercise, WorkoutType } from '../types'

function exercisesCol(uid: string) {
  return collection(db, 'users', uid, 'exercises')
}

function mapExerciseDoc(id: string, data: DocumentData): Exercise {
  return {
    id,
    name: data['name'] as string,
    muscleGroup: data['muscleGroup'] as string,
    bilateral: data['bilateral'] as boolean | undefined,
    timed: data['timed'] as boolean | undefined,
    // Older docs stored a single `category`; normalize to the array form
    categories: (data['categories'] as WorkoutType[] | undefined) ??
      (data['category'] ? [data['category'] as WorkoutType] : []),
  }
}

export async function getExercises(uid: string): Promise<Exercise[]> {
  const snap = await getDocs(exercisesCol(uid))
  return snap.docs.map(d => mapExerciseDoc(d.id, d.data()))
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
