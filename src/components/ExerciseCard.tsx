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
    <div className="bg-gray-800 rounded-xl p-4 flex items-center gap-3">
      <button
        onClick={() => onToggleTemplate(exercise.id)}
        className={`w-6 h-6 rounded-full border-2 flex-shrink-0 transition-colors ${
          inTemplate ? 'bg-indigo-500 border-indigo-500' : 'border-gray-500'
        }`}
      />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white truncate">{exercise.name}</p>
        <p className="text-xs text-gray-400">{exercise.muscleGroup}</p>
      </div>
      <button onClick={() => onEdit(exercise)} className="text-gray-400 px-2 py-1 text-sm">Edit</button>
      <button onClick={() => onDelete(exercise.id)} className="text-red-400 px-2 py-1 text-sm">Del</button>
    </div>
  )
}
