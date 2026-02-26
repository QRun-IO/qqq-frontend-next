// Tests for ThemeProvider

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import { ThemeProvider, useTheme } from './theme-provider'

function TestConsumer() {
  const { isDarkMode, toggleDarkMode, theme, setTheme } = useTheme()
  return (
    <div>
      <span data-testid="dark-mode">{String(isDarkMode)}</span>
      <span data-testid="theme">{theme?.primaryColor ?? 'none'}</span>
      <button onClick={toggleDarkMode}>Toggle Dark</button>
      <button onClick={() => setTheme({ primaryColor: '#ff0000', accentColor: '#00ff00' })}>
        Set Theme
      </button>
    </div>
  )
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear()
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

  it('should throw when useTheme is used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      render(<TestConsumer />)
    }).toThrow('useTheme must be used within ThemeProvider')

    consoleSpy.mockRestore()
  })
})
