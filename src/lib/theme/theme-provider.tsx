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
  /** Saved choice, including when an application theme overrides it. */
  darkModePreference: boolean
  /** Saves an explicit appearance choice for this browser and site. */
  setDarkMode: (dark: boolean) => void
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
 * defaulting to light as the Material Dashboard does. The application
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
  const [prefersDark, setPrefersDark] = useState(false)
  const isDarkMode = prefersDark && !theme

  // Material opens in light mode; the OS preference must not silently change the dashboard.
  useEffect(() => {
    const stored = localStorage.getItem(DARK_MODE_KEY)
    setPrefersDark(stored === 'true')
  }, [])

  // Apply the dark class when the mode changes
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', isDarkMode)
    root.setAttribute('data-theme', isDarkMode ? 'dark' : 'light')
  }, [isDarkMode])

  // Apply the application theme; the cleanup removes it again (sign-out, theme change)
  useEffect(() => applyMaterialTheme(theme), [theme])

  const setTheme = useCallback((next: QThemeMetaData | null) => setThemeState(next), [])

  const setDarkMode = useCallback((dark: boolean) => {
    setPrefersDark(dark)
    localStorage.setItem(DARK_MODE_KEY, String(dark))
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
        darkModePreference: prefersDark,
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
