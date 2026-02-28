/*
 * Copyright 2026 QRun.IO, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Tests for useUserPreferences hook

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUserPreferences } from './use-user-preferences'

const STORAGE_KEY = 'qqq-user-preferences'

describe('useUserPreferences', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns default preferences when storage is empty', () => {
    const { result } = renderHook(() => useUserPreferences())
    expect(result.current.preferences.tableDefaultPageSize).toBe(25)
    expect(result.current.preferences.tableDefaultDensity).toBe('standard')
    expect(result.current.preferences.tableDefaultViewMode).toBe('grid')
    expect(result.current.preferences.recordDefaultViewMode).toBe('tabs')
  })

  it('reads persisted preferences from localStorage', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ tableDefaultPageSize: 50, tableDefaultDensity: 'compact', tableDefaultViewMode: 'card', recordDefaultViewMode: 'list' })
    )
    const { result } = renderHook(() => useUserPreferences())
    expect(result.current.preferences.tableDefaultPageSize).toBe(50)
    expect(result.current.preferences.tableDefaultDensity).toBe('compact')
  })

  it('updatePreference changes a single preference key', () => {
    const { result } = renderHook(() => useUserPreferences())

    act(() => {
      result.current.updatePreference('tableDefaultPageSize', 100)
    })

    expect(result.current.preferences.tableDefaultPageSize).toBe(100)
    // Other prefs unchanged
    expect(result.current.preferences.tableDefaultDensity).toBe('standard')
  })

  it('updatePreference persists to localStorage', () => {
    const { result } = renderHook(() => useUserPreferences())

    act(() => {
      result.current.updatePreference('tableDefaultViewMode', 'card')
    })

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(stored.tableDefaultViewMode).toBe('card')
  })

  it('resetPreferences restores all defaults', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ tableDefaultPageSize: 100, tableDefaultDensity: 'comfortable', tableDefaultViewMode: 'card', recordDefaultViewMode: 'list' })
    )
    const { result } = renderHook(() => useUserPreferences())

    act(() => {
      result.current.resetPreferences()
    })

    expect(result.current.preferences.tableDefaultPageSize).toBe(25)
    expect(result.current.preferences.tableDefaultDensity).toBe('standard')
  })

  it('exposes defaults constant', () => {
    const { result } = renderHook(() => useUserPreferences())
    expect(result.current.defaults.tableDefaultPageSize).toBe(25)
    expect(result.current.defaults.tableDefaultViewMode).toBe('grid')
  })
})
