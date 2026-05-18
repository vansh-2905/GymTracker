import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { Exercise, WorkoutSet, WorkoutType } from '../types'
import { getProfile } from '../services/profileService'
import { getTemplate } from '../services/templateService'
import { getExercises } from '../services/exerciseService'
import { completeWorkout, getWorkout, getSets, logSet } from '../services/workoutService'
import { useTimer } from '../hooks/useTimer'
import TimerDisplay from '../components/TimerDisplay'
import SetRow from '../components/SetRow'

const TYPE_COLOR: Record<WorkoutType, string> = {
  push: '#60A5FA',
  pull: '#4ADE80',
  legs: '#FB923C',
}

export default function ActiveWorkoutScreen() {
  const { date } = useParams<{ date: string }>()
  const { user } = useAuth()
  const uid = user!.uid
  const navigate = useNavigate()

  const [exercises, setExercises] = useState<Exercise[]>([])
  const [sets, setSets] = useState<WorkoutSet[]>([])
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null)
  const [workoutType, setWorkoutType] = useState<WorkoutType>('push')
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg')
  const [pendingReps, setPendingReps] = useState('')
  const [pendingWeight, setPendingWeight] = useState('')
  const [showSetModal, setShowSetModal] = useState(false)
  const [pendingActiveDuration, setPendingActiveDuration] = useState(0)
  const [loading, setLoading] = useState(true)

  const { setSeconds, restSeconds, phase, startSet, stopSet, resetTimers } = useTimer()

  useEffect(() => {
    if (!date) return
    async function load() {
      const [profile, existingWorkout, existingSets] = await Promise.all([
        getProfile(uid),
        getWorkout(uid, date!),
        getSets(uid, date!),
      ])
      const unit = profile?.weightUnit ?? 'kg'
      setWeightUnit(unit)
      const type: WorkoutType = existingWorkout?.type ?? profile?.lastWorkoutType ?? 'push'
      setWorkoutType(type)
      const template = await getTemplate(uid, type)
      const allExercises = await getExercises(uid)
      const templateExercises = template.exerciseIds
        .map(id => allExercises.find(e => e.id === id))
        .filter(Boolean) as Exercise[]
      setExercises(templateExercises)
      setSets(existingSets)
      if (templateExercises.length > 0) setActiveExercise(templateExercises[0])
      setLoading(false)
    }
    load()
  }, [uid, date])

  const handleStopSet = () => {
    const elapsed = stopSet()
    setPendingActiveDuration(elapsed)
    setPendingReps('')
    setPendingWeight('')
    setShowSetModal(true)
  }

  const handleSaveSet = async () => {
    if (!activeExercise || !date) return
    const reps = parseInt(pendingReps)
    const weight = parseFloat(pendingWeight)
    if (isNaN(reps) || isNaN(weight)) return

    const existingForExercise = sets.filter(s => s.exerciseId === activeExercise.id)
    const setNumber = existingForExercise.length + 1
    const restDuration = 90 - restSeconds

    const newSet = await logSet(uid, date, {
      exerciseId: activeExercise.id,
      exerciseName: activeExercise.name,
      setNumber,
      reps,
      weight,
      activeDuration: pendingActiveDuration,
      restDuration,
      createdAt: new Date(),
    })
    setSets(prev => [...prev, newSet])
    setShowSetModal(false)
  }

  const handleStartNextSet = () => {
    setShowSetModal(false)
    resetTimers()
    startSet()
  }

  const handleFinish = async () => {
    if (!date) return
    await completeWorkout(uid, date)
    navigate('/')
  }

  const setsForActive = sets.filter(s => s.exerciseId === activeExercise?.id)
  const accentColor = TYPE_COLOR[workoutType]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-iron-950">
        <div className="w-8 h-8 border-2 border-acid border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-iron-950 flex flex-col pb-24">
      {/* Accent line */}
      <div className="h-0.5 w-full" style={{ backgroundColor: accentColor }} />

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-8 pb-4">
        <button
          onClick={() => navigate('/')}
          className="font-mono text-iron-400 text-xs uppercase tracking-wider hover:text-white transition-colors"
        >
          ← Back
        </button>
        <h1 className="font-display text-2xl tracking-wide" style={{ color: accentColor }}>
          {workoutType.toUpperCase()} DAY
        </h1>
        <button
          onClick={handleFinish}
          className="font-mono text-xs uppercase tracking-wider px-3 py-1.5 border transition-colors"
          style={{ borderColor: accentColor, color: accentColor }}
        >
          DONE
        </button>
      </div>

      {/* Exercise selector */}
      <div className="flex gap-2 overflow-x-auto px-5 pb-3 scrollbar-none">
        {exercises.map(ex => (
          <button
            key={ex.id}
            onClick={() => { setActiveExercise(ex); resetTimers() }}
            className="px-3 py-2 text-xs whitespace-nowrap font-mono uppercase tracking-wider flex-shrink-0 border transition-colors"
            style={
              activeExercise?.id === ex.id
                ? { borderColor: accentColor, color: accentColor, backgroundColor: accentColor + '15' }
                : { borderColor: '#2C2C2C', color: '#555' }
            }
          >
            {ex.name}
          </button>
        ))}
      </div>

      {/* Timer */}
      <div className="mx-5 mb-4 border border-iron-700 bg-iron-900 p-6 flex flex-col items-center gap-5">
        {phase === 'rest' ? (
          <>
            <TimerDisplay seconds={restSeconds} label="Rest Timer" negative />
            <p className="font-mono text-iron-500 text-[10px] uppercase tracking-widest">
              Resting — tap when ready
            </p>
          </>
        ) : (
          <TimerDisplay
            seconds={setSeconds}
            label={phase === 'set' ? 'Set Timer' : 'Ready'}
            active={phase === 'set'}
          />
        )}

        <div className="w-full">
          {phase === 'idle' && (
            <button
              onClick={startSet}
              className="w-full py-4 font-sans font-bold uppercase text-sm text-black transition-opacity active:opacity-80"
              style={{ backgroundColor: accentColor, letterSpacing: '0.12em' }}
            >
              Start Set
            </button>
          )}
          {phase === 'set' && (
            <button
              onClick={handleStopSet}
              className="w-full py-4 bg-red-500 font-sans font-bold uppercase text-sm text-white transition-opacity active:opacity-80"
              style={{ letterSpacing: '0.12em' }}
            >
              Stop Set
            </button>
          )}
          {phase === 'rest' && (
            <button
              onClick={handleStartNextSet}
              className="w-full py-4 font-sans font-bold uppercase text-sm text-black transition-opacity active:opacity-80"
              style={{ backgroundColor: accentColor, letterSpacing: '0.12em' }}
            >
              Next Set
            </button>
          )}
        </div>
      </div>

      {/* Logged sets */}
      {setsForActive.length > 0 && (
        <div className="mx-5 border border-iron-700 bg-iron-900 px-4 pb-2">
          <p className="font-mono text-[10px] uppercase tracking-widest2 pt-3 pb-2" style={{ color: accentColor }}>
            {activeExercise?.name}
          </p>
          {setsForActive.map(s => <SetRow key={s.id} set={s} unit={weightUnit} />)}
        </div>
      )}

      {/* Set log modal */}
      {showSetModal && (
        <div className="fixed inset-0 bg-black/85 flex items-end z-50">
          <div className="bg-iron-900 w-full border-t-2" style={{ borderColor: accentColor }}>
            <div className="p-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-display text-3xl text-white">LOG SET</h2>
                <span className="font-mono text-iron-400 text-xs">{pendingActiveDuration}s active</span>
              </div>

              <div className="flex gap-3 mb-4">
                <div className="flex-1">
                  <label className="font-mono text-[10px] text-iron-400 uppercase tracking-widest block mb-2">Reps</label>
                  <input
                    type="number"
                    className="w-full bg-iron-800 border border-iron-600 px-4 py-3 text-white text-center font-mono text-2xl font-bold outline-none focus:border-acid transition-colors"
                    placeholder="12"
                    value={pendingReps}
                    onChange={e => setPendingReps(e.target.value)}
                    inputMode="numeric"
                  />
                </div>
                <div className="flex-1">
                  <label className="font-mono text-[10px] text-iron-400 uppercase tracking-widest block mb-2">Weight ({weightUnit})</label>
                  <input
                    type="number"
                    className="w-full bg-iron-800 border border-iron-600 px-4 py-3 text-white text-center font-mono text-2xl font-bold outline-none focus:border-acid transition-colors"
                    placeholder="60"
                    value={pendingWeight}
                    onChange={e => setPendingWeight(e.target.value)}
                    inputMode="decimal"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowSetModal(false); resetTimers() }}
                  className="flex-1 py-4 border border-iron-600 font-mono text-xs uppercase tracking-wider text-iron-400 hover:text-white transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={handleSaveSet}
                  className="flex-1 py-4 font-sans font-bold uppercase text-sm text-black"
                  style={{ backgroundColor: accentColor, letterSpacing: '0.12em' }}
                >
                  Save Set
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
