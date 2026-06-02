import { useState } from 'react'
import type { Workout, WorkoutSet } from '../types'

function fmtSecs(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

interface Props {
  workout: Workout
  sets: WorkoutSet[]
  weightUnit: string
  onClose: () => void
  onEdit?: () => void
  onDelete?: () => Promise<void>
}

const TYPE_COLOR: Record<string, string> = {
  push: '#60A5FA',
  pull: '#4ADE80',
  legs: '#FB923C',
}

function groupByExercise(sets: WorkoutSet[]): Record<string, WorkoutSet[]> {
  return sets.reduce((acc, s) => {
    if (!acc[s.exerciseName]) acc[s.exerciseName] = []
    acc[s.exerciseName].push(s)
    return acc
  }, {} as Record<string, WorkoutSet[]>)
}

export default function WorkoutSummary({ workout, sets, weightUnit, onClose, onEdit, onDelete }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const grouped = groupByExercise(sets)
  const color = TYPE_COLOR[workout.type] ?? '#E8FF3D'
  const totalKcal = sets.reduce((sum, s) => sum + (s.kcal ?? 0), 0)
  const hasKcal = sets.some(s => s.kcal !== undefined)

  const handleConfirmDelete = async () => {
    if (!onDelete) return
    setDeleting(true)
    await onDelete()
    setDeleting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end z-50" onClick={onClose}>
      <div
        className="bg-iron-900 w-full max-h-[80vh] overflow-y-auto scrollbar-none"
        onClick={e => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="sticky top-0 bg-iron-900 border-b border-iron-700 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="font-mono text-iron-400 text-[10px] tracking-widest uppercase">{workout.date}</p>
            <h2
              className="font-display text-3xl leading-none mt-0.5"
              style={{ color }}
            >
              {workout.type.toUpperCase()} DAY
            </h2>
            {hasKcal && (
              <p className="font-mono text-[10px] tracking-widest mt-1" style={{ color }}>
                {Math.round(totalKcal)} KCAL BURNED
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-iron-400 font-mono text-xs hover:text-white transition-colors p-2">
            ✕ CLOSE
          </button>
        </div>

        <div className="p-5">
          {sets.length === 0 ? (
            <p className="text-iron-400 font-mono text-sm text-center py-8">No sets recorded.</p>
          ) : (
            Object.entries(grouped).map(([name, exerciseSets]) => (
              <div key={name} className="mb-6">
                <p className="font-mono text-[10px] tracking-widest uppercase mb-2" style={{ color }}>{name}</p>
                <div className="border border-iron-700">
                  {exerciseSets.map(s => (
                    <div key={s.id} className="flex justify-between items-center px-4 py-2.5 border-b border-iron-700 last:border-0">
                      <span className="font-mono text-iron-400 text-xs">#{s.setNumber}</span>
                      {s.isTimed ? (
                        <span className="font-mono text-xs flex items-center gap-2">
                          <span className="font-bold text-acid">{fmtSecs(s.activeDuration)}<span className="text-iron-400 font-normal ml-1">hold</span></span>
                          <span className="font-bold text-white">{s.weight ?? 0}<span className="text-iron-400 font-normal text-[10px] ml-0.5">{weightUnit}</span></span>
                        </span>
                      ) : s.sides ? (
                        <span className="font-mono text-xs flex gap-2">
                          <span><span className="text-iron-400">L </span><span className="font-bold text-white">{s.sides.left.reps}</span><span className="text-iron-400">×</span><span className="font-bold text-acid">{s.sides.left.weight}</span><span className="text-iron-400 text-[10px] ml-0.5">{weightUnit}</span></span>
                          <span><span className="text-iron-400">R </span><span className="font-bold text-white">{s.sides.right.reps}</span><span className="text-iron-400">×</span><span className="font-bold text-acid">{s.sides.right.weight}</span><span className="text-iron-400 text-[10px] ml-0.5">{weightUnit}</span></span>
                        </span>
                      ) : (
                        <>
                          <span className="font-mono font-bold text-white">{s.reps} <span className="text-iron-400 font-normal text-xs">reps</span></span>
                          <span className="font-mono font-bold text-acid">{s.weight}<span className="text-iron-400 font-normal text-xs ml-0.5">{weightUnit}</span></span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}

          <div className="flex gap-3 mt-2">
            {onEdit && (
              <button
                onClick={onEdit}
                className="flex-1 py-4 bg-acid text-black font-sans font-bold uppercase text-sm"
                style={{ letterSpacing: '0.12em' }}
              >
                Edit Workout
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="py-4 border border-red-700 text-red-500 font-mono text-xs uppercase tracking-wider transition-colors hover:bg-red-700/10"
                style={{ minWidth: '4rem', paddingLeft: '1rem', paddingRight: '1rem' }}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-60 px-5">
          <div className="bg-iron-900 w-full border border-red-700">
            <div className="p-5">
              <h2 className="font-display text-3xl text-white mb-1">DELETE WORKOUT</h2>
              <p className="font-mono text-iron-400 text-xs mb-1">
                {workout.date} · {workout.type.toUpperCase()} DAY
              </p>
              <p className="font-mono text-iron-500 text-[10px] mb-5">
                {sets.length} {sets.length === 1 ? 'set' : 'sets'} will be permanently removed.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="flex-1 py-4 border border-iron-600 font-mono text-xs uppercase tracking-wider text-iron-400"
                >
                  Keep It
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="flex-1 py-4 bg-red-600 font-sans font-bold uppercase text-sm text-white disabled:opacity-60"
                  style={{ letterSpacing: '0.12em' }}
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
