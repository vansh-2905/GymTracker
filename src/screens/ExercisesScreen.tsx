import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import type { Exercise, Template, WorkoutType, WorkoutProgram } from '../types'
import { getExercises, addExercise, updateExercise, deleteExercise } from '../services/exerciseService'
import { getTemplate, saveTemplate } from '../services/templateService'
import { getProfile } from '../services/profileService'
import { getProgramById, PRESET_PROGRAMS } from '../data/programs'
import ExerciseCard from '../components/ExerciseCard'

const EMPTY_FORM = { name: '', categories: ['push'] as WorkoutType[], muscleGroup: '', bilateral: false, timed: false }

type ExercisesCache = {
  uid: string
  activeProgram: WorkoutProgram
  exercises: Exercise[]
  templates: Record<string, Template>
}
let _exercisesCache: ExercisesCache | null = null

export default function ExercisesScreen() {
  const { user } = useAuth()
  const uid = user!.uid

  const cached = _exercisesCache?.uid === uid ? _exercisesCache : null

  const [activeProgram, setActiveProgram] = useState<WorkoutProgram>(cached?.activeProgram ?? PRESET_PROGRAMS[0])
  const [activeDayKey, setActiveDayKey] = useState(cached?.activeProgram.days[0].key ?? PRESET_PROGRAMS[0].days[0].key)
  const [exercises, setExercises] = useState<Exercise[]>(cached?.exercises ?? [])
  const [templates, setTemplates] = useState<Record<string, Template>>(cached?.templates ?? {})
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Exercise | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    async function load() {
      const [exs, profile] = await Promise.all([getExercises(uid), getProfile(uid)])
      const prog = getProgramById(profile?.activeProgramId, profile?.customPrograms)
      const loaded = await Promise.all(prog.days.map(d => getTemplate(uid, d.key)))
      const map: Record<string, Template> = {}
      prog.days.forEach((d, i) => { map[d.key] = loaded[i] })
      _exercisesCache = { uid, activeProgram: prog, exercises: exs, templates: map }
      setExercises(exs)
      setActiveProgram(prog)
      if (!cached) setActiveDayKey(prog.days[0].key)
      setTemplates(map)
    }
    load()
  }, [uid])

  const currentTemplate = templates[activeDayKey] ?? { type: activeDayKey, exerciseIds: [] }
  const activeDayObj = activeProgram.days.find(d => d.key === activeDayKey) ?? activeProgram.days[0]
  const activeDayColor = activeDayObj.color
  // Show exercises for this day: those categorized by the day key + any already in the template
  const displayExercises = exercises.filter(
    e => e.categories.includes(activeDayKey) || currentTemplate.exerciseIds.includes(e.id)
  )
  const formDayColor = activeProgram.days.find(d => form.categories.includes(d.key))?.color ?? activeDayColor

  const openAdd = () => {
    setEditTarget(null)
    setForm({ ...EMPTY_FORM, categories: [activeDayKey] })
    setShowModal(true)
  }

  const openEdit = (exercise: Exercise) => {
    setEditTarget(exercise)
    setForm({
      name: exercise.name,
      categories: [...exercise.categories],
      muscleGroup: exercise.muscleGroup,
      bilateral: exercise.bilateral ?? false,
      timed: exercise.timed ?? false,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.muscleGroup.trim() || form.categories.length === 0) return
    const exerciseData = {
      ...form,
      bilateral: form.bilateral && !form.timed,
      timed: form.timed && !form.bilateral,
    }
    if (editTarget) {
      await updateExercise(uid, editTarget.id, exerciseData)
      setExercises(prev => prev.map(e => e.id === editTarget.id ? { ...e, ...exerciseData } : e))
    } else {
      const created = await addExercise(uid, exerciseData)
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
      <div className="h-0.5 w-full" style={{ backgroundColor: activeDayColor }} />

      <div className="px-5 pt-10 pb-4">
        <h1 className="font-display text-5xl text-white leading-none">LIFTS</h1>
        <p className="font-mono text-iron-500 text-[10px] uppercase tracking-widest mt-1">
          Exercises & Templates
        </p>
      </div>

      {/* Program day tab bar */}
      <div className="flex border-b border-iron-700 mx-5 mb-4">
        {activeProgram.days.map(d => (
          <button
            key={d.key}
            onClick={() => setActiveDayKey(d.key)}
            className="flex-1 py-3 font-mono text-xs uppercase tracking-wider transition-colors relative"
            style={{ color: activeDayKey === d.key ? d.color : '#555' }}
          >
            {d.label}
            {activeDayKey === d.key && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: d.color }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Template count */}
      <div className="px-5 mb-3">
        <p className="font-mono text-iron-500 text-[10px] uppercase tracking-widest">
          {currentTemplate.exerciseIds.length} in {activeDayObj.label} template · {displayExercises.length} exercises
        </p>
      </div>

      {/* Exercise list — filtered to this day's exercises */}
      <div className="flex flex-col gap-px mx-5 mb-5">
        {displayExercises.length === 0 && (
          <div className="border border-iron-700 p-8 text-center">
            <p className="font-mono text-iron-500 text-xs uppercase tracking-wider">No exercises yet</p>
          </div>
        )}
        {displayExercises.map(ex => (
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
          style={{ backgroundColor: activeDayColor, letterSpacing: '0.12em' }}
        >
          + Add Exercise
        </button>
      </div>

      {/* Add/Edit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/85 flex items-end z-50" onClick={() => setShowModal(false)}>
          <div
            className="bg-iron-900 w-full border-t-2"
            style={{ borderColor: formDayColor }}
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
                {(['standard', 'bilateral', 'timed'] as const).map((mode, i) => {
                  const active = mode === 'bilateral' ? form.bilateral : mode === 'timed' ? form.timed : (!form.bilateral && !form.timed)
                  return (
                    <button
                      key={mode}
                      onClick={() => setForm(f => ({
                        ...f,
                        bilateral: mode === 'bilateral',
                        timed: mode === 'timed',
                      }))}
                      className="flex-1 py-3 font-mono text-xs uppercase tracking-wider transition-colors"
                      style={{
                        backgroundColor: active ? formDayColor + '20' : 'transparent',
                        color: active ? formDayColor : '#555',
                        borderRight: i < 2 ? '1px solid #222' : 'none',
                      }}
                    >
                      {mode}
                    </button>
                  )
                })}
              </div>

              <div>
                <p className="font-mono text-iron-500 text-[10px] uppercase tracking-widest mb-2">
                  Workout days — select one or more
                </p>
                <div className="flex border border-iron-700">
                  {activeProgram.days.map((d, i) => {
                    const selected = form.categories.includes(d.key)
                    return (
                      <button
                        key={d.key}
                        onClick={() => setForm(f => ({
                          ...f,
                          categories: selected
                            ? f.categories.filter(k => k !== d.key)
                            : [...f.categories, d.key],
                        }))}
                        className="flex-1 py-3 font-mono text-xs uppercase tracking-wider transition-colors"
                        style={{
                          backgroundColor: selected ? d.color + '20' : 'transparent',
                          color: selected ? d.color : '#555',
                          borderRight: i < activeProgram.days.length - 1 ? '1px solid #222' : 'none',
                        }}
                      >
                        {d.label}
                      </button>
                    )
                  })}
                </div>
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
                  style={{ backgroundColor: formDayColor, letterSpacing: '0.12em' }}
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
