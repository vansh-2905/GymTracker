import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, where
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Exercise, WorkoutType } from '../types'

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
