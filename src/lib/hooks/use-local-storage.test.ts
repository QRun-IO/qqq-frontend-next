// Tests for useLocalStorage hook

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLocalStorage } from './use-local-storage'

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('returns initial value when storage is empty', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'))
    expect(result.current[0]).toBe('default')
  })

  it('reads existing value from localStorage', () => {
    localStorage.setItem('test-key', JSON.stringify('stored'))
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'))
    expect(result.current[0]).toBe('stored')
  })

  it('returns initial value for invalid JSON in storage', () => {
    localStorage.setItem('test-key', 'not-json{')
    const { result } = renderHook(() => useLocalStorage('test-key', 42))
    expect(result.current[0]).toBe(42)
  })

  it('setValue updates state and persists to localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', ''))

    act(() => {
      result.current[1]('new value')
    })

    expect(result.current[0]).toBe('new value')
    expect(JSON.parse(localStorage.getItem('test-key')!)).toBe('new value')
  })

  it('setValue accepts a function updater', () => {
    const { result } = renderHook(() => useLocalStorage('count', 0))

    act(() => {
      result.current[1]((prev) => prev + 1)
    })

    expect(result.current[0]).toBe(1)
  })

  it('removeValue resets to initial and removes from storage', () => {
    localStorage.setItem('test-key', JSON.stringify('stored'))
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'))

    act(() => {
      result.current[2]()
    })

    expect(result.current[0]).toBe('default')
    expect(localStorage.getItem('test-key')).toBeNull()
  })

  it('works with object values', () => {
    const { result } = renderHook(() => useLocalStorage<{ count: number }>('obj', { count: 0 }))

    act(() => {
      result.current[1]({ count: 5 })
    })

    expect(result.current[0]).toEqual({ count: 5 })
    expect(JSON.parse(localStorage.getItem('obj')!)).toEqual({ count: 5 })
  })

  it('syncs value when storage event fires from another tab', () => {
    const { result } = renderHook(() => useLocalStorage('tab-key', 'initial'))

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'tab-key',
          newValue: JSON.stringify('from-other-tab'),
        })
      )
    })

    expect(result.current[0]).toBe('from-other-tab')
  })

  it('ignores storage events for different keys', () => {
    const { result } = renderHook(() => useLocalStorage('my-key', 'initial'))

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'other-key',
          newValue: JSON.stringify('other-value'),
        })
      )
    })

    expect(result.current[0]).toBe('initial')
  })
})
