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
 * @file usePageShortcuts — single-key page shortcuts (Material parity: `n`, `r`, `f` on a
 * table query; `n`, `e`, `c`, `d`, `a` on a record view).
 */

'use client'

import { useEffect, useRef } from 'react'

/** Single lowercase keys mapped to their action; a missing or `false` entry is not offered. */
export type PageShortcutMap = Partial<Record<string, (() => void) | false | undefined>>

/**
 * Whether a key event started in a control that takes typed text, where single keys are input.
 *
 * @param target - The event target.
 * @returns `true` for text inputs, text areas, selects and editable content.
 */
export function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName.toLowerCase()
  if (tag === 'textarea' || tag === 'select') return true
  if (tag !== 'input') return false
  const type = (target as HTMLInputElement).type
  return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image'].includes(type)
}

/**
 * Whether a dialog, menu or popover is open, in which case page shortcuts must not fire
 * (Material ignores them while a modal, the dot menu or the keyboard help is open).
 *
 * @param doc - The document to inspect.
 * @returns `true` when an overlay is showing.
 */
export function hasOpenOverlay(doc: Document): boolean {
  return doc.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]') !== null
}

/**
 * Registers single-key shortcuts for the current page. Keys fire only without modifiers,
 * outside text entry, and when no dialog or menu is open; the page's other key handling
 * (global `.`, `/`, `?` and Ctrl/Cmd+K) is untouched.
 *
 * @param shortcuts - Key to action; entries that are `false` or missing are ignored.
 * @param enabled - Turns every shortcut off (for example while the page is loading).
 */
export function usePageShortcuts(shortcuts: PageShortcutMap, enabled = true): void {
  const latest = useRef(shortcuts)
  latest.current = shortcuts

  useEffect(() => {
    if (!enabled) return undefined
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTextEntryTarget(event.target) || hasOpenOverlay(document)) return
      const action = latest.current[event.key]
      if (typeof action !== 'function') return
      event.preventDefault()
      action()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [enabled])
}
