import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import type { Exercise, Template, WorkoutType, WorkoutProgram } from '../types'
import { getExercises, addExercise, updateExercise, deleteExercise } from '../services/exerciseService'
import { getTemplate, saveTemplate } from '../services/templateService'
import { getProfile } from '../services/profileService'
import { getProgramById, PRESET_PROGRAMS } from '../data/programs'
import ExerciseCard from '../components/ExerciseCard'

const CATEGORY_TABS: WorkoutType[] = ['push', 'pull', 'legs']
const CATEGORY_LABELS: Record<string, string> = { push: 'PUSH', pull: 'PULL', legs: 'LEGS' }
const CATEGORY_COLORS: Record<string, string> = { push: '#60A5FA', pull: '#4ADE80', legs: '#FB923C' }

const EMPTY_FORM = { name: '', category: 'push' as WorkoutType, muscleGroup: '' }

export default function ExercisesScreen() {
  const { user } = useAuth()
  const uid = user!.uid

  const [activeCategory, setActiveCategory] = useState<WorkoutType>('push')
  const [activeProgram, setActiveProgram] = useState<WorkoutProgram>(PRESET_PROGRAMS[0])
  const [activeDayKey, setActiveDayKey] = useState(PRESET_PROGRAMS[0].days[0].key)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [templates, setTemplates] = useState<Record<string, Template>>({})
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Exercise | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    async function load() {
      const [exs, profile] = await Promise.all([getExercises(uid), getProfile(uid)])
      setExercises(exs)
      const prog = getProgramById(profile?.activeProgramId, profile?.customPrograms)
      setActiveProgram(prog)
      setActiveDayKey(prog.days[0].key)
      const loaded = await Promise.all(prog.days.map(d => getTemplate(uid, d.key)))
      const map: Record<string, Template> = {}
      prog.days.forEach((d, i) => { map[d.key] = loaded[i] })
      setTemplates(map)
    }
    load()
  }, [uid])

  const categoryExercises = exercises.filter(e => e.category === activeCategory)
  const currentTemplate = templates[activeDayKey] ?? { type: activeDayKey, exerciseIds: [] }
  const activeCategoryColor = CATEGORY_COLORS[activeCategory] ?? '#E8FF3D'
  const activeDayObj = activeProgram.days.find(d => d.key === activeDayKey) ?? activeProgram.days[0]

  const openAdd = () => {
    setEditTarget(null)
    setForm({ ...EMPTY_FORM, category: activeCategory })
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
    for (const day of activeProgram.days) {
      const t = templates[day.key]
      if (t?.exerciseIds.includes(id)) {
        const updated = { ...t, exerciseIds: t.exerciseIds.filter(eid => eid !== id) }
        await saveTemplate(uid, updated)
        setTemplates(prev => ({ ...prev, [day.key]: updated }))
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
    setTemplates(prev => ({ ...prev, [activeDayKey]: updated }))
  }

  return (
    <div className="min-h-screen bg-iron-950 pb-24">
      <div className="h-0.5 w-full" style={{ backgroundColor: activeCategoryColor }} />

      <div className="px-5 pt-10 pb-4">
        <h1 className="font-display text-5xl text-white leading-none">LIFTS</h1>
        <p className="font-mono text-iron-500 text-[10px] uppercase tracking-widest mt-1">
          Exercises & Templates
        </p>
      </div>

      {/* Category tab bar — always push/pull/legs */}
      <div className="flex border-b border-iron-700 mx-5 mb-0">
        {CATEGORY_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveCategory(tab)}
            className="flex-1 py-3 font-mono text-xs uppercase tracking-wider transition-colors relative"
            style={{ color: activeCategory === tab ? CATEGORY_COLORS[tab] : '#555' }}
          >
            {CATEGORY_LABELS[tab]}
            {activeCategory === tab && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: CATEGORY_COLORS[tab] }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Template day selector */}
      <div className="px-5 pt-3 pb-2 flex items-center gap-2 flex-wrap">
        <span className="font-mono text-iron-500 text-[9px] uppercase tracking-widest shrink-0">Template for:</span>
        {activeProgram.days.map(d => (
          <button
            key={d.key}
            onClick={() => setActiveDayKey(d.key)}
            className="px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest border transition-colors"
            style={{
              borderColor: activeDayKey === d.key ? d.color : '#333',
              backgroundColor: activeDayKey === d.key ? d.color + '20' : 'transparent',
              color: activeDayKey === d.key ? d.color : '#555',
            }}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Template count */}
      <div className="px-5 mb-3">
        <p className="font-mono text-iron-500 text-[10px] uppercase tracking-widest">
          {currentTemplate.exerciseIds.length} in {activeDayObj.label} template · {categoryExercises.length} {CATEGORY_LABELS[activeCategory]} exercises
        </p>
      </div>

      {/* Exercise list */}
      <div className="flex flex-col gap-px mx-5 mb-5">
        {categoryExercises.length === 0 && (
          <div className="border border-iron-700 p-8 text-center">
            <p className="font-mono text-iron-500 text-xs uppercase tracking-wider">No exercises yet</p>
          </div>
        )}
        {categoryExercises.map(ex => (
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
          style={{ backgroundColor: activeCategoryColor, letterSpacing: '0.12em' }}
        >
          + Add Exercise
        </button>
      </div>

      {/* Add/Edit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/85 flex items-end z-50" onClick={() => setShowModal(false)}>
          <div
            className="bg-iron-900 w-full border-t-2"
            style={{ borderColor: CATEGORY_COLORS[form.category] ?? '#E8FF3D' }}
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

              <div className="flex border border-iron-700">
                {CATEGORY_TABS.map((tab, i) => (
                  <button
                    key={tab}
                    onClick={() => setForm(f => ({ ...f, category: tab }))}
                    className="flex-1 py-3 font-mono text-xs uppercase tracking-wider transition-colors"
                    style={{
                      backgroundColor: form.category === tab ? CATEGORY_COLORS[tab] + '20' : 'transparent',
                      color: form.category === tab ? CATEGORY_COLORS[tab] : '#555',
                      borderRight: i < CATEGORY_TABS.length - 1 ? '1px solid #222' : 'none',
                    }}
                  >
                    {CATEGORY_LABELS[tab]}
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
                  style={{ backgroundColor: CATEGORY_COLORS[form.category] ?? '#E8FF3D', letterSpacing: '0.12em' }}
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
