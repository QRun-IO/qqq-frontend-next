/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { act, renderHook } from '@testing-library/react'
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react'
import { describe, expect, it, vi } from 'vitest'
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

  it('toggles on a touch or pen tap and leaves mouse clicks to Radix', () => {
    const { result } = renderHook(() => useFocusSafeTooltip(() => 0))
    const click = () => {
      const event = { preventDefault: vi.fn() }
      act(() => result.current.onClick(event as unknown as MouseEvent))
      return event
    }
    const down = (pointerType: string) => act(() => result.current.onPointerDown({ pointerType } as unknown as PointerEvent))

    // A tap opens it and keeps Radix from closing it on the same click
    down('touch')
    const opening = click()
    expect(result.current.open).toBe(true)
    expect(opening.preventDefault).toHaveBeenCalled()
    // A tap that focused the trigger first stays open
    act(() => result.current.onBlur())
    down('touch')
    act(() => result.current.onFocus())
    click()
    expect(result.current.open).toBe(true)
    // A tap on the open tooltip closes it, also right after focus
    down('pen')
    click()
    expect(result.current.open).toBe(false)
    // A mouse click is not a tap: nothing prevented, state unchanged
    down('mouse')
    const mouse = click()
    expect(mouse.preventDefault).not.toHaveBeenCalled()
    expect(result.current.open).toBe(false)
  })
})
