import type { WorkoutSet } from '../types'

interface Props {
  set: WorkoutSet
  unit: string
}

function fmtTime(secs: number): string {
  const m = Math.floor(Math.abs(secs) / 60)
  const s = Math.abs(secs) % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export default function SetRow({ set, unit }: Props) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-iron-700 last:border-0">
      <span className="font-mono text-iron-400 text-xs w-5 flex-shrink-0">#{set.setNumber}</span>
      <span className="font-mono font-bold text-white text-base flex-1">{set.reps}<span className="text-iron-400 text-xs ml-0.5">reps</span></span>
      <span className="font-mono font-bold text-acid text-base">{set.weight}<span className="text-iron-400 text-xs ml-0.5">{unit}</span></span>
      <span className="font-mono text-iron-400 text-xs">{fmtTime(set.activeDuration)}</span>
    </div>
  )
}
