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
 * @file useUserPreferences — manages global user preferences stored in localStorage.
 */
'use client'

import { useLocalStorage } from './use-local-storage'

/**
 * User-configurable display preferences persisted to localStorage.
 */
export interface UserPreferences {
  // Table / query screen defaults
  /** Default number of rows per page for table views. */
  tableDefaultPageSize: 10 | 25 | 50 | 100
  /** Default row density for the data grid. */
  tableDefaultDensity: 'compact' | 'standard' | 'comfortable'
  /** Default view mode (grid or card layout) for table pages. */
  tableDefaultViewMode: 'grid' | 'card'

  // Record screen defaults
  /** Default view mode (tabs or list) for record detail pages. */
  recordDefaultViewMode: 'tabs' | 'list'
}

const DEFAULT_PREFERENCES: UserPreferences = {
  tableDefaultPageSize: 25,
  tableDefaultDensity: 'standard',
  tableDefaultViewMode: 'grid',
  recordDefaultViewMode: 'tabs',
}

const STORAGE_KEY = 'qqq-user-preferences'

/**
 * Reads and writes global user display preferences from localStorage.
 *
 * Provides the current preferences, a typed setter for individual keys,
 * a reset function to restore all defaults, and the default values object.
 *
 * @returns `{ preferences, updatePreference, resetPreferences, defaults }`:
 *   - `preferences` — the current `UserPreferences` object (never undefined; falls back to
 *     `DEFAULT_PREFERENCES` when the localStorage key is absent or unparseable).
 *   - `updatePreference(key, value)` — updates a single typed preference key; persists
 *     immediately to localStorage via `useLocalStorage` and re-renders all consumers.
 *   - `resetPreferences()` — writes `DEFAULT_PREFERENCES` back to localStorage and
 *     re-renders all consumers; use for a "Reset to defaults" button.
 *   - `defaults` — the `DEFAULT_PREFERENCES` constant (useful for rendering default
 *     labels in settings UI without a separate import).
 */
export function useUserPreferences() {
  const [preferences, setPreferences] = useLocalStorage<UserPreferences>(
    STORAGE_KEY,
    DEFAULT_PREFERENCES
  )

  const updatePreference = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    setPreferences((prev) => ({ ...prev, [key]: value }))
  }

  const resetPreferences = () => {
    setPreferences(DEFAULT_PREFERENCES)
  }

  return {
    preferences,
    updatePreference,
    resetPreferences,
    defaults: DEFAULT_PREFERENCES,
  }
}
