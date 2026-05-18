interface Props {
  seconds: number
  label: string
  negative?: boolean
  active?: boolean
}

function format(secs: number): string {
  const abs = Math.abs(secs)
  const m = Math.floor(abs / 60).toString().padStart(2, '0')
  const s = (abs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function TimerDisplay({ seconds, label, active }: Props) {
  const isNeg = seconds < 0
  const color = isNeg ? '#FF4040' : active ? '#E8FF3D' : '#F0F0F0'
  const glow = isNeg
    ? '0 0 48px rgba(255,64,64,0.35)'
    : active
    ? '0 0 48px rgba(232,255,61,0.25)'
    : 'none'

  return (
    <div className="text-center w-full">
      <p className="font-mono text-iron-400 text-[10px] tracking-widest2 uppercase mb-2">{label}</p>
      <p
        className="font-mono font-bold leading-none tabular-nums transition-colors duration-300"
        style={{ fontSize: 'clamp(4.5rem, 22vw, 7rem)', color, textShadow: glow }}
      >
        {isNeg ? '−' : ''}{format(seconds)}
      </p>
    </div>
  )
}
