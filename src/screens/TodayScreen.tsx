import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { UserProfile, WorkoutSet, ProgramDay, WorkoutProgram } from '../types'
import { getProfile, initProfile, updateLastWorkout } from '../services/profileService'
import { getWorkout, startWorkout, getSets } from '../services/workoutService'
import { getProgramById, PRESET_PROGRAMS } from '../data/programs'
import { nextDayInProgram } from '../utils/rotation'

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
  const [activeProgram, setActiveProgram] = useState<WorkoutProgram>(PRESET_PROGRAMS[0])
  const [dueDay, setDueDay] = useState<ProgramDay>(PRESET_PROGRAMS[0].days[0])
  const [todayWorkout, setTodayWorkout] = useState<{ exists: boolean; completed: boolean } | null>(null)
  const [overrideDay, setOverrideDay] = useState<ProgramDay | null>(null)
  const [sessionKcal, setSessionKcal] = useState<number | null>(null)
  const [todaySets, setTodaySets] = useState<WorkoutSet[]>([])
  const [loading, setLoading] = useState(true)

  const date = todayDate()

  useEffect(() => {
    async function load() {
      let p = await getProfile(uid)
      if (!p) p = await initProfile(uid)
      setProfile(p)
      const prog = getProgramById(p.activeProgramId, p.customPrograms)
      setActiveProgram(prog)
      setDueDay(nextDayInProgram(p.lastWorkoutType, prog))
      const existing = await getWorkout(uid, date)
      if (existing) {
        setTodayWorkout({ exists: true, completed: existing.completed })
        const sets = await getSets(uid, date)
        setTodaySets(sets)
        const hasKcal = sets.some(s => s.kcal !== undefined)
        if (hasKcal) {
          setSessionKcal(sets.reduce((sum, s) => sum + (s.kcal ?? 0), 0))
        }
      } else {
        setTodayWorkout({ exists: false, completed: false })
      }
      setLoading(false)
    }
    load()
  }, [uid, date])

  const selectedDay = overrideDay ?? dueDay
  const color = selectedDay.color

  const handleStart = async () => {
    await startWorkout(uid, date, selectedDay.key)
    await updateLastWorkout(uid, selectedDay.key, date)
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
      <div className="h-0.5 w-full" style={{ backgroundColor: color }} />

      <div className="flex-1 flex flex-col p-5 pt-10">
        <div className="flex justify-between items-start mb-10">
          <div>
            <p className="font-mono text-iron-400 text-[10px] tracking-widest uppercase">
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

        <div className="flex-1 flex flex-col items-center justify-center mb-10">
          <p className="font-mono text-iron-500 text-[10px] tracking-widest uppercase mb-4">Due today</p>
          <div
            className="font-display leading-none text-center"
            style={{ fontSize: 'clamp(5rem, 28vw, 9rem)', color }}
          >
            {selectedDay.label.toUpperCase()}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-px w-8 bg-iron-700" />
            <p className="font-mono text-iron-500 text-[10px] tracking-widest uppercase">
              {profile?.weightUnit ?? 'kg'} · {user?.displayName?.split(' ')[0]}
            </p>
            <div className="h-px w-8 bg-iron-700" />
          </div>
        </div>

        {todayWorkout?.exists && todaySets.length > 0 && (() => {
          const grouped = todaySets.reduce<Record<string, WorkoutSet[]>>((acc, s) => {
            if (!acc[s.exerciseName]) acc[s.exerciseName] = []
            acc[s.exerciseName].push(s)
            return acc
          }, {})
          return (
            <div className="mb-5">
              <p className="font-mono text-iron-500 text-[10px] tracking-widest uppercase mb-2">Today's sets</p>
              <div className="border border-iron-800 divide-y divide-iron-800">
                {Object.entries(grouped).map(([name, sets]) => {
                  const lastWeight = sets[sets.length - 1].weight
                  const unit = profile?.weightUnit ?? 'kg'
                  return (
                    <div key={name} className="flex justify-between items-center py-2 px-3">
                      <span className="font-mono text-white text-[11px] uppercase tracking-wide">{name}</span>
                      <span className="font-mono text-iron-400 text-[10px] tracking-wider">
                        {sets.length} {sets.length === 1 ? 'set' : 'sets'} · {lastWeight}{unit}
                        {sets.some(s => s.kcal !== undefined) && (
                          <span className="text-acid ml-2">{Math.round(sets.reduce((s, x) => s + (x.kcal ?? 0), 0))} kcal</span>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Type override — driven by active program days */}
        <div className="mb-4">
          <p className="font-mono text-iron-500 text-[10px] tracking-widest uppercase mb-2">Override</p>
          <div className="flex border border-iron-700">
            {activeProgram.days.map((day, i) => (
              <button
                key={day.key}
                onClick={() => setOverrideDay(day.key === dueDay.key && overrideDay?.key === day.key ? null : day)}
                className="flex-1 py-3 font-mono text-xs uppercase tracking-wider transition-colors"
                style={{
                  backgroundColor: selectedDay.key === day.key ? day.color + '22' : 'transparent',
                  color: selectedDay.key === day.key ? day.color : '#555',
                  borderRight: i < activeProgram.days.length - 1 ? '1px solid #222' : 'none',
                }}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>

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
            Start {selectedDay.label} Workout
          </button>
        )}
        {sessionKcal !== null && sessionKcal > 0 && (
          <p className="font-mono text-iron-400 text-[12px] tracking-widest mt-3">
            {Math.round(sessionKcal)} KCAL BURNED TODAY
          </p>
        )}
      </div>
    </div>
  )
}
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { UserProfile, WorkoutSet, WorkoutType } from '../types'
import { getProfile, initProfile, updateLastWorkout } from '../services/profileService'
import { getWorkout, startWorkout, getSets } from '../services/workoutService'
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
  const [sessionKcal, setSessionKcal] = useState<number | null>(null)
  const [todaySets, setTodaySets] = useState<WorkoutSet[]>([])
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
      if (existing) {
        setTodayWorkout({ exists: true, completed: existing.completed })
        const sets = await getSets(uid, date)
        setTodaySets(sets)
        const hasKcal = sets.some(s => s.kcal !== undefined)
        if (hasKcal) {
          setSessionKcal(sets.reduce((sum, s) => sum + (s.kcal ?? 0), 0))
        }
      } else {
        setTodayWorkout({ exists: false, completed: false })
      }
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
            <p className="font-mono text-iron-400 text-[10px] tracking-widest uppercase">
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
          <p className="font-mono text-iron-500 text-[10px] tracking-widest uppercase mb-4">Due today</p>
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

        {/* Today's workout summary */}
        {todayWorkout?.exists && todaySets.length > 0 && (() => {
          const grouped = todaySets.reduce<Record<string, WorkoutSet[]>>((acc, s) => {
            if (!acc[s.exerciseName]) acc[s.exerciseName] = []
            acc[s.exerciseName].push(s)
            return acc
          }, {})
          return (
            <div className="mb-5">
              <p className="font-mono text-iron-500 text-[10px] tracking-widest uppercase mb-2">Today's sets</p>
              <div className="border border-iron-800 divide-y divide-iron-800">
                {Object.entries(grouped).map(([name, sets]) => {
                  const lastWeight = sets[sets.length - 1].weight
                  const unit = profile?.weightUnit ?? 'kg'
                  return (
                    <div key={name} className="flex justify-between items-center py-2 px-3">
                      <span className="font-mono text-white text-[11px] uppercase tracking-wide">{name}</span>
                      <span className="font-mono text-iron-400 text-[10px] tracking-wider">
                        {sets.length} {sets.length === 1 ? 'set' : 'sets'} · {lastWeight}{unit}
                        {sets.some(s => s.kcal !== undefined) && (
                          <span className="text-acid ml-2">{Math.round(sets.reduce((s, x) => s + (x.kcal ?? 0), 0))} kcal</span>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Type override */}
        <div className="mb-4">
          <p className="font-mono text-iron-500 text-[10px] tracking-widest uppercase mb-2">Override</p>
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
        {sessionKcal !== null && sessionKcal > 0 && (
          <p className="font-mono text-iron-400 text-[12px] tracking-widest mt-3">
            {Math.round(sessionKcal)} KCAL BURNED TODAY
          </p>
        )}
      </div>
    </div>
  )
}
