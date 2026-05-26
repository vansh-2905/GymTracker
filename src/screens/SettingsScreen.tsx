import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import {
  getProfile,
  updateWeightUnit,
  updateRestDefault,
  setActiveProgramId,
  saveCustomPrograms,
} from '../services/profileService'
import { getFitnessProfile, saveFitnessProfile } from '../services/fitnessProfileService'
import { computeUserMetFactor } from '../utils/calorieCalc'
import { getProgramById, PRESET_PROGRAMS, CUSTOM_PALETTE, makeDayKey } from '../data/programs'
import { seedProgramExercises } from '../utils/programExercises'
import type {
  UserProfile, FitnessProfile, BiologicalSex, FitnessLevel,
  PrimaryGoal, WeightUnit, WorkoutProgram, ProgramDay,
} from '../types'

type EditingField =
  | 'biologicalSex' | 'age' | 'heightCm' | 'bodyWeightKg'
  | 'fitnessLevel' | 'primaryGoal' | 'bodyFatPct' | null

const FITNESS_LEVEL_LABELS: Record<FitnessLevel, string> = {
  beginner: 'Beginner', intermediate: 'Intermediate', active: 'Active',
  advanced: 'Advanced', athlete: 'Athlete',
}

const GOAL_LABELS: Record<PrimaryGoal, string> = {
  weight_loss: 'Weight Loss', muscle_gain: 'Muscle Gain', maintenance: 'Maintenance',
  endurance: 'Endurance', general_health: 'General Health',
}

export default function SettingsScreen() {
  const { user, signOut } = useAuth()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [fp, setFp] = useState<FitnessProfile | null>(null)
  const [activeProgram, setActiveProgram] = useState<WorkoutProgram>(PRESET_PROGRAMS[0])
  const [customPrograms, setCustomPrograms] = useState<WorkoutProgram[]>([])
  const [editingField, setEditingField] = useState<EditingField>(null)
  const [tempValue, setTempValue] = useState<string>('')
  const [restInput, setRestInput] = useState('')
  const [savedField, setSavedField] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Program picker state
  const [showProgramPicker, setShowProgramPicker] = useState(false)
  const [showCustomBuilder, setShowCustomBuilder] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customDays, setCustomDays] = useState<{ label: string }[]>([{ label: '' }])

  useEffect(() => {
    if (!user) return
    Promise.all([getProfile(user.uid), getFitnessProfile(user.uid)]).then(
      ([profile, fitnessProfile]) => {
        setUserProfile(profile)
        setFp(fitnessProfile)
        setRestInput(String(profile?.restDefaultSeconds ?? 90))
        const customs = profile?.customPrograms ?? []
        setCustomPrograms(customs)
        setActiveProgram(getProgramById(profile?.activeProgramId, customs))
      },
    )
  }, [user])

  const flashSaved = (field: string) => {
    setSavedField(field)
    setTimeout(() => setSavedField(null), 1500)
  }

  const flashError = (msg: string) => {
    setErrorMsg(msg)
    setTimeout(() => setErrorMsg(null), 3000)
  }

  const handleWeightUnit = async (unit: WeightUnit) => {
    if (!user || !userProfile) return
    try {
      await updateWeightUnit(user.uid, unit)
      setUserProfile({ ...userProfile, weightUnit: unit })
      flashSaved('weightUnit')
    } catch {
      flashError('Failed to save weight unit')
    }
  }

  const handleRestBlur = async () => {
    if (!user) return
    const parsed = parseInt(restInput, 10)
    if (isNaN(parsed) || parsed < 10) {
      setRestInput(String(userProfile?.restDefaultSeconds ?? 90))
      return
    }
    const clamped = Math.min(parsed, 600)
    try {
      await updateRestDefault(user.uid, clamped)
      setRestInput(String(clamped))
      if (userProfile) setUserProfile({ ...userProfile, restDefaultSeconds: clamped })
      flashSaved('rest')
    } catch {
      setRestInput(String(userProfile?.restDefaultSeconds ?? 90))
      flashError('Failed to save rest timer')
    }
  }

  const handleSelectProgram = async (programId: string) => {
    if (!user) return
    try {
      await setActiveProgramId(user.uid, programId)
      const prog = getProgramById(programId, customPrograms)
      setActiveProgram(prog)
      if (userProfile) setUserProfile({ ...userProfile, activeProgramId: programId, lastWorkoutType: null })
      setShowProgramPicker(false)
      flashSaved('program')
      seedProgramExercises(user.uid, prog) // fire-and-forget; seeds if templates empty
    } catch {
      flashError('Failed to save program')
    }
  }

  const handleDeleteCustom = async (programId: string) => {
    if (!user) return
    const updated = customPrograms.filter(p => p.id !== programId)
    try {
      await saveCustomPrograms(user.uid, updated)
      setCustomPrograms(updated)
      if (activeProgram.id === programId) {
        await setActiveProgramId(user.uid, 'ppl')
        setActiveProgram(PRESET_PROGRAMS[0])
      }
    } catch {
      flashError('Failed to delete program')
    }
  }

  const handleSaveCustom = async () => {
    if (!user || !customName.trim()) return
    const validDays = customDays.filter(d => d.label.trim())
    if (validDays.length === 0) return
    const keys: string[] = []
    const days: ProgramDay[] = validDays.map((d, i) => {
      const key = makeDayKey(d.label, keys)
      keys.push(key)
      return { key, label: d.label.trim(), color: CUSTOM_PALETTE[i % CUSTOM_PALETTE.length] }
    })
    const newProgram: WorkoutProgram = {
      id: crypto.randomUUID(),
      name: customName.trim(),
      days,
      isPreset: false,
    }
    const updated = [...customPrograms, newProgram]
    try {
      await saveCustomPrograms(user.uid, updated)
      setCustomPrograms(updated)
      setShowCustomBuilder(false)
      setShowProgramPicker(false)
      setCustomName('')
      setCustomDays([{ label: '' }])
      await handleSelectProgram(newProgram.id)
    } catch {
      flashError('Failed to save custom program')
    }
  }

  const openEditField = (field: EditingField) => {
    if (!fp || field === null) return
    const current: Record<string, string> = {
      biologicalSex: fp.biologicalSex,
      age: String(fp.age),
      heightCm: String(fp.heightCm),
      bodyWeightKg: String(fp.bodyWeightKg),
      fitnessLevel: fp.fitnessLevel,
      primaryGoal: fp.primaryGoal,
      bodyFatPct: fp.bodyFatPct ?? '',
    }
    setTempValue(current[field] ?? '')
    setEditingField(field)
  }

  const saveField = async (field: EditingField, value: string) => {
    if (!user || !fp || field === null) return
    const updated: FitnessProfile = { ...fp }
    if (field === 'biologicalSex') {
      updated.biologicalSex = value as BiologicalSex
    } else if (field === 'age') {
      const v = parseInt(value, 10)
      if (isNaN(v) || v <= 0) return
      updated.age = v
    } else if (field === 'heightCm') {
      const v = parseFloat(value)
      if (isNaN(v) || v <= 0) return
      updated.heightCm = v
    } else if (field === 'bodyWeightKg') {
      const v = parseFloat(value)
      if (isNaN(v) || v <= 0) return
      updated.bodyWeightKg = v
    } else if (field === 'fitnessLevel') {
      updated.fitnessLevel = value as FitnessLevel
    } else if (field === 'primaryGoal') {
      updated.primaryGoal = value as PrimaryGoal
    } else if (field === 'bodyFatPct') {
      updated.bodyFatPct = value === '' ? null : value
    }
    updated.userMetFactor = computeUserMetFactor(updated.biologicalSex, updated.age, updated.fitnessLevel)
    try {
      await saveFitnessProfile(user.uid, updated)
      setFp(updated)
      setEditingField(null)
      flashSaved(field)
    } catch {
      flashError('Failed to save profile')
    }
  }

  const showCalorieProfile = fp !== null && !fp.skipped

  return (
    <div className="min-h-screen bg-iron-950 text-white pb-24">
      <div className="h-0.5 bg-acid" />
      {errorMsg && (
        <div className="mx-5 mt-3 px-4 py-2 bg-red-900/40 border border-red-700">
          <span className="font-mono text-[10px] uppercase tracking-widest text-red-400">{errorMsg}</span>
        </div>
      )}
      <div className="px-5 pt-6 pb-4">
        <h1 className="font-display text-3xl tracking-wide text-white">SETTINGS</h1>
      </div>

      {/* Preferences */}
      <div className="mx-5 mb-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-iron-400 mb-2">Preferences</p>
        <div className="bg-iron-900 border border-iron-700">
          <div className="px-4 py-3 flex items-center justify-between border-b border-iron-700">
            <span className="font-mono text-[11px] uppercase tracking-widest text-iron-300">Weight Unit</span>
            <div className="flex gap-1">
              {(['kg', 'lbs'] as WeightUnit[]).map(u => (
                <button
                  key={u}
                  onClick={() => handleWeightUnit(u)}
                  disabled={!userProfile}
                  className={`px-3 py-1 font-mono text-[11px] uppercase tracking-widest border transition-colors disabled:opacity-40 ${
                    userProfile?.weightUnit === u
                      ? 'bg-acid text-black border-acid'
                      : 'bg-transparent text-iron-400 border-iron-600'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          {savedField === 'weightUnit' && (
            <div className="px-4 py-1 bg-iron-800">
              <span className="font-mono text-[10px] text-acid uppercase tracking-widest">Saved</span>
            </div>
          )}
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-widest text-iron-300">Rest Timer (sec)</span>
            <input
              type="number"
              value={restInput}
              onChange={e => setRestInput(e.target.value)}
              onBlur={handleRestBlur}
              className="w-20 bg-iron-800 border border-iron-600 text-white font-mono text-sm text-right px-2 py-1 focus:outline-none focus:border-acid"
              min={10}
              max={600}
            />
          </div>
          {savedField === 'rest' && (
            <div className="px-4 py-1 bg-iron-800">
              <span className="font-mono text-[10px] text-acid uppercase tracking-widest">Saved</span>
            </div>
          )}
        </div>
      </div>

      {/* Workout Program */}
      <div className="mx-5 mb-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-iron-400 mb-2">Workout Program</p>
        <div className="bg-iron-900 border border-iron-700">
          <div className="px-4 py-3 flex items-center justify-between">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-widest text-iron-300 block mb-1">
                {activeProgram.name}
              </span>
              <div className="flex gap-1.5 flex-wrap">
                {activeProgram.days.map(d => (
                  <span
                    key={d.key}
                    className="px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest"
                    style={{ backgroundColor: d.color + '25', color: d.color, border: `1px solid ${d.color}40` }}
                  >
                    {d.label}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={() => setShowProgramPicker(true)}
              className="font-mono text-[10px] uppercase tracking-widest text-acid border border-acid px-3 py-1.5 active:opacity-70 ml-3 shrink-0"
            >
              Change
            </button>
          </div>
          {savedField === 'program' && (
            <div className="px-4 py-1 bg-iron-800">
              <span className="font-mono text-[10px] text-acid uppercase tracking-widest">Saved</span>
            </div>
          )}
        </div>
      </div>

      {/* Calorie Profile */}
      {showCalorieProfile && fp && (
        <div className="mx-5 mb-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-iron-400 mb-2">Calorie Profile</p>
          <div className="bg-iron-900 border border-iron-700">
            {(
              [
                { field: 'biologicalSex', label: 'Biological Sex', value: fp.biologicalSex === 'male' ? 'Male' : 'Female' },
                { field: 'age', label: 'Age', value: `${fp.age} yrs` },
                { field: 'heightCm', label: 'Height', value: `${fp.heightCm} cm` },
                { field: 'bodyWeightKg', label: 'Body Weight', value: `${fp.bodyWeightKg} kg` },
                { field: 'fitnessLevel', label: 'Fitness Level', value: FITNESS_LEVEL_LABELS[fp.fitnessLevel] },
                { field: 'primaryGoal', label: 'Primary Goal', value: GOAL_LABELS[fp.primaryGoal] },
                { field: 'bodyFatPct', label: 'Body Fat %', value: fp.bodyFatPct ? `${fp.bodyFatPct}%` : '—' },
              ] as { field: EditingField; label: string; value: string }[]
            ).map(({ field, label, value }, i, arr) => (
              <div key={field as string}>
                <button
                  onClick={() => openEditField(field)}
                  className={`w-full px-4 py-3 flex items-center justify-between active:bg-iron-800 ${
                    i < arr.length - 1 ? 'border-b border-iron-700' : ''
                  }`}
                >
                  <span className="font-mono text-[11px] uppercase tracking-widest text-iron-300">{label}</span>
                  <div className="flex items-center gap-2">
                    {savedField === field && (
                      <span className="font-mono text-[10px] text-acid uppercase tracking-widest">Saved</span>
                    )}
                    <span className="font-mono text-sm text-white">{value}</span>
                    <span className="text-iron-500 text-xs">›</span>
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Account */}
      <div className="mx-5 mb-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-iron-400 mb-2">Account</p>
        <div className="bg-iron-900 border border-iron-700">
          <div className="px-4 py-3 flex items-center gap-3 border-b border-iron-700">
            {user?.photoURL && (
              <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full" />
            )}
            <div>
              <p className="font-sans text-sm text-white">{user?.displayName}</p>
              <p className="font-mono text-[10px] text-iron-400">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="w-full px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-red-400 text-left active:bg-iron-800"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Calorie profile bottom-sheet modal */}
      {editingField !== null && fp && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setEditingField(null)} />
          <div className="relative bg-iron-900 border-t-2 border-acid px-5 pt-5 pb-10">
            <p className="font-mono text-[10px] uppercase tracking-widest text-iron-400 mb-4">
              {editingField === 'biologicalSex' && 'Biological Sex'}
              {editingField === 'age' && 'Age (years)'}
              {editingField === 'heightCm' && 'Height (cm)'}
              {editingField === 'bodyWeightKg' && 'Body Weight (kg)'}
              {editingField === 'fitnessLevel' && 'Fitness Level'}
              {editingField === 'primaryGoal' && 'Primary Goal'}
              {editingField === 'bodyFatPct' && 'Body Fat % (optional)'}
            </p>
            {editingField === 'biologicalSex' && (
              <div className="flex gap-3">
                {(['male', 'female'] as BiologicalSex[]).map(s => (
                  <button key={s} onClick={() => saveField('biologicalSex', s)}
                    className={`flex-1 py-3 font-mono text-[11px] uppercase tracking-widest border ${fp.biologicalSex === s ? 'bg-acid text-black border-acid' : 'border-iron-600 text-white'}`}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            {(editingField === 'age' || editingField === 'heightCm' || editingField === 'bodyWeightKg') && (
              <div className="flex gap-3">
                <input autoFocus type="number" value={tempValue} onChange={e => setTempValue(e.target.value)}
                  className="flex-1 bg-iron-800 border border-iron-600 text-white font-mono text-lg px-4 py-3 focus:outline-none focus:border-acid" />
                <button onClick={() => saveField(editingField, tempValue)}
                  className="px-6 py-3 bg-acid text-black font-mono text-[11px] uppercase tracking-widest">Save</button>
              </div>
            )}
            {editingField === 'fitnessLevel' && (
              <div className="flex flex-col gap-2">
                {(Object.keys(FITNESS_LEVEL_LABELS) as FitnessLevel[]).map(level => (
                  <button key={level} onClick={() => saveField('fitnessLevel', level)}
                    className={`w-full py-3 font-mono text-[11px] uppercase tracking-widest border text-left px-4 ${fp.fitnessLevel === level ? 'bg-acid text-black border-acid' : 'border-iron-600 text-white'}`}>
                    {FITNESS_LEVEL_LABELS[level]}
                  </button>
                ))}
              </div>
            )}
            {editingField === 'primaryGoal' && (
              <div className="flex flex-col gap-2">
                {(Object.keys(GOAL_LABELS) as PrimaryGoal[]).map(goal => (
                  <button key={goal} onClick={() => saveField('primaryGoal', goal)}
                    className={`w-full py-3 font-mono text-[11px] uppercase tracking-widest border text-left px-4 ${fp.primaryGoal === goal ? 'bg-acid text-black border-acid' : 'border-iron-600 text-white'}`}>
                    {GOAL_LABELS[goal]}
                  </button>
                ))}
              </div>
            )}
            {editingField === 'bodyFatPct' && (
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <input autoFocus type="number" value={tempValue} onChange={e => setTempValue(e.target.value)}
                    placeholder="e.g. 15"
                    className="flex-1 bg-iron-800 border border-iron-600 text-white font-mono text-lg px-4 py-3 focus:outline-none focus:border-acid placeholder:text-iron-600" />
                  <button onClick={() => saveField('bodyFatPct', tempValue)}
                    className="px-6 py-3 bg-acid text-black font-mono text-[11px] uppercase tracking-widest">Save</button>
                </div>
                <button onClick={() => saveField('bodyFatPct', '')}
                  className="font-mono text-[10px] uppercase tracking-widest text-iron-500 text-left">
                  Clear (set to none)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Program picker bottom-sheet */}
      {showProgramPicker && !showCustomBuilder && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowProgramPicker(false)} />
          <div className="relative bg-iron-900 border-t-2 border-acid px-5 pt-5 pb-10 max-h-[80vh] overflow-y-auto">
            <p className="font-mono text-[10px] uppercase tracking-widest text-iron-400 mb-4">Choose Program</p>

            {[...PRESET_PROGRAMS, ...customPrograms].map(prog => (
              <div key={prog.id} className="flex items-center justify-between border-b border-iron-800 py-3">
                <button
                  onClick={() => handleSelectProgram(prog.id)}
                  className="flex-1 text-left"
                >
                  <span className={`font-mono text-[11px] uppercase tracking-widest block mb-1 ${activeProgram.id === prog.id ? 'text-acid' : 'text-white'}`}>
                    {prog.name}
                    {activeProgram.id === prog.id && ' ✓'}
                  </span>
                  <div className="flex gap-1 flex-wrap">
                    {prog.days.map(d => (
                      <span key={d.key} className="px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest"
                        style={{ backgroundColor: d.color + '25', color: d.color }}>
                        {d.label}
                      </span>
                    ))}
                  </div>
                </button>
                {!prog.isPreset && (
                  <button
                    onClick={() => handleDeleteCustom(prog.id)}
                    className="ml-3 font-mono text-[10px] uppercase tracking-widest text-red-400 px-2 py-1 border border-red-900 shrink-0"
                  >
                    Del
                  </button>
                )}
              </div>
            ))}

            <button
              onClick={() => setShowCustomBuilder(true)}
              className="w-full mt-4 py-3 font-mono text-[11px] uppercase tracking-widest text-acid border border-acid"
            >
              + Create Custom
            </button>
          </div>
        </div>
      )}

      {/* Custom program builder */}
      {showProgramPicker && showCustomBuilder && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setShowCustomBuilder(false); setShowProgramPicker(false) }} />
          <div className="relative bg-iron-900 border-t-2 border-acid px-5 pt-5 pb-10 max-h-[85vh] overflow-y-auto">
            <p className="font-mono text-[10px] uppercase tracking-widest text-iron-400 mb-4">Create Custom Program</p>

            <input
              autoFocus
              placeholder="Program name (e.g. My Split)"
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              className="w-full bg-iron-800 border border-iron-600 text-white font-sans px-4 py-3 mb-4 focus:outline-none focus:border-acid placeholder:text-iron-600"
            />

            <p className="font-mono text-[10px] uppercase tracking-widest text-iron-400 mb-2">Days (in rotation order)</p>
            <div className="flex flex-col gap-2 mb-4">
              {customDays.map((d, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: CUSTOM_PALETTE[i % CUSTOM_PALETTE.length] }}
                  />
                  <input
                    placeholder={`Day ${i + 1} name (e.g. Upper)`}
                    value={d.label}
                    onChange={e => {
                      const next = [...customDays]
                      next[i] = { label: e.target.value }
                      setCustomDays(next)
                    }}
                    className="flex-1 bg-iron-800 border border-iron-600 text-white font-sans px-3 py-2 focus:outline-none focus:border-acid placeholder:text-iron-600 text-sm"
                  />
                  {customDays.length > 1 && (
                    <button
                      onClick={() => setCustomDays(prev => prev.filter((_, j) => j !== i))}
                      className="font-mono text-iron-500 text-lg px-2 hover:text-red-400"
                    >
                      −
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => setCustomDays(prev => [...prev, { label: '' }])}
              className="w-full py-2 font-mono text-[10px] uppercase tracking-widest text-iron-400 border border-iron-700 mb-4"
            >
              + Add Day
            </button>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowCustomBuilder(false); setCustomName(''); setCustomDays([{ label: '' }]) }}
                className="flex-1 py-3 border border-iron-600 font-mono text-xs uppercase tracking-wider text-iron-400"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCustom}
                disabled={!customName.trim() || customDays.every(d => !d.label.trim())}
                className="flex-1 py-3 bg-acid text-black font-mono text-xs uppercase tracking-wider disabled:opacity-40"
              >
                Save Program
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
