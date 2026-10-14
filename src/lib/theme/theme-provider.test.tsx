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

// Tests for ThemeProvider

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import { themeScript } from './theme-script'
import { ThemeProvider, useTheme } from './theme-provider'

function TestConsumer() {
  const { isDarkMode, toggleDarkMode, theme, setTheme, setDarkMode } = useTheme()
  return (
    <div>
      <span data-testid="dark-mode">{String(isDarkMode)}</span>
      <span data-testid="theme">{theme?.primaryColor ?? 'none'}</span>
      <button onClick={() => setDarkMode(null)}>System</button>
      <button onClick={toggleDarkMode}>Toggle Dark</button>
      <button onClick={() => setTheme({ primaryColor: '#ff0000' })}>
        Set Theme
      </button>
    </div>
  )
}

describe('ThemeProvider', () => {
  const listeners = new Set<() => void>()
  const media = {
    matches: false,
    addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
  }
  /** Simulates a matchMedia change with the updated OS preference. */
  function changeSystem(dark: boolean) {
    media.matches = dark
    listeners.forEach((listener) => listener())
  }
  afterEach(() => vi.unstubAllGlobals())
  beforeEach(() => {
    localStorage.clear()
    listeners.clear()
    media.matches = false
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(media))
    document.documentElement.classList.remove('dark')
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.removeProperty('--color-primary')
  })

  it('should provide default light mode', () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    )

    expect(screen.getByTestId('dark-mode')).toHaveTextContent('false')
  })

  it('follows OS changes and removes the listener on unmount', () => {
    media.matches = true
    const view = render(<ThemeProvider><TestConsumer /></ThemeProvider>)
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    act(() => changeSystem(false))
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    act(() => changeSystem(true))
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    view.unmount()
    expect(listeners.size).toBe(0)
  })

  it.each([true, false])('keeps explicit %s over OS changes, then returns to System', async (dark) => {
    localStorage.setItem('qqq-dark-mode', String(dark))
    media.matches = !dark
    render(<ThemeProvider><TestConsumer /></ThemeProvider>)
    expect(screen.getByTestId('dark-mode')).toHaveTextContent(String(dark))
    act(() => changeSystem(dark))
    act(() => changeSystem(!dark))
    expect(screen.getByTestId('dark-mode')).toHaveTextContent(String(dark))
    await userEvent.setup().click(screen.getByText('System'))
    expect(localStorage.getItem('qqq-dark-mode')).toBeNull()
    expect(screen.getByTestId('dark-mode')).toHaveTextContent(String(!dark))
  })

  it('syncs changes and clearing from another tab', () => {
    media.matches = true
    render(<ThemeProvider><TestConsumer /></ThemeProvider>)
    act(() => {
      localStorage.setItem('qqq-dark-mode', 'false')
      window.dispatchEvent(new StorageEvent('storage', { key: 'qqq-dark-mode' }))
    })
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    act(() => {
      localStorage.removeItem('qqq-dark-mode')
      window.dispatchEvent(new StorageEvent('storage', { key: 'qqq-dark-mode' }))
    })
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  })

  it.each([
    [null, true, 'dark'], [null, false, 'light'],
    ['true', false, 'dark'], ['false', true, 'light'],
  ])('initializes before hydration with stored %s and OS %s', (stored, osDark, expected) => {
    if (stored !== null) localStorage.setItem('qqq-dark-mode', String(stored))
    media.matches = Boolean(osDark)
    new Function(themeScript)()
    expect(document.documentElement).toHaveAttribute('data-theme', expected)
    expect(document.documentElement.classList.contains('dark')).toBe(expected === 'dark')
    render(<ThemeProvider><TestConsumer /></ThemeProvider>)
    expect(document.documentElement).toHaveAttribute('data-theme', expected)
  })

  it('supports browsers without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined)
    new Function(themeScript)()
    render(<ThemeProvider><TestConsumer /></ThemeProvider>)
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  })

  it('should toggle dark mode', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    )

    await user.click(screen.getByText('Toggle Dark'))
    expect(screen.getByTestId('dark-mode')).toHaveTextContent('true')
  })

  it('should persist dark mode to localStorage', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    )

    await user.click(screen.getByText('Toggle Dark'))
    expect(localStorage.getItem('qqq-dark-mode')).toBe('true')
  })

  it('should inject CSS variables when theme is set', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    )

    await user.click(screen.getByText('Set Theme'))
    expect(screen.getByTestId('theme')).toHaveTextContent('#ff0000')

    // CSS variable should be injected
    const root = document.documentElement
    expect(root.style.getPropertyValue('--color-primary')).toBe('#ff0000')
  })

  it('should apply dark class to documentElement when dark mode is on', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    )

    await user.click(screen.getByText('Toggle Dark'))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('marks the body themed while a theme is applied and keeps the UI light', async () => {
    const user = userEvent.setup()
    localStorage.setItem('qqq-dark-mode', 'true')
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    )
    expect(screen.getByTestId('dark-mode')).toHaveTextContent('true')
    expect(document.body.classList.contains('qqq-themed')).toBe(false)

    await user.click(screen.getByText('Set Theme'))
    expect(document.body.classList.contains('qqq-themed')).toBe(true)
    expect(screen.getByTestId('dark-mode')).toHaveTextContent('false')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.style.getPropertyValue('--qqq-primary-color')).toBe('#ff0000')
  })

  it('removes the theme when it is cleared', async () => {
    const user = userEvent.setup()
    function Clearer() {
      const { setTheme } = useTheme()
      return <button onClick={() => setTheme(null)}>Clear Theme</button>
    }
    render(
      <ThemeProvider>
        <TestConsumer />
        <Clearer />
      </ThemeProvider>
    )
    await user.click(screen.getByText('Set Theme'))
    expect(document.getElementById('qqq-theme')).not.toBeNull()
    await user.click(screen.getByText('Clear Theme'))
    expect(document.body.classList.contains('qqq-themed')).toBe(false)
    expect(document.getElementById('qqq-theme')).toBeNull()
    expect(document.documentElement.style.getPropertyValue('--qqq-primary-color')).toBe('')
    expect(screen.getByTestId('theme')).toHaveTextContent('none')
  })

  it('should throw when useTheme is used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      render(<TestConsumer />)
    }).toThrow('useTheme must be used within ThemeProvider')

    consoleSpy.mockRestore()
  })
})
