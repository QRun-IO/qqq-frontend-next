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

/**
 * @file useRestoreFocus — returns focus to whatever opened a Radix dialog that is
 * controlled by state (no `Dialog.Trigger`), which Radix would otherwise send to <body>.
 */

import { useCallback, useRef } from 'react'

/**
 * The element a dialog should return focus to: the focused element, or the trigger
 * of the menu whose item was just chosen (menu items unmount when the menu closes).
 *
 * @returns The element, or null when nothing meaningful has focus.
 */
function focusOrigin(): HTMLElement | null {
  const active = document.activeElement
  if (!(active instanceof HTMLElement) || active === document.body) return null
  const menu = active.closest('[role="menu"]')
  if (menu?.id) {
    const trigger = document.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(menu.id)}"]`)
    if (trigger) return trigger
  }
  return active
}

/**
 * Captures the focused element when `open` becomes true and restores it when the
 * dialog closes.
 *
 * @param open - Whether the dialog is open.
 * @returns An `onCloseAutoFocus` handler for the Radix dialog content.
 */
export function useRestoreFocus(open: boolean): (event: Event) => void {
  const origin = useRef<HTMLElement | null>(null)
  const wasOpen = useRef(false)
  if (open && !wasOpen.current && typeof document !== 'undefined') {
    origin.current = focusOrigin()
  }
  wasOpen.current = open

  return useCallback((event: Event) => {
    const target = origin.current
    origin.current = null
    if (target?.isConnected) {
      event.preventDefault()
      target.focus()
    }
  }, [])
}
