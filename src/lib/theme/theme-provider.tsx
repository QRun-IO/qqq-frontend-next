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
 * @file ThemeProvider — the application theme (MaterialDashboardThemeMetaData, QRun-IO/qqq#719)
 * and the light/dark mode.
 */
'use client'

import React, { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react'

import type { QThemeMetaData } from '@/types'
import { applyMaterialTheme } from './material-theme'

/**
 * Shape of the value provided by {@link ThemeContext}.
 *
 * Consumers should use the {@link useTheme} hook rather than reading the
 * context directly.
 */
export interface ThemeContextType {
  /** The application theme from metadata, or `null` when the application defines none (or before sign-in). */
  theme: QThemeMetaData | null
  /** Replaces the application theme (null removes it) and re-applies it to the document. */
  setTheme: (theme: QThemeMetaData | null) => void
  /** Whether dark mode is currently active (never while an application theme is applied). */
  isDarkMode: boolean
  /** Saved choice (null follows the OS), including when an application theme overrides it. */
  darkModePreference: boolean | null
  /** Saves an appearance choice; null removes the override and follows the OS. */
  setDarkMode: (dark: boolean | null) => void
  /**
   * Toggles between light and dark mode, persisting the preference in
   * `localStorage` under the key {@link DARK_MODE_KEY}.
   */
  toggleDarkMode: () => void
}

/**
 * React context that holds the current theme state.
 *
 * Prefer using the {@link useTheme} hook to consume this context.
 */
export const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

/**
 * `localStorage` key used to persist the user's dark-mode preference across
 * page loads and sessions.
 */
const DARK_MODE_KEY = 'qqq-dark-mode'

/**
 * Provider component that manages the application theme and dark-mode state.
 *
 * On mount it reads an explicit dark-mode preference from `localStorage`,
 * defaulting to the OS preference and following its changes. The application
 * theme (set by the dashboard layout from v1 metadata) is applied with
 * {@link applyMaterialTheme}; while one is present the UI stays light, because
 * an application's colors are designed for the light look (the Material
 * Dashboard has no dark mode either).
 *
 * @param props - Component props.
 * @param props.children - The component subtree that needs access to the theme context.
 * @param props.initialTheme - Optional theme to apply before metadata loads.
 * @returns The rendered theme context provider wrapping the component tree.
 */
export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: ReactNode
  initialTheme?: QThemeMetaData
}) {
  const [theme, setThemeState] = useState<QThemeMetaData | null>(initialTheme ?? null)
  const [preference, setPreference] = useState<boolean | null>(null)
  const [systemDark, setSystemDark] = useState(false)
  const [ready, setReady] = useState(false)
  const prefersDark = preference ?? systemDark
  const isDarkMode = prefersDark && !theme

  // Read browser preferences after hydration, leaving the early theme intact until ready.
  useEffect(() => {
    const media = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : undefined
    const syncPreference = () => {
      try {
        const stored = window.localStorage.getItem(DARK_MODE_KEY)
        setPreference(stored === null ? null : stored === 'true')
      } catch {
        setPreference(null)
      }
    }
    const onSystemChange = () => setSystemDark(media?.matches ?? false)
    const onStorage = (event: StorageEvent) => {
      if (event.key === DARK_MODE_KEY || event.key === null) syncPreference()
    }
    syncPreference()
    onSystemChange()
    setReady(true)
    media?.addEventListener('change', onSystemChange)
    window.addEventListener('storage', onStorage)
    return () => {
      media?.removeEventListener('change', onSystemChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  // Apply the dark class when the mode changes
  useEffect(() => {
    if (!ready) return
    const root = document.documentElement
    root.classList.toggle('dark', isDarkMode)
    root.setAttribute('data-theme', isDarkMode ? 'dark' : 'light')
  }, [isDarkMode, ready])

  // Apply the application theme; the cleanup removes it again (sign-out, theme change)
  useEffect(() => applyMaterialTheme(theme), [theme])

  const setTheme = useCallback((next: QThemeMetaData | null) => setThemeState(next), [])

  const setDarkMode = useCallback((dark: boolean | null) => {
    setPreference(dark)
    try {
      if (dark === null) window.localStorage.removeItem(DARK_MODE_KEY)
      else window.localStorage.setItem(DARK_MODE_KEY, String(dark))
    } catch {
      // Keep the choice for this mount when browser storage is unavailable.
    }
  }, [])

  /**
   * Toggles the saved preference, including when an application theme overrides it.
   * @returns Nothing.
   */
  const toggleDarkMode = () => setDarkMode(!prefersDark)

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        isDarkMode,
        darkModePreference: preference,
        setDarkMode,
        toggleDarkMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

/**
 * Returns the current theme context from the nearest {@link ThemeProvider}.
 *
 * Must be called inside a component that is a descendant of
 * {@link ThemeProvider}. Throws at runtime if no provider is found.
 *
 * @returns The current {@link ThemeContextType} value, providing `theme`,
 *   `setTheme`, `isDarkMode`, and `toggleDarkMode`.
 * @throws {Error} When called outside of a {@link ThemeProvider} subtree.
 */
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
