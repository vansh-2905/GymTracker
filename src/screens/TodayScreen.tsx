import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { UserProfile, WorkoutType } from '../types'
import { getProfile, initProfile, updateLastWorkout } from '../services/profileService'
import { getWorkout, startWorkout } from '../services/workoutService'
import { nextWorkoutType } from '../utils/ppl'

const TYPE_LABELS: Record<WorkoutType, string> = { push: 'Push', pull: 'Pull', legs: 'Legs' }
const TYPE_COLORS: Record<WorkoutType, string> = {
  push: 'bg-blue-600',
  pull: 'bg-green-600',
  legs: 'bg-orange-600',
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

  const handleStart = async () => {
    await startWorkout(uid, date, selectedType)
    await updateLastWorkout(uid, selectedType, date)
    navigate(`/workout/${date}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 pt-12">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">Today</h1>
          <p className="text-gray-400 text-sm">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        <button onClick={signOut} className="text-gray-400 text-sm">Sign out</button>
      </div>

      <div className="bg-gray-800 rounded-2xl p-6 mb-6 text-center">
        <p className="text-gray-400 text-sm mb-2">Due today</p>
        <span className={`inline-block px-6 py-2 rounded-full text-white font-bold text-xl ${TYPE_COLORS[selectedType]}`}>
          {TYPE_LABELS[selectedType]}
        </span>
      </div>

      <div className="mb-6">
        <p className="text-gray-400 text-sm mb-2">Override workout type</p>
        <div className="flex rounded-xl bg-gray-800 p-1">
          {(['push', 'pull', 'legs'] as WorkoutType[]).map(type => (
            <button
              key={type}
              onClick={() => setOverrideType(type === dueType && overrideType === type ? null : type)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                selectedType === type ? 'bg-indigo-600 text-white' : 'text-gray-400'
              }`}
            >
              {TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {todayWorkout?.exists ? (
        <button
          onClick={() => navigate(`/workout/${date}`)}
          className="w-full py-4 bg-indigo-600 rounded-2xl font-bold text-lg active:bg-indigo-700"
        >
          {todayWorkout.completed ? "View Today's Workout" : 'Continue Workout'}
        </button>
      ) : (
        <button
          onClick={handleStart}
          className="w-full py-4 bg-indigo-600 rounded-2xl font-bold text-lg active:bg-indigo-700"
        >
          Start {TYPE_LABELS[selectedType]} Workout
        </button>
      )}

      <p className="text-gray-600 text-xs text-center mt-4">{profile?.weightUnit ?? 'kg'} · {user?.displayName}</p>
    </div>
  )
}
