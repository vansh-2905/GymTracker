import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { saveFitnessProfile } from '../services/fitnessProfileService'
import { setActiveProgramId } from '../services/profileService'
import { computeUserMetFactor } from '../utils/calorieCalc'
import { PRESET_PROGRAMS, getProgramById } from '../data/programs'
import { seedProgramExercises } from '../utils/programExercises'
import type { BiologicalSex, FitnessLevel, PrimaryGoal } from '../types'

const TOTAL_STEPS = 8

const FITNESS_OPTIONS: { label: string; value: FitnessLevel }[] = [
  { label: 'Beginner — I rarely or never exercise', value: 'beginner' },
  { label: 'Intermediate — I exercise 1–3 times a week', value: 'intermediate' },
  { label: 'Active — I exercise 4–5 times a week', value: 'active' },
  { label: 'Advanced — I train 6+ times a week', value: 'advanced' },
  { label: 'Athlete — I train at a competitive level', value: 'athlete' },
]

const GOAL_OPTIONS: { label: string; value: PrimaryGoal }[] = [
  { label: 'Lose weight / burn fat', value: 'weight_loss' },
  { label: 'Build muscle / gain strength', value: 'muscle_gain' },
  { label: 'Maintain current fitness', value: 'maintenance' },
  { label: 'Improve endurance / cardio', value: 'endurance' },
  { label: 'General health and wellness', value: 'general_health' },
]

const BODY_FAT_OPTIONS = [
  { label: 'Under 10%', value: 'under_10' },
  { label: '10–15%', value: '10_15' },
  { label: '15–20%', value: '15_20' },
  { label: '20–25%', value: '20_25' },
  { label: '25–30%', value: '25_30' },
  { label: 'Over 30%', value: 'over_30' },
  { label: "I don't know", value: 'unknown' },
]

const DEFAULTS = {
  biologicalSex: 'male' as BiologicalSex,
  age: 25,
  heightCm: 170,
  bodyWeightKg: 75,
  fitnessLevel: 'intermediate' as FitnessLevel,
  primaryGoal: 'general_health' as PrimaryGoal,
}

interface Props {
  onComplete: () => void
}

export default function OnboardingScreen({ onComplete }: Props) {
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [selectedProgramId, setSelectedProgramId] = useState('ppl')

  const [biologicalSex, setBiologicalSex] = useState<BiologicalSex | null>(null)
  const [age, setAge] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ftin'>('cm')
  const [heightFt, setHeightFt] = useState('')
  const [heightIn, setHeightIn] = useState('')
  const [bodyWeightVal, setBodyWeightVal] = useState('')
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg')
  const [fitnessLevel, setFitnessLevel] = useState<FitnessLevel | null>(null)
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoal | null>(null)
  const [bodyFatPct, setBodyFatPct] = useState<string | null>(null)

  function resolvedHeightCm(): number {
    if (heightUnit === 'cm') return parseFloat(heightCm) || DEFAULTS.heightCm
    const ft = parseFloat(heightFt) || 0
    const inches = parseFloat(heightIn) || 0
    return Math.round(ft * 30.48 + inches * 2.54)
  }

  function resolvedWeightKg(): number {
    const val = parseFloat(bodyWeightVal)
    if (!val) return DEFAULTS.bodyWeightKg
    return weightUnit === 'kg' ? val : Math.round((val / 2.205) * 10) / 10
  }

  function todayStr(): string {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const canContinue =
    step === 1 ||
    (step === 2 && biologicalSex !== null) ||
    (step === 3 && age !== '' && parseInt(age) >= 13 && parseInt(age) <= 100) ||
    (step === 4 && (heightUnit === 'cm' ? heightCm !== '' : heightFt !== '')) ||
    (step === 5 && bodyWeightVal !== '') ||
    (step === 6 && fitnessLevel !== null) ||
    (step === 7 && primaryGoal !== null) ||
    step === 8

  async function handleFinish(skipped: boolean) {
    setSaving(true)
    try {
      const sex = skipped ? DEFAULTS.biologicalSex : (biologicalSex ?? DEFAULTS.biologicalSex)
      const ageVal = skipped ? DEFAULTS.age : (parseInt(age) || DEFAULTS.age)
      const hCm = skipped ? DEFAULTS.heightCm : resolvedHeightCm()
      const wKg = skipped ? DEFAULTS.bodyWeightKg : resolvedWeightKg()
      const level = skipped ? DEFAULTS.fitnessLevel : (fitnessLevel ?? DEFAULTS.fitnessLevel)
      const goal = skipped ? DEFAULTS.primaryGoal : (primaryGoal ?? DEFAULTS.primaryGoal)
      const userMetFactor = computeUserMetFactor(sex, ageVal, level)

      await saveFitnessProfile(user!.uid, {
        biologicalSex: sex,
        age: ageVal,
        heightCm: hCm,
        bodyWeightKg: wKg,
        fitnessLevel: level,
        primaryGoal: goal,
        bodyFatPct: skipped ? null : bodyFatPct,
        userMetFactor,
        skipped,
        completedAt: todayStr(),
      })
      await setActiveProgramId(user!.uid, selectedProgramId)
      seedProgramExercises(user!.uid, getProgramById(selectedProgramId, [])) // fire-and-forget
      onComplete()
    } finally {
      setSaving(false)
    }
  }

  const optionCls = (selected: boolean) =>
    `w-full text-left px-4 py-4 border font-sans text-sm transition-all ${
      selected
        ? 'border-acid bg-acid/10 text-white'
        : 'border-iron-700 text-iron-400 hover:border-iron-500'
    }`

  const unitBtnCls = (active: boolean) =>
    `font-mono text-xs px-4 py-2 border tracking-widest transition-colors ${
      active ? 'border-acid text-acid' : 'border-iron-700 text-iron-400'
    }`

  const inputCls =
    'bg-iron-900 border border-iron-700 text-white font-mono text-3xl px-4 py-4 outline-none focus:border-acid'

  return (
    <div className="min-h-screen bg-iron-950 text-white flex flex-col">
      <div className="h-0.5 w-full bg-acid" />

      {/* Top bar */}
      <div className="flex justify-between items-center px-5 pt-5">
        {step > 1 ? (
          <button
            onClick={() => setStep(s => s - 1)}
            className="font-mono text-iron-400 text-xs hover:text-white transition-colors"
          >
            ← BACK
          </button>
        ) : (
          <div />
        )}
        <span className="font-mono text-iron-400 text-[10px] tracking-widest">
          {step} / {TOTAL_STEPS}
        </span>
        <button
          onClick={() => handleFinish(true)}
          className="font-mono text-iron-500 text-[10px] tracking-widest hover:text-iron-300 transition-colors"
        >
          SKIP
        </button>
      </div>

      {/* Step content */}
      <div className="flex-1 flex flex-col justify-center px-5 pb-32">
        {step === 1 && (
          <div className="flex flex-col flex-1">
            <p className="font-mono text-iron-500 text-[10px] uppercase tracking-widest mb-2">Step 1 of {TOTAL_STEPS}</p>
            <h2 className="font-display text-4xl text-white mb-2">YOUR SPLIT</h2>
            <p className="font-sans text-iron-400 text-sm mb-6">Choose how you structure your training week.</p>
            <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
              {PRESET_PROGRAMS.map(prog => (
                <button
                  key={prog.id}
                  onClick={() => setSelectedProgramId(prog.id)}
                  className="w-full text-left border p-4 transition-colors"
                  style={{
                    borderColor: selectedProgramId === prog.id ? '#E8FF3D' : '#333',
                    backgroundColor: selectedProgramId === prog.id ? '#E8FF3D08' : 'transparent',
                  }}
                >
                  <span className="font-mono text-[11px] uppercase tracking-widest text-white block mb-2">
                    {prog.name}
                  </span>
                  <div className="flex gap-1.5 flex-wrap">
                    {prog.days.map(d => (
                      <span
                        key={d.key}
                        className="px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest"
                        style={{ backgroundColor: d.color + '25', color: d.color, border: `1px solid ${d.color}40` }}
                      >
                        {d.label}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="font-mono text-iron-400 text-[10px] tracking-widest uppercase mb-3">ABOUT YOU</p>
            <h1 className="font-display text-4xl leading-tight mb-10">
              WHAT IS YOUR<br />BIOLOGICAL SEX?
            </h1>
            <div className="grid grid-cols-2 gap-4">
              {(['male', 'female'] as BiologicalSex[]).map(s => (
                <button
                  key={s}
                  onClick={() => setBiologicalSex(s)}
                  className={`py-10 border font-display text-2xl transition-all ${
                    biologicalSex === s
                      ? 'border-acid bg-acid/10 text-acid'
                      : 'border-iron-700 text-iron-400 hover:border-iron-500'
                  }`}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <p className="font-mono text-iron-400 text-[10px] tracking-widest uppercase mb-3">ABOUT YOU</p>
            <h1 className="font-display text-4xl leading-tight mb-10">WHAT IS<br />YOUR AGE?</h1>
            <div className="flex items-end gap-3">
              <input
                type="number"
                inputMode="numeric"
                min={13}
                max={100}
                value={age}
                onChange={e => setAge(e.target.value)}
                placeholder="25"
                className={`${inputCls} w-28`}
              />
              <span className="font-mono text-iron-400 text-sm tracking-widest pb-4">YEARS</span>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <p className="font-mono text-iron-400 text-[10px] tracking-widest uppercase mb-3">ABOUT YOU</p>
            <h1 className="font-display text-4xl leading-tight mb-6">WHAT IS<br />YOUR HEIGHT?</h1>
            <div className="flex gap-2 mb-6">
              {(['cm', 'ftin'] as const).map(u => (
                <button key={u} onClick={() => setHeightUnit(u)} className={unitBtnCls(heightUnit === u)}>
                  {u === 'cm' ? 'CM' : 'FT / IN'}
                </button>
              ))}
            </div>
            {heightUnit === 'cm' ? (
              <div className="flex items-end gap-3">
                <input
                  type="number"
                  inputMode="numeric"
                  value={heightCm}
                  onChange={e => setHeightCm(e.target.value)}
                  placeholder="170"
                  className={`${inputCls} w-28`}
                />
                <span className="font-mono text-iron-400 text-sm tracking-widest pb-4">CM</span>
              </div>
            ) : (
              <div className="flex items-end gap-4">
                <div className="flex items-end gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={heightFt}
                    onChange={e => setHeightFt(e.target.value)}
                    placeholder="5"
                    className={`${inputCls} w-20`}
                  />
                  <span className="font-mono text-iron-400 text-sm tracking-widest pb-4">FT</span>
                </div>
                <div className="flex items-end gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={heightIn}
                    onChange={e => setHeightIn(e.target.value)}
                    placeholder="10"
                    className={`${inputCls} w-20`}
                  />
                  <span className="font-mono text-iron-400 text-sm tracking-widest pb-4">IN</span>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 5 && (
          <div>
            <p className="font-mono text-iron-400 text-[10px] tracking-widest uppercase mb-3">ABOUT YOU</p>
            <h1 className="font-display text-4xl leading-tight mb-6">YOUR BODY<br />WEIGHT?</h1>
            <div className="flex gap-2 mb-6">
              {(['kg', 'lbs'] as const).map(u => (
                <button key={u} onClick={() => setWeightUnit(u)} className={unitBtnCls(weightUnit === u)}>
                  {u.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-3">
              <input
                type="number"
                inputMode="decimal"
                value={bodyWeightVal}
                onChange={e => setBodyWeightVal(e.target.value)}
                placeholder={weightUnit === 'kg' ? '75' : '165'}
                className={`${inputCls} w-32`}
              />
              <span className="font-mono text-iron-400 text-sm tracking-widest pb-4">
                {weightUnit.toUpperCase()}
              </span>
            </div>
          </div>
        )}

        {step === 6 && (
          <div>
            <p className="font-mono text-iron-400 text-[10px] tracking-widest uppercase mb-3">YOUR TRAINING</p>
            <h1 className="font-display text-4xl leading-tight mb-8">FITNESS<br />LEVEL?</h1>
            <div className="space-y-2">
              {FITNESS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFitnessLevel(opt.value)}
                  className={optionCls(fitnessLevel === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 7 && (
          <div>
            <p className="font-mono text-iron-400 text-[10px] tracking-widest uppercase mb-3">YOUR TRAINING</p>
            <h1 className="font-display text-4xl leading-tight mb-8">PRIMARY<br />GOAL?</h1>
            <div className="space-y-2">
              {GOAL_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setPrimaryGoal(opt.value)}
                  className={optionCls(primaryGoal === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 8 && (
          <div>
            <p className="font-mono text-iron-400 text-[10px] tracking-widest uppercase mb-3">OPTIONAL</p>
            <h1 className="font-display text-4xl leading-tight mb-2">BODY FAT<br />PERCENTAGE?</h1>
            <p className="font-mono text-iron-500 text-[10px] tracking-widest mb-8">
              IMPROVES CALORIE ACCURACY
            </p>
            <div className="space-y-2">
              {BODY_FAT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setBodyFatPct(prev => prev === opt.value ? null : opt.value)}
                  className={optionCls(bodyFatPct === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fixed bottom button */}
      <div className="fixed bottom-0 left-0 right-0 p-5 bg-iron-950 border-t border-iron-800">
        {step < TOTAL_STEPS ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={!canContinue}
            className="w-full py-4 bg-acid text-black font-sans font-bold uppercase disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
            style={{ letterSpacing: '0.12em' }}
          >
            CONTINUE
          </button>
        ) : (
          <button
            onClick={() => handleFinish(false)}
            disabled={saving}
            className="w-full py-4 bg-acid text-black font-sans font-bold uppercase disabled:opacity-50 transition-opacity"
            style={{ letterSpacing: '0.12em' }}
          >
            {saving ? 'SAVING…' : 'FINISH'}
          </button>
        )}
      </div>
    </div>
  )
}
