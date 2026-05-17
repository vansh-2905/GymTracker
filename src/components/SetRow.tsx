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
    <div className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
      <span className="text-gray-400 text-sm w-6">#{set.setNumber}</span>
      <span className="font-semibold">{set.reps} reps</span>
      <span className="font-semibold">{set.weight}{unit}</span>
      <span className="text-gray-400 text-xs">{fmtTime(set.activeDuration)} active</span>
      <span className="text-gray-400 text-xs">{fmtTime(set.restDuration)} rest</span>
    </div>
  )
}
