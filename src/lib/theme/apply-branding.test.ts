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

import { applyBrandingTheme, isSafeAccentColor, isSafeImageSource } from './apply-branding'

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
})
