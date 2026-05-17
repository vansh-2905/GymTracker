import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTimer } from './useTimer'

describe('useTimer', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('set timer starts at 0 and increments', () => {
    const { result } = renderHook(() => useTimer())
    act(() => { result.current.startSet() })
    act(() => { vi.advanceTimersByTime(3000) })
    expect(result.current.setSeconds).toBe(3)
  })

  it('stopSet returns elapsed seconds and starts rest timer', () => {
    const { result } = renderHook(() => useTimer())
    act(() => { result.current.startSet() })
    act(() => { vi.advanceTimersByTime(5000) })
    let elapsed = 0
    act(() => { elapsed = result.current.stopSet() })
    expect(elapsed).toBe(5)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.restSeconds).toBe(89)
  })

  it('rest timer goes negative after 90 seconds', () => {
    const { result } = renderHook(() => useTimer())
    act(() => { result.current.startSet() })
    act(() => { result.current.stopSet() })
    act(() => { vi.advanceTimersByTime(100_000) })
    expect(result.current.restSeconds).toBeLessThan(0)
  })

  it('resetTimers clears both timers to initial state', () => {
    const { result } = renderHook(() => useTimer())
    act(() => { result.current.startSet() })
    act(() => { vi.advanceTimersByTime(3000) })
    act(() => { result.current.stopSet() })
    act(() => { result.current.resetTimers() })
    expect(result.current.setSeconds).toBe(0)
    expect(result.current.restSeconds).toBe(90)
    expect(result.current.phase).toBe('idle')
  })
})
