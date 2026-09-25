/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * @file Keeps keyboard-opened Radix tooltips open through the focus scroll.
 *
 * Focusing an off-screen trigger makes the browser scroll it into view, and Radix
 * Tooltip closes on any scroll that contains its trigger, so keyboard users never
 * saw the tooltip. Closes requested right after focus, while the trigger still has
 * focus, are ignored; blur and Escape always close.
 */

import { useCallback, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

/** How long after focus a Radix-initiated close is treated as the focus scroll. */
export const FOCUS_SCROLL_GRACE_MS = 500

/** Controlled-state props for a Radix Tooltip Root and its Trigger. */
export interface FocusSafeTooltip {
  /** Controlled open state for `Tooltip.Root`. */
  open: boolean
  /** `Tooltip.Root` onOpenChange. */
  onOpenChange: (open: boolean) => void
  /** `Tooltip.Trigger` onFocus. */
  onFocus: () => void
  /** `Tooltip.Trigger` onBlur. */
  onBlur: () => void
  /** `Tooltip.Trigger` onKeyDown (Escape closes). */
  onKeyDown: (event: KeyboardEvent) => void
}

/**
 * Controlled tooltip state that survives the scroll caused by keyboard focus.
 *
 * @param now - Clock, injectable for tests.
 * @returns Props to spread onto `Tooltip.Root` (open, onOpenChange) and `Tooltip.Trigger` (onFocus, onBlur, onKeyDown).
 */
export function useFocusSafeTooltip(now: () => number = Date.now): FocusSafeTooltip {
  const [open, setOpen] = useState(false)
  const focusedAt = useRef<number | null>(null)

  const onOpenChange = useCallback((next: boolean) => {
    if (!next && focusedAt.current !== null && now() - focusedAt.current < FOCUS_SCROLL_GRACE_MS) return
    setOpen(next)
  }, [now])
  const onFocus = useCallback(() => {
    focusedAt.current = now()
    setOpen(true)
  }, [now])
  const onBlur = useCallback(() => {
    focusedAt.current = null
    setOpen(false)
  }, [])
  const onKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      focusedAt.current = null
      setOpen(false)
    }
  }, [])

  return { open, onOpenChange, onFocus, onBlur, onKeyDown }
}
