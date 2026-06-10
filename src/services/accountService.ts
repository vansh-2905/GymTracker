import { collection, doc, getDocs, deleteDoc } from 'firebase/firestore'
import { deleteUser, reauthenticateWithPopup } from 'firebase/auth'
import { auth, googleProvider, db } from '../firebase'

async function deleteCollection(uid: string, name: string): Promise<void> {
  const snap = await getDocs(collection(db, 'users', uid, name))
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)))
}

// Permanently deletes all of the user's data and their account.
// Order matters: reauthenticate first (deleting an auth user requires a recent
// sign-in, and a cancelled popup must abort before anything is removed), then
// wipe Firestore while security rules still grant access, then delete the
// auth user last.
export async function deleteAccount(): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new Error('Not signed in')
  const uid = user.uid

  await reauthenticateWithPopup(user, googleProvider)

  const workoutsSnap = await getDocs(collection(db, 'users', uid, 'workouts'))
  for (const w of workoutsSnap.docs) {
    const setsSnap = await getDocs(collection(db, 'users', uid, 'workouts', w.id, 'sets'))
    await Promise.all(setsSnap.docs.map(d => deleteDoc(d.ref)))
    await deleteDoc(w.ref)
  }

  await deleteCollection(uid, 'exercises')
  await deleteCollection(uid, 'templates')
  await deleteCollection(uid, 'coachMessages')
  await Promise.all([
    deleteDoc(doc(db, 'users', uid, 'data', 'profile')),
    deleteDoc(doc(db, 'users', uid, 'data', 'fitnessProfile')),
  ])

  await deleteUser(user)
}
