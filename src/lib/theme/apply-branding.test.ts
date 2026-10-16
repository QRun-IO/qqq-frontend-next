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

// Tests for applying branding before and after sign-in (QRun-IO/qqq#703)

import { afterEach, describe, expect, it } from 'vitest'

import { applyBrandingTheme, contrastRatio, isSafeAccentColor, isSafeImageSource, linkTextColors } from './apply-branding'

afterEach(() => {
  document.documentElement.removeAttribute('style')
  document.head.innerHTML = ''
})

describe('apply-branding', () => {
  it('accepts same-origin paths, http(s) URLs and inline images only', () => {
    expect(isSafeImageSource('/samples-logo.png')).toBe(true)
    expect(isSafeImageSource('images/logo.svg')).toBe(true)
    expect(isSafeImageSource('https://cdn.example.test/logo.png')).toBe(true)
    expect(isSafeImageSource('data:image/png;base64,AAAA')).toBe(true)
    expect(isSafeImageSource('javascript:alert(1)')).toBe(false)
    expect(isSafeImageSource('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isSafeImageSource('  ')).toBe(false)
    expect(isSafeImageSource(undefined)).toBe(false)
  })

  it('accepts CSS color formats only', () => {
    expect(isSafeAccentColor('#1d4ed8')).toBe(true)
    expect(isSafeAccentColor('rgb(29, 78, 216)')).toBe(true)
    expect(isSafeAccentColor('red; background: url(x)')).toBe(false)
    expect(isSafeAccentColor(undefined)).toBe(false)
  })

  it('sets the accent properties and the favicon', () => {
    document.head.innerHTML = '<link rel="icon" href="/favicon.ico"><link rel="apple-touch-icon" href="/apple.png">'
    expect(applyBrandingTheme({ accentColor: '#1d4ed8', accentColorLight: '#dbeafe', icon: '/kr-icon.png' })).toBe('#1d4ed8')
    const style = document.documentElement.style
    for (const property of ['--qqq-accent-color', '--color-primary', '--primary', '--ring', '--qqq-sidebar-active-bg']) {
      expect(style.getPropertyValue(property)).toBe('#1d4ed8')
    }
    expect(style.getPropertyValue('--qqq-accent-color-light')).toBe('#dbeafe')
    expect(document.querySelector<HTMLLinkElement>("link[rel='icon']")?.getAttribute('href')).toBe('/kr-icon.png')
    expect(document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']")?.getAttribute('href')).toBe('/kr-icon.png')
  })

  it('ignores unsafe or missing values', () => {
    document.head.innerHTML = '<link rel="icon" href="/favicon.ico">'
    expect(applyBrandingTheme({ accentColor: 'expression(alert(1))', icon: 'javascript:alert(1)' })).toBeUndefined()
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('')
    expect(document.querySelector<HTMLLinkElement>("link[rel='icon']")?.getAttribute('href')).toBe('/favicon.ico')
    expect(applyBrandingTheme(undefined)).toBeUndefined()
  })

  describe('link text colors', () => {
    const hex = (color: string) => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))
    const LIGHT_SURFACES = ['#ffffff', '#f0f2f6']
    const DARK_SURFACES = ['#181a24', '#1e2130']

    it.each(['#059669', '#6366f1', '#34d399', '#facc15', '#0062ff', '#ffffff', '#000000'])('reaches 4.5:1 in both themes for the accent %s', (accent) => {
      const link = linkTextColors(accent)!
      for (const surface of LIGHT_SURFACES) expect(contrastRatio(hex(link.light), hex(surface))).toBeGreaterThanOrEqual(4.5)
      for (const surface of DARK_SURFACES) expect(contrastRatio(hex(link.dark), hex(surface))).toBeGreaterThanOrEqual(4.5)
    })

    it('keeps an accent that is already readable', () => {
      expect(linkTextColors('#1d4ed8')).toEqual({ light: '#1d4ed8', dark: expect.any(String) })
    })

    it('reads rgb() and short hex accents, and skips formats it cannot parse', () => {
      expect(linkTextColors('rgb(5, 150, 105)')).toEqual(linkTextColors('#059669'))
      expect(linkTextColors('#0a9')).toEqual(linkTextColors('#00aa99'))
      expect(linkTextColors('hsl(160, 94%, 30%)')).toBeNull()
    })

    it('sets the derived colors that --color-link reads', () => {
      applyBrandingTheme({ accentColor: '#059669' })
      const style = document.documentElement.style
      expect(style.getPropertyValue('--color-primary')).toBe('#059669')
      expect(style.getPropertyValue('--qqq-link-text-light')).toBe(linkTextColors('#059669')!.light)
      expect(style.getPropertyValue('--qqq-link-text-dark')).toBe(linkTextColors('#059669')!.dark)
      expect(style.getPropertyValue('--qqq-link-text-light')).not.toBe('#059669')
    })
  })
})
