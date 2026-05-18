import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { UserProfile, WorkoutType } from '../types'
import { getProfile, initProfile, updateLastWorkout } from '../services/profileService'
import { getWorkout, startWorkout } from '../services/workoutService'
import { nextWorkoutType } from '../utils/ppl'

const TYPE_LABELS: Record<WorkoutType, string> = { push: 'PUSH', pull: 'PULL', legs: 'LEGS' }
const TYPE_COLOR: Record<WorkoutType, string> = {
  push: '#60A5FA',
  pull: '#4ADE80',
  legs: '#FB923C',
}

function todayDate(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

export default function TodayScreen() {
  const { user, signOut } = useAuth()
  const uid = user!.uid
  const navigate = useNavigate()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [dueType, setDueType] = useState<WorkoutType>('push')
  const [todayWorkout, setTodayWorkout] = useState<{ exists: boolean; completed: boolean } | null>(null)
  const [overrideType, setOverrideType] = useState<WorkoutType | null>(null)
  const [loading, setLoading] = useState(true)

  const date = todayDate()

  useEffect(() => {
    async function load() {
      let p = await getProfile(uid)
      if (!p) p = await initProfile(uid)
      setProfile(p)
      const next = nextWorkoutType(p.lastWorkoutType)
      setDueType(next)
      const existing = await getWorkout(uid, date)
      if (existing) setTodayWorkout({ exists: true, completed: existing.completed })
      else setTodayWorkout({ exists: false, completed: false })
      setLoading(false)
    }
    load()
  }, [uid, date])

  const selectedType = overrideType ?? dueType
  const color = TYPE_COLOR[selectedType]

  const handleStart = async () => {
    await startWorkout(uid, date, selectedType)
    await updateLastWorkout(uid, selectedType, date)
    navigate(`/workout/${date}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-iron-950">
        <div className="w-8 h-8 border-2 border-acid border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-iron-950 flex flex-col">
      {/* Accent top bar */}
      <div className="h-0.5 w-full" style={{ backgroundColor: color }} />

      <div className="flex-1 flex flex-col p-5 pt-10">
        {/* Header */}
        <div className="flex justify-between items-start mb-10">
          <div>
            <p className="font-mono text-iron-400 text-[10px] tracking-widest2 uppercase">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
            <h1 className="font-display text-5xl text-white leading-none mt-1">TODAY</h1>
          </div>
          <button
            onClick={signOut}
            className="font-mono text-iron-500 text-[10px] uppercase tracking-wider hover:text-iron-300 transition-colors mt-1"
          >
            Sign out
          </button>
        </div>

        {/* Due workout — big display */}
        <div className="flex-1 flex flex-col items-center justify-center mb-10">
          <p className="font-mono text-iron-500 text-[10px] tracking-widest2 uppercase mb-4">Due today</p>
          <div
            className="font-display leading-none text-center"
            style={{ fontSize: 'clamp(5rem, 28vw, 9rem)', color }}
          >
            {TYPE_LABELS[selectedType]}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-px w-8 bg-iron-700" />
            <p className="font-mono text-iron-500 text-[10px] tracking-widest uppercase">
              {profile?.weightUnit ?? 'kg'} · {user?.displayName?.split(' ')[0]}
            </p>
            <div className="h-px w-8 bg-iron-700" />
          </div>
        </div>

        {/* Type override */}
        <div className="mb-4">
          <p className="font-mono text-iron-500 text-[10px] tracking-widest2 uppercase mb-2">Override</p>
          <div className="flex border border-iron-700">
            {(['push', 'pull', 'legs'] as WorkoutType[]).map(type => (
              <button
                key={type}
                onClick={() => setOverrideType(type === dueType && overrideType === type ? null : type)}
                className="flex-1 py-3 font-mono text-xs uppercase tracking-wider transition-colors"
                style={{
                  backgroundColor: selectedType === type ? TYPE_COLOR[type] + '22' : 'transparent',
                  color: selectedType === type ? TYPE_COLOR[type] : '#555',
                  borderRight: type !== 'legs' ? '1px solid #222' : 'none',
                }}
              >
                {TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        {/* CTA */}
        {todayWorkout?.exists ? (
          <button
            onClick={() => navigate(`/workout/${date}`)}
            className="w-full py-5 font-sans font-bold uppercase text-sm text-black transition-opacity active:opacity-80"
            style={{ backgroundColor: color, letterSpacing: '0.12em' }}
          >
            {todayWorkout.completed ? "View Today's Workout" : 'Continue Workout'}
          </button>
        ) : (
          <button
            onClick={handleStart}
            className="w-full py-5 font-sans font-bold uppercase text-sm text-black transition-opacity active:opacity-80"
            style={{ backgroundColor: color, letterSpacing: '0.12em' }}
          >
            Start {TYPE_LABELS[selectedType]} Workout
          </button>
        )}
      </div>
    </div>
  )
}
