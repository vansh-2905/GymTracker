import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { Workout, WorkoutSet, WorkoutProgram } from '../types'
import { getWorkoutsInRange, getSets, startWorkout } from '../services/workoutService'
import { getProfile, updateLastWorkout } from '../services/profileService'
import { getProgramById, PRESET_PROGRAMS } from '../data/programs'
import { getProjectedDay } from '../utils/rotation'
import WorkoutSummary from '../components/WorkoutSummary'

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
  const [lastType, setLastType] = useState<string | null>(null)
  const [lastDate, setLastDate] = useState<string | null>(null)
  const [activeProgram, setActiveProgram] = useState<WorkoutProgram>(PRESET_PROGRAMS[0])
  const [startModal, setStartModal] = useState<{ date: string; dayKey: string } | null>(null)

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
        setActiveProgram(getProgramById(p.activeProgramId, p.customPrograms))
      }
    })
  }, [uid, viewYear, viewMonth])

  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

  function dayColor(dayKey: string): string {
    return activeProgram.days.find(d => d.key === dayKey)?.color ?? '#E8FF3D'
  }

  const handleDayPress = async (dateStr: string) => {
    if (dateStr > today) return
    const w = workouts[dateStr]
    if (w) {
      const sets = await getSets(uid, dateStr)
      setSelectedSets(sets)
      setSelectedWorkout(w)
    } else {
      const projectedKey = lastType && lastDate
        ? getProjectedDay(lastType, lastDate, dateStr, activeProgram).key
        : activeProgram.days[0].key
      setStartModal({ date: dateStr, dayKey: projectedKey })
    }
  }

  const handleStartPastWorkout = async () => {
    if (!startModal) return
    await startWorkout(uid, startModal.date, startModal.dayKey)
    await updateLastWorkout(uid, startModal.dayKey, startModal.date)
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

      <div className="flex items-center justify-between px-5 mb-4">
        <button onClick={prevMonth} className="font-mono text-iron-400 text-sm hover:text-white transition-colors px-2 py-1">‹ PREV</button>
        <div className="text-center">
          <p className="font-display text-2xl text-white tracking-wide">{monthName.toUpperCase()}</p>
          <p className="font-mono text-iron-500 text-[10px]">{viewYear}</p>
        </div>
        <button onClick={nextMonth} className="font-mono text-iron-400 text-sm hover:text-white transition-colors px-2 py-1">NEXT ›</button>
      </div>

      <div className="grid grid-cols-7 px-5 mb-1">
        {['SU','MO','TU','WE','TH','FR','SA'].map(d => (
          <div key={d} className="text-center font-mono text-iron-600 text-[9px] py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px px-5">
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
          const workout = workouts[dateStr]
          const isToday = dateStr === today
          const isFuture = dateStr > today
          const wColor = workout ? dayColor(workout.type) : null

          let projectedColor: string | null = null
          if (isFuture && lastType && lastDate) {
            projectedColor = getProjectedDay(lastType, lastDate, dateStr, activeProgram).color
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
                  style={{ backgroundColor: wColor ?? '#fff', opacity: workout.completed ? 1 : 0.4 }}
                />
              )}
              {!workout && isFuture && projectedColor && (
                <span
                  className="w-1 h-1 rounded-full mt-0.5"
                  style={{ backgroundColor: projectedColor, opacity: 0.15 }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Legend — driven by active program */}
      <div className="flex gap-4 px-5 mt-4 justify-center flex-wrap">
        {activeProgram.days.map(d => (
          <div key={d.key} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="font-mono text-iron-500 text-[9px] uppercase tracking-wider">{d.label}</span>
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
            style={{ borderColor: dayColor(startModal.dayKey) }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 flex flex-col gap-4">
              <div>
                <p className="font-mono text-iron-500 text-[10px] uppercase tracking-widest">{startModal.date}</p>
                <h2 className="font-display text-3xl text-white mt-1">LOG WORKOUT</h2>
              </div>
              <div className="flex border border-iron-700">
                {activeProgram.days.map((day, i) => (
                  <button
                    key={day.key}
                    onClick={() => setStartModal(m => m ? { ...m, dayKey: day.key } : m)}
                    className="flex-1 py-3 font-mono text-xs uppercase tracking-wider transition-colors"
                    style={{
                      backgroundColor: startModal.dayKey === day.key ? day.color + '20' : 'transparent',
                      color: startModal.dayKey === day.key ? day.color : '#555',
                      borderRight: i < activeProgram.days.length - 1 ? '1px solid #222' : 'none',
                    }}
                  >
                    {day.label}
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
                  style={{ backgroundColor: dayColor(startModal.dayKey), letterSpacing: '0.12em' }}
                >
                  Start {activeProgram.days.find(d => d.key === startModal.dayKey)?.label ?? startModal.dayKey}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
