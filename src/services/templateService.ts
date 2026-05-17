import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { Template, WorkoutType } from '../types'

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
