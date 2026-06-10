import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth, googleProvider } from '../firebase'

interface AuthContextValue {
  user: User | null
  loading: boolean
  needsOnboarding: boolean
  completeOnboarding: () => void
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        const { getFitnessProfile } = await import('../services/fitnessProfileService')
        const fp = await getFitnessProfile(u.uid)
        setNeedsOnboarding(!fp)
        if (fp) {
          // One-time backfill of stored kcal values; runs in the background
          import('../utils/kcalMigration')
            .then(({ recalculateAllSetKcal }) => recalculateAllSetKcal(u.uid))
            .catch(err => console.error('kcal recalculation failed', err))
        }
      } else {
        setNeedsOnboarding(false)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const signIn = async () => {
    const result = await signInWithPopup(auth, googleProvider)
    const { getProfile, initProfile } = await import('../services/profileService')
    const { seedDefaultExercises } = await import('../utils/seedExercises')
    const profile = await getProfile(result.user.uid)
    if (!profile) {
      await initProfile(result.user.uid)
      await seedDefaultExercises(result.user.uid)
    }
  }

  const signOutUser = async () => {
    await signOut(auth)
  }

  const completeOnboarding = () => setNeedsOnboarding(false)

  return (
    <AuthContext.Provider
      value={{ user, loading, needsOnboarding, completeOnboarding, signIn, signOut: signOutUser }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
