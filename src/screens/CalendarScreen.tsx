import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { Workout, WorkoutSet, WorkoutType } from '../types'
import { getWorkoutsInRange, getSets, startWorkout } from '../services/workoutService'
import { getProfile, updateLastWorkout } from '../services/profileService'
import { getProjectedType } from '../utils/ppl'
import WorkoutSummary from '../components/WorkoutSummary'

const TYPE_COLOR: Record<WorkoutType, string> = {
  push: '#60A5FA',
  pull: '#4ADE80',
  legs: '#FB923C',
}
const TYPE_LABELS: Record<WorkoutType, string> = { push: 'PUSH', pull: 'PULL', legs: 'LEGS' }
const TABS: WorkoutType[] = ['push', 'pull', 'legs']

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}
function pad(n: number) {
  return n.toString().padStart(2, '0')
}

export default function CalendarScreen() {
  const { user } = useAuth()
  const uid = user!.uid
  const navigate = useNavigate()

  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [workouts, setWorkouts] = useState<Record<string, Workout>>({})
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null)
  const [selectedSets, setSelectedSets] = useState<WorkoutSet[]>([])
  const [weightUnit, setWeightUnit] = useState('kg')
  const [lastType, setLastType] = useState<WorkoutType | null>(null)
  const [lastDate, setLastDate] = useState<string | null>(null)
  const [startModal, setStartModal] = useState<{ date: string; type: WorkoutType } | null>(null)

  useEffect(() => {
    const start = `${viewYear}-${pad(viewMonth + 1)}-01`
    const end = `${viewYear}-${pad(viewMonth + 1)}-${pad(getDaysInMonth(viewYear, viewMonth))}`
    getWorkoutsInRange(uid, start, end).then(list => {
      const map: Record<string, Workout> = {}
      list.forEach(w => { map[w.date] = w })
      setWorkouts(map)
    })
    getProfile(uid).then(p => {
      if (p) {
        setWeightUnit(p.weightUnit)
        setLastType(p.lastWorkoutType)
        setLastDate(p.lastWorkoutDate)
      }
    })
  }, [uid, viewYear, viewMonth])

  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

  const handleDayPress = async (dateStr: string) => {
    if (dateStr > today) return
    const w = workouts[dateStr]
    if (w) {
      const sets = await getSets(uid, dateStr)
      setSelectedSets(sets)
      setSelectedWorkout(w)
    } else {
      const projected = lastType && lastDate ? getProjectedType(lastType, lastDate, dateStr) : 'push'
      setStartModal({ date: dateStr, type: projected as WorkoutType })
    }
  }

  const handleStartPastWorkout = async () => {
    if (!startModal) return
    await startWorkout(uid, startModal.date, startModal.type)
    await updateLastWorkout(uid, startModal.type, startModal.date)
    setStartModal(null)
    navigate(`/workout/${startModal.date}`)
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth)
  const monthName = new Date(viewYear, viewMonth).toLocaleString('default', { month: 'long' })

  return (
    <div className="min-h-screen bg-iron-950 pb-24">
      <div className="h-0.5 bg-acid w-full" />

      <div className="px-5 pt-10 pb-4">
        <h1 className="font-display text-5xl text-white leading-none">LOG</h1>
        <p className="font-mono text-iron-500 text-[10px] uppercase tracking-widest mt-1">Workout History</p>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between px-5 mb-4">
        <button onClick={prevMonth} className="font-mono text-iron-400 text-sm hover:text-white transition-colors px-2 py-1">‹ PREV</button>
        <div className="text-center">
          <p className="font-display text-2xl text-white tracking-wide">{monthName.toUpperCase()}</p>
          <p className="font-mono text-iron-500 text-[10px]">{viewYear}</p>
        </div>
        <button onClick={nextMonth} className="font-mono text-iron-400 text-sm hover:text-white transition-colors px-2 py-1">NEXT ›</button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 px-5 mb-1">
        {['SU','MO','TU','WE','TH','FR','SA'].map(d => (
          <div key={d} className="text-center font-mono text-iron-600 text-[9px] py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px px-5">
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
          const workout = workouts[dateStr]
          const isToday = dateStr === today
          const isFuture = dateStr > today
          const wColor = workout ? TYPE_COLOR[workout.type] : null

          let projected: WorkoutType | null = null
          if (isFuture && lastType && lastDate) {
            projected = getProjectedType(lastType, lastDate, dateStr)
          }

          return (
            <button
              key={dateStr}
              onClick={() => handleDayPress(dateStr)}
              disabled={isFuture}
              className="aspect-square flex flex-col items-center justify-center relative transition-colors"
              style={{
                backgroundColor: workout ? wColor + '15' : isToday ? '#E8FF3D08' : 'transparent',
                outline: isToday ? '1px solid #E8FF3D40' : workout ? `1px solid ${wColor}30` : '1px solid #1A1A1A',
              }}
            >
              <span
                className="font-mono text-xs font-bold"
                style={{ color: isToday ? '#E8FF3D' : isFuture ? '#2A2A2A' : '#AAAAAA' }}
              >
                {day}
              </span>
              {workout && (
                <span
                  className="w-1.5 h-1.5 rounded-full mt-0.5"
                  style={{
                    backgroundColor: wColor ?? '#fff',
                    opacity: workout.completed ? 1 : 0.4,
                  }}
                />
              )}
              {!workout && isFuture && projected && (
                <span
                  className="w-1 h-1 rounded-full mt-0.5"
                  style={{ backgroundColor: TYPE_COLOR[projected], opacity: 0.15 }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-5 px-5 mt-4 justify-center">
        {TABS.map(t => (
          <div key={t} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TYPE_COLOR[t] }} />
            <span className="font-mono text-iron-500 text-[9px] uppercase tracking-wider">{t}</span>
          </div>
        ))}
      </div>

      {selectedWorkout && (
        <WorkoutSummary
          workout={selectedWorkout}
          sets={selectedSets}
          weightUnit={weightUnit}
          onClose={() => setSelectedWorkout(null)}
          onEdit={() => {
            setSelectedWorkout(null)
            navigate(`/workout/${selectedWorkout.date}`)
          }}
        />
      )}

      {startModal && (
        <div className="fixed inset-0 bg-black/85 flex items-end z-50" onClick={() => setStartModal(null)}>
          <div
            className="bg-iron-900 w-full border-t-2"
            style={{ borderColor: TYPE_COLOR[startModal.type] }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 flex flex-col gap-4">
              <div>
                <p className="font-mono text-iron-500 text-[10px] uppercase tracking-widest">{startModal.date}</p>
                <h2 className="font-display text-3xl text-white mt-1">LOG WORKOUT</h2>
              </div>
              <div className="flex border border-iron-700">
                {TABS.map(tab => (
                  <button
                    key={tab}
                    onClick={() => setStartModal(m => m ? { ...m, type: tab } : m)}
                    className="flex-1 py-3 font-mono text-xs uppercase tracking-wider transition-colors"
                    style={{
                      backgroundColor: startModal.type === tab ? TYPE_COLOR[tab] + '20' : 'transparent',
                      color: startModal.type === tab ? TYPE_COLOR[tab] : '#555',
                      borderRight: tab !== 'legs' ? '1px solid #222' : 'none',
                    }}
                  >
                    {TYPE_LABELS[tab]}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStartModal(null)}
                  className="flex-1 py-4 border border-iron-600 font-mono text-xs uppercase tracking-wider text-iron-400"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartPastWorkout}
                  className="flex-1 py-4 font-sans font-bold uppercase text-sm text-black"
                  style={{ backgroundColor: TYPE_COLOR[startModal.type], letterSpacing: '0.12em' }}
                >
                  Start {TYPE_LABELS[startModal.type]}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
