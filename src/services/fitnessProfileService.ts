import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { FitnessProfile } from '../types'

function fitnessProfileRef(uid: string) {
  return doc(db, 'users', uid, 'data', 'fitnessProfile')
}

export async function getFitnessProfile(uid: string): Promise<FitnessProfile | null> {
  const snap = await getDoc(fitnessProfileRef(uid))
  if (!snap.exists()) return null
  return snap.data() as FitnessProfile
}

export async function saveFitnessProfile(uid: string, profile: FitnessProfile): Promise<void> {
  await setDoc(fitnessProfileRef(uid), profile)
}
