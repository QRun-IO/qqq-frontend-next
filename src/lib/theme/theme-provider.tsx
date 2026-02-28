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

/** ThemeProvider — dynamic CSS custom-property injection from QThemeMetaData with light/dark mode toggle */
'use client'

// Theme provider — dynamic CSS variable injection from QThemeMetaData
// Supports light/dark mode toggle

import React, { createContext, type ReactNode, useContext, useEffect, useState } from 'react'

import type { QThemeMetaData } from '@/types'

/**
 * Shape of the value provided by {@link ThemeContext}.
 *
 * Consumers should use the {@link useTheme} hook rather than reading the
 * context directly.
 */
export interface ThemeContextType {
  /** The active QQQ theme metadata, or `null` before it has been loaded. */
  theme: QThemeMetaData | null
  /** Replaces the active theme and triggers CSS variable re-injection. */
  setTheme: (theme: QThemeMetaData) => void
  /** Whether dark mode is currently active. */
  isDarkMode: boolean
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
 * Provider component that manages the QQQ visual theme and dark-mode state.
 *
 * On mount it reads the user's dark-mode preference from `localStorage`,
 * falling back to the OS `prefers-color-scheme` media query. Whenever the
 * active theme or dark-mode flag changes it injects the corresponding CSS
 * custom properties (`--color-primary`, `--qqq-accent-color`, etc.) onto
 * `document.documentElement`, which makes them available to all Tailwind and
 * shadcn/ui components via CSS cascade.
 *
 * @param children - The component subtree that needs access to the theme context.
 * @param initialTheme - Optional theme metadata to pre-populate before the
 *   backend metadata is fetched (useful for SSR / first paint).
 */
export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: ReactNode
  initialTheme?: QThemeMetaData
}) {
  const [theme, setTheme] = useState<QThemeMetaData | null>(initialTheme ?? null)
  const [isDarkMode, setIsDarkMode] = useState(false)

  // Initialize dark mode from localStorage or system preference
  useEffect(() => {
    const stored = localStorage.getItem(DARK_MODE_KEY)
    if (stored !== null) {
      setIsDarkMode(stored === 'true')
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setIsDarkMode(prefersDark)
    }
  }, [])

  // Inject CSS variables when theme or dark mode changes
  useEffect(() => {
    const root = document.documentElement

    // Apply dark mode class
    if (isDarkMode) {
      root.classList.add('dark')
      root.setAttribute('data-theme', 'dark')
    } else {
      root.classList.remove('dark')
      root.setAttribute('data-theme', 'light')
    }

    // Apply theme tokens from backend metadata
    if (theme) {
      if (theme.primaryColor) {
        root.style.setProperty('--color-primary', theme.primaryColor)
        root.style.setProperty('--qqq-primary-color', theme.primaryColor)
        root.style.setProperty('--primary', theme.primaryColor)
        root.style.setProperty('--ring', theme.primaryColor)
      }
      if (theme.accentColor) {
        root.style.setProperty('--color-accent', theme.accentColor)
        root.style.setProperty('--qqq-accent-color', theme.accentColor)
        root.style.setProperty('--qqq-sidebar-active-bg', theme.accentColor)
      }

      // Apply any custom tokens
      if (theme.customTokens) {
        for (const [key, value] of Object.entries(theme.customTokens)) {
          root.style.setProperty(`--${key}`, value)
        }
      }
    }
  }, [theme, isDarkMode])

  /**
   * Toggles the dark-mode flag and persists the new value to `localStorage`.
   *
   * The updated flag triggers the CSS-variable injection effect, which adds or
   * removes the `dark` class and `data-theme` attribute on `<html>`.
   */
  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const next = !prev
      localStorage.setItem(DARK_MODE_KEY, String(next))
      return next
    })
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        isDarkMode,
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
