import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth, googleProvider } from '../firebase'

interface AuthContextValue {
  user: User | null
  loading: boolean
  needsConsent: boolean
  acceptConsent: () => Promise<void>
  needsOnboarding: boolean
  completeOnboarding: () => void
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsConsent, setNeedsConsent] = useState(false)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        const [{ getFitnessProfile }, { getProfile }, { LEGAL_VERSION }] = await Promise.all([
          import('../services/fitnessProfileService'),
          import('../services/profileService'),
          import('../data/legal'),
        ])
        const [fp, profile] = await Promise.all([getFitnessProfile(u.uid), getProfile(u.uid)])
        setNeedsOnboarding(!fp)
        // Re-prompts automatically when LEGAL_VERSION is bumped
        setNeedsConsent(profile?.consents?.termsAndPrivacy?.version !== LEGAL_VERSION)
        if (fp) {
          // One-time backfill of stored kcal values; runs in the background
          import('../utils/kcalMigration')
            .then(({ recalculateAllSetKcal }) => recalculateAllSetKcal(u.uid))
            .catch(err => console.error('kcal recalculation failed', err))
        }
      } else {
        setNeedsConsent(false)
        setNeedsOnboarding(false)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const acceptConsent = async () => {
    if (!user) return
    const [{ recordConsent }, { LEGAL_VERSION }] = await Promise.all([
      import('../services/profileService'),
      import('../data/legal'),
    ])
    await recordConsent(user.uid, 'termsAndPrivacy', LEGAL_VERSION)
    setNeedsConsent(false)
  }

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
      value={{ user, loading, needsConsent, acceptConsent, needsOnboarding, completeOnboarding, signIn, signOut: signOutUser }}
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
