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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 pt-10 flex flex-col min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate('/')} className="text-gray-400">← Back</button>
        <h1 className="font-bold text-lg capitalize">{workoutType} Day</h1>
        <button onClick={handleFinish} className="text-green-400 text-sm font-semibold">Finish</button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {exercises.map(ex => (
          <button
            key={ex.id}
            onClick={() => { setActiveExercise(ex); resetTimers() }}
            className={`px-3 py-2 rounded-xl text-sm whitespace-nowrap font-medium flex-shrink-0 ${
              activeExercise?.id === ex.id ? 'bg-indigo-600' : 'bg-gray-800'
            }`}
          >
            {ex.name}
          </button>
        ))}
      </div>

      <div className="bg-gray-800 rounded-2xl p-6 mb-4 flex flex-col items-center gap-4">
        {phase === 'rest' ? (
          <>
            <TimerDisplay seconds={restSeconds} label="Rest" negative />
            <p className="text-gray-400 text-sm">Resting… tap when ready for next set</p>
          </>
        ) : (
          <TimerDisplay seconds={setSeconds} label={phase === 'set' ? 'Set in progress' : 'Ready'} />
        )}

        <div className="flex gap-3 w-full">
          {phase === 'idle' && (
            <button
              onClick={startSet}
              className="flex-1 py-3 bg-indigo-600 rounded-xl font-bold active:bg-indigo-700"
            >
              Start Set
            </button>
          )}
          {phase === 'set' && (
            <button
              onClick={handleStopSet}
              className="flex-1 py-3 bg-red-600 rounded-xl font-bold active:bg-red-700"
            >
              Stop Set
            </button>
          )}
          {phase === 'rest' && (
            <button
              onClick={handleStartNextSet}
              className="flex-1 py-3 bg-indigo-600 rounded-xl font-bold active:bg-indigo-700"
            >
              Start Next Set
            </button>
          )}
        </div>
      </div>

      {setsForActive.length > 0 && (
        <div className="bg-gray-800 rounded-2xl p-4 mb-4">
          <p className="text-sm text-gray-400 mb-2 font-medium">{activeExercise?.name} — Sets logged</p>
          {setsForActive.map(s => <SetRow key={s.id} set={s} unit={weightUnit} />)}
        </div>
      )}

      {showSetModal && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-50">
          <div className="bg-gray-900 w-full rounded-t-2xl p-6 flex flex-col gap-4">
            <h2 className="text-lg font-bold">Log Set</h2>
            <p className="text-gray-400 text-sm">Set time: {pendingActiveDuration}s</p>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-gray-400 mb-1 block">Reps</label>
                <input
                  type="number"
                  className="w-full bg-gray-800 rounded-xl px-4 py-3 text-white text-center text-xl outline-none"
                  placeholder="12"
                  value={pendingReps}
                  onChange={e => setPendingReps(e.target.value)}
                  inputMode="numeric"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-400 mb-1 block">Weight ({weightUnit})</label>
                <input
                  type="number"
                  className="w-full bg-gray-800 rounded-xl px-4 py-3 text-white text-center text-xl outline-none"
                  placeholder="60"
                  value={pendingWeight}
                  onChange={e => setPendingWeight(e.target.value)}
                  inputMode="decimal"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowSetModal(false); resetTimers() }} className="flex-1 py-3 bg-gray-700 rounded-xl">Discard</button>
              <button onClick={handleSaveSet} className="flex-1 py-3 bg-indigo-600 rounded-xl font-bold">Save Set</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
