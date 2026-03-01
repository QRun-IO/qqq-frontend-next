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
 * @file use-local-storage — typed localStorage hook with cross-tab sync and SSR safety.
 */
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Manages a single localStorage key as React state with full type safety.
 *
 * Features:
 * - SSR-safe: returns `initialValue` during server-side rendering.
 * - Cross-tab sync: listens to `storage` events so all open tabs stay in sync.
 * - Stable setter reference: the setter is memoized per `key` and accepts a
 *   value or an updater function (same API as `useState`).
 * - Stable remover reference: `removeValue` always resets to the original
 *   `initialValue` even if the caller passes an inline object literal.
 *
 * @template T - The type of the value stored in localStorage (must be JSON-serializable).
 * @param key - The localStorage key to read from and write to. Changes to this key across
 *   browser tabs are picked up via `storage` events so all open tabs stay in sync.
 *   Use a stable, namespaced string (e.g. `qqq-{tableName}-density`) to avoid collisions.
 * @param initialValue - Fallback value used when the key is absent, on SSR, or when
 *   JSON.parse throws (e.g. corrupted entry). Pass a stable reference (or use `useRef`)
 *   to avoid the `removeValue` setter recreating on every render.
 * @returns `[storedValue, setValue, removeValue]`:
 *   1. `storedValue: T` — current stored value, or `initialValue` during SSR or on read error.
 *   2. `setValue: (value: T | ((prev: T) => T)) => void` — setState-like setter that persists
 *      to localStorage synchronously and updates React state; logs a warning (does not throw)
 *      on quota exceeded or other write errors.
 *   3. `removeValue: () => void` — removes the key from localStorage and resets state to the
 *      original `initialValue`; logs a warning (does not throw) on remove errors.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  // MED-4: capture initialValue in a ref so removeValue doesn't re-create when
  // callers pass an inline object literal (new reference on every render)
  const initialValueRef = useRef(initialValue)

  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue
    try {
      const item = localStorage.getItem(key)
      return item !== null ? (JSON.parse(item) as T) : initialValue
    } catch {
      return initialValue
    }
  })

  /**
   * Persists a new value to localStorage and updates React state.
   *
   * Accepts either a direct value or an updater function, mirroring the `useState` setter API.
   * Logs a warning (but does not throw) if the write fails (e.g. storage quota exceeded).
   *
   * @param value - The new value, or a function that receives the previous value and returns the next.
   */
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const next = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value
        try {
          localStorage.setItem(key, JSON.stringify(next))
        } catch {
          console.warn(`[useLocalStorage] Failed to persist key: ${key}`)
        }
        return next
      })
    },
    [key]
  )

  /**
   * Removes the key from localStorage and resets state to the original `initialValue`.
   *
   * Logs a warning (but does not throw) if the removal fails.
   */
  const removeValue = useCallback(() => {
    setStoredValue(initialValueRef.current)
    try {
      localStorage.removeItem(key)
    } catch {
      console.warn(`[useLocalStorage] Failed to remove key: ${key}`)
    }
  }, [key])

  // Sync with storage changes from other tabs
  useEffect(() => {
    /**
     * Handles the browser `storage` event to keep state in sync across tabs.
     *
     * @param e - The StorageEvent fired when another tab writes to localStorage.
     */
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(JSON.parse(e.newValue) as T)
        } catch {
          // Ignore
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [key])

  return [storedValue, setValue, removeValue]
}
