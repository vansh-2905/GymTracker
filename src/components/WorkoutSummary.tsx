import type { Workout, WorkoutSet } from '../types'

interface Props {
  workout: Workout
  sets: WorkoutSet[]
  weightUnit: string
  onClose: () => void
}

function groupByExercise(sets: WorkoutSet[]): Record<string, WorkoutSet[]> {
  return sets.reduce((acc, s) => {
    if (!acc[s.exerciseName]) acc[s.exerciseName] = []
    acc[s.exerciseName].push(s)
    return acc
  }, {} as Record<string, WorkoutSet[]>)
}

export default function WorkoutSummary({ workout, sets, weightUnit, onClose }: Props) {
  const grouped = groupByExercise(sets)
  return (
    <div className="fixed inset-0 bg-black/70 flex items-end z-50" onClick={onClose}>
      <div className="bg-gray-900 w-full rounded-t-2xl p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold capitalize">{workout.type} — {workout.date}</h2>
          <button onClick={onClose} className="text-gray-400">✕</button>
        </div>
        {Object.entries(grouped).map(([name, exerciseSets]) => (
          <div key={name} className="mb-4">
            <p className="font-semibold text-indigo-300 mb-2">{name}</p>
            {exerciseSets.map(s => (
              <div key={s.id} className="flex justify-between text-sm py-1 text-gray-300">
                <span>Set {s.setNumber}</span>
                <span>{s.reps} reps</span>
                <span>{s.weight}{weightUnit}</span>
              </div>
            ))}
          </div>
        ))}
        {sets.length === 0 && <p className="text-gray-400">No sets recorded.</p>}
      </div>
    </div>
  )
}
