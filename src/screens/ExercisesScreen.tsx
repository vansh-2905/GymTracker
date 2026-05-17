import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import type { Exercise, Template, WorkoutType } from '../types'
import { getExercises, addExercise, updateExercise, deleteExercise } from '../services/exerciseService'
import { getTemplate, saveTemplate } from '../services/templateService'
import ExerciseCard from '../components/ExerciseCard'

const TABS: WorkoutType[] = ['push', 'pull', 'legs']
const TAB_LABELS: Record<WorkoutType, string> = { push: 'Push', pull: 'Pull', legs: 'Legs' }

const EMPTY_FORM = { name: '', category: 'push' as WorkoutType, muscleGroup: '' }

export default function ExercisesScreen() {
  const { user } = useAuth()
  const uid = user!.uid

  const [activeTab, setActiveTab] = useState<WorkoutType>('push')
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [templates, setTemplates] = useState<Record<WorkoutType, Template>>({
    push: { type: 'push', exerciseIds: [] },
    pull: { type: 'pull', exerciseIds: [] },
    legs: { type: 'legs', exerciseIds: [] },
  })
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Exercise | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    getExercises(uid).then(setExercises)
    Promise.all(TABS.map(t => getTemplate(uid, t))).then(([push, pull, legs]) => {
      setTemplates({ push, pull, legs })
    })
  }, [uid])

  const tabExercises = exercises.filter(e => e.category === activeTab)
  const currentTemplate = templates[activeTab]

  const openAdd = () => {
    setEditTarget(null)
    setForm({ ...EMPTY_FORM, category: activeTab })
    setShowModal(true)
  }

  const openEdit = (exercise: Exercise) => {
    setEditTarget(exercise)
    setForm({ name: exercise.name, category: exercise.category, muscleGroup: exercise.muscleGroup })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.muscleGroup.trim()) return
    if (editTarget) {
      await updateExercise(uid, editTarget.id, form)
      setExercises(prev => prev.map(e => e.id === editTarget.id ? { ...e, ...form } : e))
    } else {
      const created = await addExercise(uid, form)
      setExercises(prev => [...prev, created])
    }
    setShowModal(false)
  }

  const handleDelete = async (id: string) => {
    await deleteExercise(uid, id)
    setExercises(prev => prev.filter(e => e.id !== id))
    for (const type of TABS) {
      const t = templates[type]
      if (t.exerciseIds.includes(id)) {
        const updated = { ...t, exerciseIds: t.exerciseIds.filter(eid => eid !== id) }
        await saveTemplate(uid, updated)
        setTemplates(prev => ({ ...prev, [type]: updated }))
      }
    }
  }

  const handleToggleTemplate = async (exerciseId: string) => {
    const t = currentTemplate
    const ids = t.exerciseIds.includes(exerciseId)
      ? t.exerciseIds.filter(id => id !== exerciseId)
      : [...t.exerciseIds, exerciseId]
    const updated = { ...t, exerciseIds: ids }
    await saveTemplate(uid, updated)
    setTemplates(prev => ({ ...prev, [activeTab]: updated }))
  }

  return (
    <div className="p-4 pt-12">
      <h1 className="text-2xl font-bold mb-4">Exercises & Templates</h1>

      <div className="flex rounded-xl bg-gray-800 p-1 mb-4">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === tab ? 'bg-indigo-600 text-white' : 'text-gray-400'
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 mb-4">
        {tabExercises.length === 0 && (
          <p className="text-gray-500 text-center py-8">No exercises yet. Add one below.</p>
        )}
        {tabExercises.map(ex => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            inTemplate={currentTemplate.exerciseIds.includes(ex.id)}
            onToggleTemplate={handleToggleTemplate}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        ))}
      </div>

      <button
        onClick={openAdd}
        className="w-full py-3 bg-indigo-600 rounded-xl font-semibold active:bg-indigo-700"
      >
        + Add Exercise
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-50" onClick={() => setShowModal(false)}>
          <div className="bg-gray-900 w-full rounded-t-2xl p-6 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">{editTarget ? 'Edit Exercise' : 'Add Exercise'}</h2>
            <input
              className="bg-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none"
              placeholder="Exercise name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
            <input
              className="bg-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none"
              placeholder="Muscle group (e.g. Chest)"
              value={form.muscleGroup}
              onChange={e => setForm(f => ({ ...f, muscleGroup: e.target.value }))}
            />
            <div className="flex rounded-xl bg-gray-800 p-1">
              {TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setForm(f => ({ ...f, category: tab }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    form.category === tab ? 'bg-indigo-600 text-white' : 'text-gray-400'
                  }`}
                >
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 bg-gray-700 rounded-xl">Cancel</button>
              <button onClick={handleSave} className="flex-1 py-3 bg-indigo-600 rounded-xl font-semibold">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
