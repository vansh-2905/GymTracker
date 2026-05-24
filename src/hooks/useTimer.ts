import { useState, useRef, useCallback, useEffect } from 'react'

export type TimerPhase = 'idle' | 'set' | 'rest'

export function useTimer(restDefault = 90) {
  const restDefaultRef = useRef(restDefault)
  useEffect(() => { restDefaultRef.current = restDefault }, [restDefault])

  const [setSeconds, setSetSeconds] = useState(0)
  const [restSeconds, setRestSeconds] = useState(restDefault)
  const [phase, setPhase] = useState<TimerPhase>('idle')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Ref mirrors setSeconds so stopSet can read it synchronously (useState is async)
  const setSecondsRef = useRef(0)

  const clearInterval_ = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const startSet = useCallback(() => {
    clearInterval_()
    setSecondsRef.current = 0
    setSetSeconds(0)
    setPhase('set')
    intervalRef.current = setInterval(() => {
      setSecondsRef.current += 1
      setSetSeconds(setSecondsRef.current)
    }, 1000)
  }, [])

  const stopSet = useCallback((): number => {
    clearInterval_()
    const elapsed = setSecondsRef.current
    setRestSeconds(restDefaultRef.current)
    setPhase('rest')
    intervalRef.current = setInterval(() => setRestSeconds(s => s - 1), 1000)
    return elapsed
  }, [])

  const resetTimers = useCallback(() => {
    clearInterval_()
    setSecondsRef.current = 0
    setSetSeconds(0)
    setRestSeconds(restDefaultRef.current)
    setPhase('idle')
  }, [])

  return { setSeconds, restSeconds, phase, startSet, stopSet, resetTimers }
}
