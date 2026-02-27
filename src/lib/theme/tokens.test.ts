// Tests for theme tokens

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { QQQ_THEME_TOKENS, injectThemeTokens } from './tokens'

describe('QQQ_THEME_TOKENS', () => {
  it('exports expected token keys', () => {
    expect(QQQ_THEME_TOKENS['--qqq-primary-color']).toBe('#2563eb')
    expect(QQQ_THEME_TOKENS['--qqq-error-color']).toBe('#dc2626')
    expect(QQQ_THEME_TOKENS['--qqq-sidebar-width']).toBe('256px')
    expect(QQQ_THEME_TOKENS['--qqq-header-height']).toBe('80px')
  })

  it('has all essential token categories', () => {
    const keys = Object.keys(QQQ_THEME_TOKENS)
    // Brand colors
    expect(keys.some((k) => k.includes('primary'))).toBe(true)
    // Sidebar
    expect(keys.some((k) => k.includes('sidebar'))).toBe(true)
    // Typography
    expect(keys.some((k) => k.includes('font'))).toBe(true)
    // Z-index
    expect(keys.some((k) => k.includes('z-'))).toBe(true)
    // Shadows
    expect(keys.some((k) => k.includes('shadow'))).toBe(true)
    // Border radius
    expect(keys.some((k) => k.includes('radius'))).toBe(true)
  })
})

describe('injectThemeTokens', () => {
  let setPropertySpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setPropertySpy = vi.fn()
    Object.defineProperty(document.documentElement, 'style', {
      value: { setProperty: setPropertySpy },
      writable: true,
    })
  })

  it('sets CSS custom properties on :root', () => {
    injectThemeTokens({ '--qqq-primary-color': '#ff0000' })
    expect(setPropertySpy).toHaveBeenCalledWith('--qqq-primary-color', '#ff0000')
  })

  it('uses default tokens when called with no args', () => {
    injectThemeTokens()
    expect(setPropertySpy).toHaveBeenCalled()
    const calls = setPropertySpy.mock.calls.map(([k]: [string]) => k)
    expect(calls).toContain('--qqq-primary-color')
  })

  it('applies all tokens in the defaults', () => {
    injectThemeTokens()
    const totalTokens = Object.keys(QQQ_THEME_TOKENS).length
    expect(setPropertySpy).toHaveBeenCalledTimes(totalTokens)
  })
})
