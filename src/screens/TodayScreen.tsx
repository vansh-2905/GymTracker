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
  const { user } = useAuth()
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
        <div className="mb-10">
          <p className="font-mono text-iron-500 text-[10px] tracking-widest uppercase">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
          <h1 className="font-display text-5xl text-white leading-none mt-1">TODAY</h1>
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
              <div className="border border-iron-800 bg-iron-900">
                {Object.entries(grouped).map(([name, sets], idx, arr) => {
                  const exKcal = sets.some(s => s.kcal !== undefined)
                    ? Math.round(sets.reduce((s, x) => s + (x.kcal ?? 0), 0))
                    : null
                  return (
                    <div
                      key={name}
                      className="flex justify-between items-center py-2.5 px-3"
                      style={{ borderBottom: idx < arr.length - 1 ? '1px solid #1a1a1a' : 'none' }}
                    >
                      <span className="font-mono text-white text-[11px] uppercase tracking-wide">{name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-iron-500 text-[10px] tracking-wider">
                          {sets.length} {sets.length === 1 ? 'set' : 'sets'}
                        </span>
                        {exKcal !== null && (
                          <span className="font-mono text-[10px] text-acid tracking-wider">{exKcal} kcal</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Type override — driven by active program days */}
        <div className="mb-4">
          <p className="font-mono text-iron-500 text-[10px] tracking-widest uppercase mb-2">Select day</p>
          <div className="flex border border-iron-700 bg-iron-900">
            {activeProgram.days.map((day, i) => (
              <button
                key={day.key}
                onClick={() => setOverrideDay(day.key === dueDay.key && overrideDay?.key === day.key ? null : day)}
                className="flex-1 py-3 font-mono text-xs uppercase tracking-wider transition-all active:opacity-70"
                style={{
                  backgroundColor: selectedDay.key === day.key ? day.color + '1A' : 'transparent',
                  color: selectedDay.key === day.key ? day.color : '#444',
                  borderRight: i < activeProgram.days.length - 1 ? '1px solid #1a1a1a' : 'none',
                  borderBottom: selectedDay.key === day.key ? `2px solid ${day.color}` : '2px solid transparent',
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
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className="h-px flex-1 bg-iron-800" />
            <p className="font-mono text-acid text-[11px] tracking-widest">
              {Math.round(sessionKcal)} KCAL BURNED
            </p>
            <div className="h-px flex-1 bg-iron-800" />
          </div>
        )}
      </div>
    </div>
  )
}
