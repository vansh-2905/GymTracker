interface Props {
  seconds: number
  label: string
  negative?: boolean
}

function format(secs: number): string {
  const abs = Math.abs(secs)
  const m = Math.floor(abs / 60).toString().padStart(2, '0')
  const s = (abs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function TimerDisplay({ seconds, label, negative }: Props) {
  const isNeg = seconds < 0
  return (
    <div className="text-center">
      <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-4xl font-mono font-bold ${isNeg ? 'text-red-400' : negative ? 'text-white' : 'text-white'}`}>
        {isNeg ? '−' : ''}{format(seconds)}
      </p>
    </div>
  )
}
