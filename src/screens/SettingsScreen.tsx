import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { getProfile, updateWeightUnit, updateRestDefault } from '../services/profileService'
import { getFitnessProfile, saveFitnessProfile } from '../services/fitnessProfileService'
import { computeUserMetFactor } from '../utils/calorieCalc'
import type { UserProfile, FitnessProfile, BiologicalSex, FitnessLevel, PrimaryGoal, WeightUnit } from '../types'

type EditingField =
  | 'biologicalSex'
  | 'age'
  | 'heightCm'
  | 'bodyWeightKg'
  | 'fitnessLevel'
  | 'primaryGoal'
  | 'bodyFatPct'
  | null

const FITNESS_LEVEL_LABELS: Record<FitnessLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  active: 'Active',
  advanced: 'Advanced',
  athlete: 'Athlete',
}

const GOAL_LABELS: Record<PrimaryGoal, string> = {
  weight_loss: 'Weight Loss',
  muscle_gain: 'Muscle Gain',
  maintenance: 'Maintenance',
  endurance: 'Endurance',
  general_health: 'General Health',
}

export default function SettingsScreen() {
  const { user, signOut } = useAuth()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [fp, setFp] = useState<FitnessProfile | null>(null)
  const [editingField, setEditingField] = useState<EditingField>(null)
  const [tempValue, setTempValue] = useState<string>('')
  const [restInput, setRestInput] = useState('')
  const [savedField, setSavedField] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    Promise.all([getProfile(user.uid), getFitnessProfile(user.uid)]).then(
      ([profile, fitnessProfile]) => {
        setUserProfile(profile)
        setFp(fitnessProfile)
        setRestInput(String(profile?.restDefaultSeconds ?? 90))
      },
    )
  }, [user])

  const flashSaved = (field: string) => {
    setSavedField(field)
    setTimeout(() => setSavedField(null), 1500)
  }

  const handleWeightUnit = async (unit: WeightUnit) => {
    if (!user || !userProfile) return
    await updateWeightUnit(user.uid, unit)
    setUserProfile({ ...userProfile, weightUnit: unit })
    flashSaved('weightUnit')
  }

  const handleRestBlur = async () => {
    if (!user) return
    const parsed = parseInt(restInput, 10)
    if (isNaN(parsed) || parsed < 10) return
    const clamped = Math.min(parsed, 600)
    await updateRestDefault(user.uid, clamped)
    setRestInput(String(clamped))
    if (userProfile) setUserProfile({ ...userProfile, restDefaultSeconds: clamped })
    flashSaved('rest')
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
    if (field === 'biologicalSex') updated.biologicalSex = value as BiologicalSex
    else if (field === 'age') updated.age = parseInt(value, 10)
    else if (field === 'heightCm') updated.heightCm = parseFloat(value)
    else if (field === 'bodyWeightKg') updated.bodyWeightKg = parseFloat(value)
    else if (field === 'fitnessLevel') updated.fitnessLevel = value as FitnessLevel
    else if (field === 'primaryGoal') updated.primaryGoal = value as PrimaryGoal
    else if (field === 'bodyFatPct') updated.bodyFatPct = value === '' ? null : value
    updated.userMetFactor = computeUserMetFactor(updated.biologicalSex, updated.age, updated.fitnessLevel)
    await saveFitnessProfile(user.uid, updated)
    setFp(updated)
    setEditingField(null)
    flashSaved(field)
  }

  const showCalorieProfile = fp !== null && !fp.skipped

  return (
    <div className="min-h-screen bg-iron-950 text-white pb-24">
      <div className="h-0.5 bg-acid" />
      <div className="px-5 pt-6 pb-4">
        <h1 className="font-display text-3xl tracking-wide text-white">SETTINGS</h1>
      </div>

      {/* Preferences */}
      <div className="mx-5 mb-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-iron-400 mb-2">Preferences</p>
        <div className="bg-iron-900 border border-iron-700">
          {/* Weight unit */}
          <div className="px-4 py-3 flex items-center justify-between border-b border-iron-700">
            <span className="font-mono text-[11px] uppercase tracking-widest text-iron-300">Weight Unit</span>
            <div className="flex gap-1">
              {(['kg', 'lbs'] as WeightUnit[]).map(u => (
                <button
                  key={u}
                  onClick={() => handleWeightUnit(u)}
                  className={`px-3 py-1 font-mono text-[11px] uppercase tracking-widest border transition-colors ${
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

          {/* Rest timer */}
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

      {/* Bottom-sheet modal */}
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
                  <button
                    key={s}
                    onClick={() => saveField('biologicalSex', s)}
                    className={`flex-1 py-3 font-mono text-[11px] uppercase tracking-widest border ${
                      fp.biologicalSex === s ? 'bg-acid text-black border-acid' : 'border-iron-600 text-white'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {(editingField === 'age' || editingField === 'heightCm' || editingField === 'bodyWeightKg') && (
              <div className="flex gap-3">
                <input
                  autoFocus
                  type="number"
                  value={tempValue}
                  onChange={e => setTempValue(e.target.value)}
                  className="flex-1 bg-iron-800 border border-iron-600 text-white font-mono text-lg px-4 py-3 focus:outline-none focus:border-acid"
                />
                <button
                  onClick={() => saveField(editingField, tempValue)}
                  className="px-6 py-3 bg-acid text-black font-mono text-[11px] uppercase tracking-widest"
                >
                  Save
                </button>
              </div>
            )}

            {editingField === 'fitnessLevel' && (
              <div className="flex flex-col gap-2">
                {(Object.keys(FITNESS_LEVEL_LABELS) as FitnessLevel[]).map(level => (
                  <button
                    key={level}
                    onClick={() => saveField('fitnessLevel', level)}
                    className={`w-full py-3 font-mono text-[11px] uppercase tracking-widest border text-left px-4 ${
                      fp.fitnessLevel === level ? 'bg-acid text-black border-acid' : 'border-iron-600 text-white'
                    }`}
                  >
                    {FITNESS_LEVEL_LABELS[level]}
                  </button>
                ))}
              </div>
            )}

            {editingField === 'primaryGoal' && (
              <div className="flex flex-col gap-2">
                {(Object.keys(GOAL_LABELS) as PrimaryGoal[]).map(goal => (
                  <button
                    key={goal}
                    onClick={() => saveField('primaryGoal', goal)}
                    className={`w-full py-3 font-mono text-[11px] uppercase tracking-widest border text-left px-4 ${
                      fp.primaryGoal === goal ? 'bg-acid text-black border-acid' : 'border-iron-600 text-white'
                    }`}
                  >
                    {GOAL_LABELS[goal]}
                  </button>
                ))}
              </div>
            )}

            {editingField === 'bodyFatPct' && (
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <input
                    autoFocus
                    type="number"
                    value={tempValue}
                    onChange={e => setTempValue(e.target.value)}
                    placeholder="e.g. 15"
                    className="flex-1 bg-iron-800 border border-iron-600 text-white font-mono text-lg px-4 py-3 focus:outline-none focus:border-acid placeholder:text-iron-600"
                  />
                  <button
                    onClick={() => saveField('bodyFatPct', tempValue)}
                    className="px-6 py-3 bg-acid text-black font-mono text-[11px] uppercase tracking-widest"
                  >
                    Save
                  </button>
                </div>
                <button
                  onClick={() => saveField('bodyFatPct', '')}
                  className="font-mono text-[10px] uppercase tracking-widest text-iron-500 text-left"
                >
                  Clear (set to none)
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
