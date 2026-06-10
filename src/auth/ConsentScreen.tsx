import { useState } from 'react'
import { useAuth } from './AuthContext'
import LegalModal from '../components/LegalModal'
import { PRIVACY_POLICY, TERMS_OF_USE, type LegalDoc } from '../data/legal'

export default function ConsentScreen() {
  const { acceptConsent, signOut } = useAuth()
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null)
  const [saving, setSaving] = useState(false)

  const handleAgree = async () => {
    setSaving(true)
    try {
      await acceptConsent()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-iron-950 flex flex-col">
      <div className="h-0.5 w-full bg-acid" />

      <div className="flex-1 flex flex-col justify-center px-6">
        <p className="font-mono text-iron-400 text-[10px] tracking-widest uppercase mb-3">
          Before you start
        </p>
        <h1 className="font-display text-5xl text-white leading-none mb-8">
          YOUR DATA,<br />
          <span className="text-acid">YOUR CALL</span>
        </h1>

        <p className="font-sans text-iron-300 text-sm leading-relaxed mb-6">
          GymTracker stores the workouts and fitness information you log, including
          health-related data like body weight, to provide your training history and
          calorie estimates.
        </p>

        <p className="font-sans text-iron-400 text-sm leading-relaxed">
          Read our{' '}
          <button onClick={() => setLegalDoc(PRIVACY_POLICY)} className="underline text-white">
            Privacy Policy
          </button>
          {' '}and{' '}
          <button onClick={() => setLegalDoc(TERMS_OF_USE)} className="underline text-white">
            Terms of Use
          </button>
          .
        </p>
      </div>

      <div className="p-6 pb-10">
        <button
          onClick={handleAgree}
          disabled={saving}
          className="w-full py-4 bg-acid text-black font-sans font-bold uppercase text-sm disabled:opacity-50 transition-opacity"
          style={{ letterSpacing: '0.12em' }}
        >
          {saving ? 'Saving…' : 'I agree, continue'}
        </button>
        <button
          onClick={() => signOut()}
          className="w-full py-3 mt-3 font-mono text-[10px] uppercase tracking-widest text-iron-500"
        >
          Decline & sign out
        </button>
      </div>

      {legalDoc && <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />}
    </div>
  )
}
