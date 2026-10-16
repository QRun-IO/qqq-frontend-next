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
 * @file The "single-key shortcuts" setting (WCAG 2.1.4 Character Key Shortcuts, Level A): a user
 * can turn off every shortcut made of a character key alone (`/`, `.`, `?`, `n`, `e`, Shift+D, …).
 * Shortcuts with Ctrl/⌘ (⌘K, ⌘J) are not affected.
 *
 * The setting is the core "Keyboard" preference section (`keyboard.singleKeyShortcuts`, QQQ's
 * standard section) when the server registers it, so it follows the user across devices; without
 * it, the browser keeps the choice (the Display preferences show the switch).
 */

'use client'

import { useSyncExternalStore } from 'react'

/** Name of QQQ's standard Keyboard preference section. */
export const KEYBOARD_PREFERENCE_SECTION = 'keyboard'

/** Its BOOLEAN field: whether single-key shortcuts are on (default true). */
export const SINGLE_KEY_SHORTCUTS_FIELD = 'singleKeyShortcuts'

/** Browser storage key used when the server has no Keyboard section. */
export const SINGLE_KEY_SHORTCUTS_STORAGE_KEY = 'qqq-single-key-shortcuts'

let enabled = true
const listeners = new Set<() => void>()

/**
 * Whether single-key shortcuts may fire right now (read by key handlers at event time).
 *
 * @returns `true` unless the user turned them off.
 */
export function singleKeyShortcutsEnabled(): boolean {
  return enabled
}

/**
 * Sets the effective value (from the server section, or the browser fallback).
 *
 * @param value - Whether single-key shortcuts are on.
 */
export function setSingleKeyShortcutsEnabled(value: boolean): void {
  if (value === enabled) return
  enabled = value
  listeners.forEach((listener) => listener())
}

/**
 * The browser's stored choice, used when the server has no Keyboard section.
 *
 * @returns The stored value, or `true` when none is stored or storage is unavailable.
 */
export function readLocalSingleKeyShortcuts(): boolean {
  try {
    return window.localStorage.getItem(SINGLE_KEY_SHORTCUTS_STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

/**
 * Stores the browser fallback choice and applies it.
 *
 * @param value - Whether single-key shortcuts are on.
 */
export function writeLocalSingleKeyShortcuts(value: boolean): void {
  try {
    if (value) window.localStorage.removeItem(SINGLE_KEY_SHORTCUTS_STORAGE_KEY)
    else window.localStorage.setItem(SINGLE_KEY_SHORTCUTS_STORAGE_KEY, 'off')
  } catch {
    // storage blocked: the choice lasts for this page only
  }
  setSingleKeyShortcutsEnabled(value)
}

/**
 * Subscribes a component to the setting (to show the right shortcut hints).
 *
 * @returns Whether single-key shortcuts are on.
 */
export function useSingleKeyShortcutsEnabled(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    () => enabled,
    () => true
  )
}
