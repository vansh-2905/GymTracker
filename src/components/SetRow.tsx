import { useRef, useState } from 'react'
import type { WorkoutSet } from '../types'

interface Props {
  set: WorkoutSet
  unit: string
  onEdit: (set: WorkoutSet) => void
  onDelete: (set: WorkoutSet) => void
}

function fmtTime(secs: number): string {
  const m = Math.floor(Math.abs(secs) / 60)
  const s = Math.abs(secs) % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

const SWIPE_THRESHOLD = 40
const REVEAL_WIDTH = 72

export default function SetRow({ set, unit, onEdit, onDelete }: Props) {
  const [offsetX, setOffsetX] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const startX = useRef(0)
  const dragging = useRef(false)

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
    dragging.current = true
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current) return
    const delta = e.touches[0].clientX - startX.current
    if (revealed) {
      // Already revealed: allow swiping back right
      const adjusted = -REVEAL_WIDTH + Math.min(delta, REVEAL_WIDTH)
      setOffsetX(Math.min(0, adjusted))
    } else {
      // Clamp to [-REVEAL_WIDTH, 0]
      setOffsetX(Math.max(-REVEAL_WIDTH, Math.min(0, delta)))
    }
  }

  const handleTouchEnd = () => {
    dragging.current = false
    if (revealed) {
      // Snap back only if swiped right enough
      if (offsetX > -REVEAL_WIDTH + SWIPE_THRESHOLD) {
        setOffsetX(0)
        setRevealed(false)
      } else {
        setOffsetX(-REVEAL_WIDTH)
      }
    } else {
      if (offsetX < -SWIPE_THRESHOLD) {
        setOffsetX(-REVEAL_WIDTH)
        setRevealed(true)
      } else {
        setOffsetX(0)
      }
    }
  }

  const handleTap = () => {
    if (revealed) {
      setOffsetX(0)
      setRevealed(false)
    } else {
      onEdit(set)
    }
  }

  return (
    <div className="relative overflow-hidden">
      {/* Delete button behind the row */}
      <div
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-red-600"
        style={{ width: REVEAL_WIDTH }}
      >
        <button
          className="w-full h-full flex flex-col items-center justify-center gap-0.5"
          onClick={() => onDelete(set)}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-white">
            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
          </svg>
          <span className="font-mono text-[9px] text-white uppercase">Del</span>
        </button>
      </div>

      {/* Row content */}
      <div
        className="flex items-center gap-3 py-2.5 border-b border-iron-800 last:border-0 bg-iron-900 transition-transform duration-150"
        style={{ transform: `translateX(${offsetX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleTap}
      >
        <span className="font-mono text-iron-600 text-[10px] w-5 flex-shrink-0 tabular-nums">#{set.setNumber}</span>
        {set.isTimed ? (
          <>
            <span className="font-mono font-bold text-acid text-base flex-1">
              {fmtTime(set.activeDuration)}<span className="text-iron-400 text-xs ml-1">hold</span>
            </span>
            <span className="font-mono font-bold text-white text-base">
              {set.weight ?? 0}<span className="text-iron-400 text-xs ml-0.5">{unit}</span>
            </span>
          </>
        ) : set.sides ? (
          <span className="font-mono text-sm flex-1 flex gap-3">
            <span>
              <span className="text-iron-400 text-xs">L </span>
              <span className="font-bold text-white">{set.sides.left.reps}</span>
              <span className="text-iron-400 text-xs">×</span>
              <span className="font-bold text-acid">{set.sides.left.weight}</span>
              <span className="text-iron-400 text-xs ml-0.5">{unit}</span>
            </span>
            <span>
              <span className="text-iron-400 text-xs">R </span>
              <span className="font-bold text-white">{set.sides.right.reps}</span>
              <span className="text-iron-400 text-xs">×</span>
              <span className="font-bold text-acid">{set.sides.right.weight}</span>
              <span className="text-iron-400 text-xs ml-0.5">{unit}</span>
            </span>
          </span>
        ) : (
          <>
            <span className="font-mono font-bold text-white text-base flex-1">
              {set.reps}<span className="text-iron-400 text-xs ml-0.5">reps</span>
            </span>
            <span className="font-mono font-bold text-acid text-base">
              {set.weight}<span className="text-iron-400 text-xs ml-0.5">{unit}</span>
            </span>
          </>
        )}
        {!set.isTimed && <span className="font-mono text-iron-400 text-xs">{fmtTime(set.activeDuration)}</span>}
        {set.kcal !== undefined && (
          <span className="font-mono text-[9px] text-iron-500 bg-iron-800 px-1.5 py-0.5 tabular-nums">
            {set.kcal}k
          </span>
        )}
        {/* Edit hint */}
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-iron-600 flex-shrink-0">
          <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
          <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
        </svg>
      </div>
    </div>
  )
}
