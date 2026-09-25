/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { act, renderHook } from '@testing-library/react'
import type { KeyboardEvent } from 'react'
import { describe, expect, it } from 'vitest'
import { FOCUS_SCROLL_GRACE_MS, useFocusSafeTooltip } from './use-focus-safe-tooltip'

describe('useFocusSafeTooltip', () => {
  it('ignores the close caused by the focus scroll, then honors later closes', () => {
    let clock = 1000
    const { result } = renderHook(() => useFocusSafeTooltip(() => clock))
    act(() => result.current.onFocus())
    expect(result.current.open).toBe(true)
    act(() => result.current.onOpenChange(false))
    expect(result.current.open).toBe(true)
    clock += FOCUS_SCROLL_GRACE_MS
    act(() => result.current.onOpenChange(false))
    expect(result.current.open).toBe(false)
  })

  it('always closes on blur and Escape, and follows hover changes', () => {
    const { result } = renderHook(() => useFocusSafeTooltip(() => 0))
    act(() => result.current.onFocus())
    act(() => result.current.onBlur())
    expect(result.current.open).toBe(false)
    act(() => result.current.onFocus())
    act(() => result.current.onKeyDown({ key: 'Escape' } as KeyboardEvent))
    expect(result.current.open).toBe(false)
    act(() => result.current.onOpenChange(true))
    expect(result.current.open).toBe(true)
    act(() => result.current.onOpenChange(false))
    expect(result.current.open).toBe(false)
  })
})
