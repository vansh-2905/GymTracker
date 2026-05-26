import type { Workout, WorkoutSet } from '../types'

interface Props {
  workout: Workout
  sets: WorkoutSet[]
  weightUnit: string
  onClose: () => void
  onEdit?: () => void
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

export default function WorkoutSummary({ workout, sets, weightUnit, onClose, onEdit }: Props) {
  const grouped = groupByExercise(sets)
  const color = TYPE_COLOR[workout.type] ?? '#E8FF3D'
  const totalKcal = sets.reduce((sum, s) => sum + (s.kcal ?? 0), 0)
  const hasKcal = sets.some(s => s.kcal !== undefined)

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
                      {s.sides ? (
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

          {onEdit && (
            <button
              onClick={onEdit}
              className="w-full py-4 bg-acid text-black font-sans font-bold uppercase tracking-widest text-sm mt-2"
              style={{ letterSpacing: '0.12em' }}
            >
              Edit Workout
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
