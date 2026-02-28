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

'use client'

// useUserPreferences — manages global user preferences stored in localStorage

import { useLocalStorage } from './use-local-storage'

export interface UserPreferences {
  // Table / query screen defaults
  tableDefaultPageSize: 10 | 25 | 50 | 100
  tableDefaultDensity: 'compact' | 'standard' | 'comfortable'
  tableDefaultViewMode: 'grid' | 'card'

  // Record screen defaults
  recordDefaultViewMode: 'tabs' | 'list'
}

const DEFAULT_PREFERENCES: UserPreferences = {
  tableDefaultPageSize: 25,
  tableDefaultDensity: 'standard',
  tableDefaultViewMode: 'grid',
  recordDefaultViewMode: 'tabs',
}

const STORAGE_KEY = 'qqq-user-preferences'

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
