import type { Exercise } from '../types'

interface Props {
  exercise: Exercise
  inTemplate: boolean
  onToggleTemplate: (id: string) => void
  onEdit: (exercise: Exercise) => void
  onDelete: (id: string) => void
}

export default function ExerciseCard({ exercise, inTemplate, onToggleTemplate, onEdit, onDelete }: Props) {
  return (
    <div className={`flex items-center gap-3 p-4 border transition-colors ${
      inTemplate ? 'border-acid/30 bg-acid/5' : 'border-iron-700 bg-iron-800'
    }`}>
      <button
        onClick={() => onToggleTemplate(exercise.id)}
        className={`w-5 h-5 flex-shrink-0 border transition-colors flex items-center justify-center ${
          inTemplate ? 'bg-acid border-acid' : 'border-iron-500 bg-transparent'
        }`}
      >
        {inTemplate && (
          <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none">
            <path d="M2 6l3 3 5-5" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className="font-sans font-semibold text-white text-sm truncate">{exercise.name}</p>
        <p className="font-mono text-iron-400 text-xs uppercase tracking-wider mt-0.5">{exercise.muscleGroup}</p>
      </div>
      <button onClick={() => onEdit(exercise)} className="text-iron-400 px-2 py-1 font-mono text-xs hover:text-white transition-colors">EDIT</button>
      <button onClick={() => onDelete(exercise.id)} className="text-iron-400 px-2 py-1 font-mono text-xs hover:text-red-400 transition-colors">DEL</button>
    </div>
  )
}
