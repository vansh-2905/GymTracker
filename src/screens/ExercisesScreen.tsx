import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import type { Exercise, Template, WorkoutType } from '../types'
import { getExercises, addExercise, updateExercise, deleteExercise } from '../services/exerciseService'
import { getTemplate, saveTemplate } from '../services/templateService'
import ExerciseCard from '../components/ExerciseCard'

const TABS: WorkoutType[] = ['push', 'pull', 'legs']
const TAB_LABELS: Record<WorkoutType, string> = { push: 'PUSH', pull: 'PULL', legs: 'LEGS' }
const TAB_COLOR: Record<WorkoutType, string> = { push: '#60A5FA', pull: '#4ADE80', legs: '#FB923C' }

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
  const accentColor = TAB_COLOR[activeTab]

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
    <div className="min-h-screen bg-iron-950 pb-24">
      <div className="h-0.5 w-full" style={{ backgroundColor: accentColor }} />

      <div className="px-5 pt-10 pb-4">
        <h1 className="font-display text-5xl text-white leading-none">LIFTS</h1>
        <p className="font-mono text-iron-500 text-[10px] uppercase tracking-widest mt-1">
          Exercises & Templates
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-iron-700 mx-5 mb-4">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-3 font-mono text-xs uppercase tracking-wider transition-colors relative"
            style={{ color: activeTab === tab ? TAB_COLOR[tab] : '#555' }}
          >
            {TAB_LABELS[tab]}
            {activeTab === tab && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: TAB_COLOR[tab] }}
              />
            )}
          </button>
        ))}
      </div>

      {/* In-template count */}
      <div className="px-5 mb-3">
        <p className="font-mono text-iron-500 text-[10px] uppercase tracking-widest">
          {currentTemplate.exerciseIds.length} in template · {tabExercises.length} total
        </p>
      </div>

      {/* Exercise list */}
      <div className="flex flex-col gap-px mx-5 mb-5">
        {tabExercises.length === 0 && (
          <div className="border border-iron-700 p-8 text-center">
            <p className="font-mono text-iron-500 text-xs uppercase tracking-wider">No exercises yet</p>
          </div>
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

      <div className="px-5">
        <button
          onClick={openAdd}
          className="w-full py-4 font-sans font-bold uppercase text-sm text-black transition-opacity active:opacity-80"
          style={{ backgroundColor: accentColor, letterSpacing: '0.12em' }}
        >
          + Add Exercise
        </button>
      </div>

      {/* Add/Edit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/85 flex items-end z-50" onClick={() => setShowModal(false)}>
          <div
            className="bg-iron-900 w-full border-t-2"
            style={{ borderColor: TAB_COLOR[form.category] }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 flex flex-col gap-4">
              <h2 className="font-display text-3xl text-white">
                {editTarget ? 'EDIT LIFT' : 'NEW LIFT'}
              </h2>

              <input
                className="w-full bg-iron-800 border border-iron-600 px-4 py-3 text-white font-sans outline-none focus:border-acid transition-colors placeholder-iron-500"
                placeholder="Exercise name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
              <input
                className="w-full bg-iron-800 border border-iron-600 px-4 py-3 text-white font-sans outline-none focus:border-acid transition-colors placeholder-iron-500"
                placeholder="Muscle group (e.g. Chest)"
                value={form.muscleGroup}
                onChange={e => setForm(f => ({ ...f, muscleGroup: e.target.value }))}
              />

              {/* Category selector */}
              <div className="flex border border-iron-700">
                {TABS.map(tab => (
                  <button
                    key={tab}
                    onClick={() => setForm(f => ({ ...f, category: tab }))}
                    className="flex-1 py-3 font-mono text-xs uppercase tracking-wider transition-colors"
                    style={{
                      backgroundColor: form.category === tab ? TAB_COLOR[tab] + '20' : 'transparent',
                      color: form.category === tab ? TAB_COLOR[tab] : '#555',
                      borderRight: tab !== 'legs' ? '1px solid #222' : 'none',
                    }}
                  >
                    {TAB_LABELS[tab]}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-4 border border-iron-600 font-mono text-xs uppercase tracking-wider text-iron-400"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 py-4 font-sans font-bold uppercase text-sm text-black"
                  style={{ backgroundColor: TAB_COLOR[form.category], letterSpacing: '0.12em' }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
