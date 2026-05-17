import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import type { Workout, WorkoutSet, WorkoutType } from '../types'
import { getWorkoutsInRange, getSets } from '../services/workoutService'
import { getProfile } from '../services/profileService'
import { getProjectedType } from '../utils/ppl'
import WorkoutSummary from '../components/WorkoutSummary'

const TYPE_DOT: Record<WorkoutType, string> = {
  push: 'bg-blue-500',
  pull: 'bg-green-500',
  legs: 'bg-orange-500',
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

export default function CalendarScreen() {
  const { user } = useAuth()
  const uid = user!.uid

  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [workouts, setWorkouts] = useState<Record<string, Workout>>({})
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null)
  const [selectedSets, setSelectedSets] = useState<WorkoutSet[]>([])
  const [weightUnit, setWeightUnit] = useState('kg')
  const [lastType, setLastType] = useState<WorkoutType | null>(null)
  const [lastDate, setLastDate] = useState<string | null>(null)

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
    const w = workouts[dateStr]
    if (!w) return
    const sets = await getSets(uid, dateStr)
    setSelectedSets(sets)
    setSelectedWorkout(w)
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
  const monthName = new Date(viewYear, viewMonth).toLocaleString('default', { month: 'long', year: 'numeric' })

  return (
    <div className="p-4 pt-12">
      <h1 className="text-2xl font-bold mb-4">Calendar</h1>

      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="text-gray-400 px-3 py-2">‹</button>
        <span className="font-semibold">{monthName}</span>
        <button onClick={nextMonth} className="text-gray-400 px-3 py-2">›</button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className="text-center text-xs text-gray-500 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
          const workout = workouts[dateStr]
          const isToday = dateStr === today
          const isFuture = dateStr > today

          let projected: WorkoutType | null = null
          if (isFuture && lastType && lastDate) {
            projected = getProjectedType(lastType, lastDate, dateStr)
          }

          return (
            <button
              key={dateStr}
              onClick={() => handleDayPress(dateStr)}
              className={`aspect-square rounded-xl flex flex-col items-center justify-center relative
                ${isToday ? 'ring-2 ring-indigo-400' : ''}
                ${workout ? 'bg-gray-800' : 'bg-gray-900'}
              `}
            >
              <span className={`text-sm font-medium ${isToday ? 'text-indigo-300' : 'text-white'}`}>{day}</span>
              {workout && (
                <span className={`w-2 h-2 rounded-full mt-0.5 ${TYPE_DOT[workout.type]} ${workout.completed ? 'opacity-100' : 'opacity-40'}`} />
              )}
              {!workout && isFuture && projected && (
                <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${TYPE_DOT[projected]} opacity-20`} />
              )}
            </button>
          )
        })}
      </div>

      <div className="flex gap-4 mt-4 justify-center">
        {(['push','pull','legs'] as WorkoutType[]).map(t => (
          <div key={t} className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className={`w-2 h-2 rounded-full ${TYPE_DOT[t]}`} />
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </div>
        ))}
      </div>

      {selectedWorkout && (
        <WorkoutSummary
          workout={selectedWorkout}
          sets={selectedSets}
          weightUnit={weightUnit}
          onClose={() => setSelectedWorkout(null)}
        />
      )}
    </div>
  )
}
