import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { UserProfile, WorkoutType, WorkoutProgram } from '../types'

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
    activeProgramId: 'ppl',
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

export async function updateRestDefault(uid: string, seconds: number): Promise<void> {
  await updateDoc(profileRef(uid), { restDefaultSeconds: seconds })
}

// Uses setDoc+merge so it works even if profile doc doesn't exist yet (onboarding)
export async function setActiveProgramId(uid: string, programId: string): Promise<void> {
  await setDoc(
    profileRef(uid),
    { activeProgramId: programId, lastWorkoutType: null },
    { merge: true },
  )
}

export async function saveCustomPrograms(
  uid: string,
  customPrograms: WorkoutProgram[],
): Promise<void> {
  await updateDoc(profileRef(uid), { customPrograms })
}
