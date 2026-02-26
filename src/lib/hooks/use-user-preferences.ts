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
