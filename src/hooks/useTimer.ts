import { useState, useRef, useCallback, useEffect } from 'react'

export type TimerPhase = 'idle' | 'set' | 'rest'

// Timers derive from a wall-clock start timestamp rather than counting interval
// ticks: mobile browsers throttle or fully suspend setInterval while the screen
// is locked or the app is backgrounded, so a tick counter silently falls behind
// during long sessions (wrong timers on return, undercounted set durations).
export function useTimer(restDefault = 90) {
  const restDefaultRef = useRef(restDefault)
  useEffect(() => { restDefaultRef.current = restDefault }, [restDefault])

  const [setSeconds, setSetSeconds] = useState(0)
  const [restSeconds, setRestSeconds] = useState(restDefault)
  const [phase, setPhase] = useState<TimerPhase>('idle')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const phaseRef = useRef<TimerPhase>('idle')
  const startedAtRef = useRef(0)

  const elapsedSecs = () => Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000))

  const sync = useCallback(() => {
    if (phaseRef.current === 'set') setSetSeconds(elapsedSecs())
    else if (phaseRef.current === 'rest') setRestSeconds(restDefaultRef.current - elapsedSecs())
  }, [])

  const clearInterval_ = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const startTicking = useCallback(() => {
    clearInterval_()
    // Ticks only refresh the display; the value is recomputed from the
    // timestamp each time, so missed ticks never lose time.
    intervalRef.current = setInterval(sync, 500)
  }, [sync])

  const startSet = useCallback(() => {
    startedAtRef.current = Date.now()
    phaseRef.current = 'set'
    setSetSeconds(0)
    setPhase('set')
    startTicking()
  }, [startTicking])

  const stopSet = useCallback((): number => {
    const elapsed = elapsedSecs()
    startedAtRef.current = Date.now()
    phaseRef.current = 'rest'
    setRestSeconds(restDefaultRef.current)
    setPhase('rest')
    startTicking()
    return elapsed
  }, [startTicking])

  const resetTimers = useCallback(() => {
    clearInterval_()
    phaseRef.current = 'idle'
    setSetSeconds(0)
    setRestSeconds(restDefaultRef.current)
    setPhase('idle')
  }, [])

  // Catch up immediately when the tab becomes visible again — intervals may
  // not have fired at all while the page was hidden.
  useEffect(() => {
    const onVisibilityChange = () => { if (!document.hidden) sync() }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      clearInterval_()
    }
  }, [sync])

  return { setSeconds, restSeconds, phase, startSet, stopSet, resetTimers }
}
