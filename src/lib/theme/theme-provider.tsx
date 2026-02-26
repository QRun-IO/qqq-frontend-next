'use client'

// Theme provider — dynamic CSS variable injection from QThemeMetaData
// Supports light/dark mode toggle

import React, { createContext, type ReactNode, useContext, useEffect, useState } from 'react'

import type { QThemeMetaData } from '@/types'

export interface ThemeContextType {
  theme: QThemeMetaData | null
  setTheme: (theme: QThemeMetaData) => void
  isDarkMode: boolean
  toggleDarkMode: () => void
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const DARK_MODE_KEY = 'qqq-dark-mode'

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
      }
      if (theme.accentColor) {
        root.style.setProperty('--color-accent', theme.accentColor)
        root.style.setProperty('--qqq-accent-color', theme.accentColor)
      }

      // Apply any custom tokens
      if (theme.customTokens) {
        for (const [key, value] of Object.entries(theme.customTokens)) {
          root.style.setProperty(`--${key}`, value)
        }
      }
    }
  }, [theme, isDarkMode])

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

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
