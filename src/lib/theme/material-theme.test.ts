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

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { QInstance } from '@/types'
import {
  applyMaterialTheme, buildThemeStyle, buildThemedBaseCss, CUSTOM_CSS_STYLE_ID, parseMaterialTheme, readMaterialTheme,
  THEME_PROPERTY_KINDS, THEME_STYLE_ID, toKebabCase,
} from './material-theme'

afterEach(() => {
  applyMaterialTheme(null)
  document.documentElement.removeAttribute('style')
  vi.restoreAllMocks()
})

describe('parseMaterialTheme', () => {
  it('returns null without a theme object and a theme (possibly empty) with one', () => {
    expect(parseMaterialTheme(undefined)).toBeNull()
    expect(parseMaterialTheme(null)).toBeNull()
    expect(parseMaterialTheme([])).toBeNull()
    expect(parseMaterialTheme('x')).toBeNull()
    expect(parseMaterialTheme({})).toEqual({})
  })

  it('keeps valid values of every kind', () => {
    const theme = parseMaterialTheme({
      primaryColor: '#0f766e', surfaceColor: 'rgb(1, 2, 3)', textPrimary: 'white', preferInfoColorToPrimaryColor: false,
      fontFamily: '"Georgia", serif', fontSizeBase: '15px', fontWeightBold: 800, typographyH1FontSize: '2.5rem',
      typographyH1LineHeight: '1.1', typographyButtonTextTransform: 'NONE', typographyH2LetterSpacing: '-0.01em',
      borderRadiusScale: '1.5', borderRadiusCard: '3px', density: 'Compact', iconStyle: 'outlined',
      brandedHeaderEnabled: true, brandedHeaderLogoPath: '/logo.png', brandedHeaderTagline: 'Tagline', customCss: '@import url(x.css);',
    })
    expect(theme).toEqual({
      primaryColor: '#0f766e', surfaceColor: 'rgb(1, 2, 3)', textPrimary: 'white', preferInfoColorToPrimaryColor: false,
      fontFamily: '"Georgia", serif', fontSizeBase: '15px', fontWeightBold: 800, typographyH1FontSize: '2.5rem',
      typographyH1LineHeight: '1.1', typographyButtonTextTransform: 'none', typographyH2LetterSpacing: '-0.01em',
      borderRadiusScale: 1.5, borderRadiusCard: '3px', density: 'compact', iconStyle: 'outlined',
      brandedHeaderEnabled: true, brandedHeaderLogoPath: '/logo.png', brandedHeaderTagline: 'Tagline', customCss: '@import url(x.css);',
    })
  })

  it('drops values that could add CSS, and unknown properties', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const theme = parseMaterialTheme({
      primaryColor: 'red; } body { display: none',
      backgroundColor: 'url(https://example.com/x)',
      fontFamily: 'Arial; color: red',
      typographyH1FontSize: '2rem}',
      fontWeightBold: 'bold',
      brandedHeaderLogoPath: 'javascript:alert(1)',
      density: 'tiny',
      brandedHeaderEnabled: 'true',
      somethingElse: '#fff',
    })
    expect(theme).toEqual({})
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('primaryColor'))
  })

  it('reads the theme from v1 supplemental instance metadata', () => {
    const metaData = { supplementalInstanceMetaData: { materialDashboardTheme: { primaryColor: '#123456' } } } as unknown as QInstance
    expect(readMaterialTheme(metaData)).toEqual({ primaryColor: '#123456' })
    expect(readMaterialTheme({ supplementalInstanceMetaData: {} } as unknown as QInstance)).toBeNull()
    expect(readMaterialTheme(undefined)).toBeNull()
  })

  it('knows every Material theme property', () => {
    expect(Object.keys(THEME_PROPERTY_KINDS)).toHaveLength(111)
  })
})

describe('buildThemeStyle', () => {
  it('names the Material --qqq-* variables in kebab-case', () => {
    expect(toKebabCase('typographyH1FontSize')).toBe('typography-h1-font-size')
    expect(toKebabCase('sidebarBackgroundColor')).toBe('sidebar-background-color')
    const { variables } = buildThemeStyle({ sidebarBackgroundColor: '#111111', typographyBody2FontSize: '0.8rem', brandedHeaderEnabled: false })
    expect(variables['--qqq-sidebar-background-color']).toBe('#111111')
    expect(variables['--qqq-typography-body2-font-size']).toBe('0.8rem')
    expect(variables['--qqq-branded-header-enabled']).toBe('false')
    expect(variables['--qqq-branded-header-height']).toBe('0px')
  })

  it('maps the palette onto the Next tokens', () => {
    const { variables } = buildThemeStyle({
      primaryColor: '#0f766e', backgroundColor: '#fafaf9', surfaceColor: '#ffffff', textPrimary: '#1c1917',
      textSecondary: '#57534e', errorColor: '#b91c1c', successColor: '#15803d', borderColor: '#d6d3d1',
    })
    expect(variables).toMatchObject({
      '--color-primary': '#0f766e', '--color-ring': '#0f766e', '--qqq-primary-color': '#0f766e',
      '--color-background': '#fafaf9', '--color-card': '#ffffff', '--color-popover': '#ffffff',
      '--color-foreground': '#1c1917', '--color-muted-foreground': '#57534e', '--color-destructive': '#b91c1c',
      '--color-green-500': '#15803d', '--color-emerald-500': '#15803d',
      '--color-green-50': 'color-mix(in srgb, #15803d, white 92%)', '--color-green-700': 'color-mix(in srgb, #15803d, black 25%)',
      '--color-border': '#d6d3d1', '--color-input': 'var(--qqq-input-border-color, #d6d3d1)',
    })
    expect(variables['--color-red-500']).toBe('#b91c1c')
    expect(variables['--color-amber-500']).toBeUndefined()
  })

  it('changes only what the theme sets', () => {
    const { variables, css } = buildThemeStyle({ primaryColor: '#0f766e' })
    expect(Object.keys(variables).sort()).toEqual(['--color-primary', '--color-ring', '--primary', '--qqq-accent-color', '--qqq-branded-header-height', '--qqq-primary-color', '--qqq-sidebar-active-bg', '--ring'].sort())
    expect(css).toBe('')
  })

  it('applies typography to the variant elements, scoped to the themed body', () => {
    const { variables, css } = buildThemeStyle({
      fontFamily: 'Georgia, serif', headerFontFamily: 'Impact', monoFontFamily: 'Courier', fontSizeBase: '15px', fontWeightMedium: 650,
      typographyH1FontSize: '2.5rem', typographyH1FontWeight: 800, typographyCaptionTextTransform: 'uppercase', typographyButtonLetterSpacing: '0.1em',
    })
    expect(variables).toMatchObject({ '--font-sans': 'Georgia, serif', '--font-mono': 'Courier', '--font-weight-medium': '650', '--font-weight-semibold': '650' })
    expect(css).toContain('body.qqq-themed h1, body.qqq-themed h2, body.qqq-themed h3, body.qqq-themed h4, body.qqq-themed h5, body.qqq-themed h6 { font-family: Impact; }')
    expect(css).toContain('body.qqq-themed { font-size: 15px; }')
    expect(css).toContain('body.qqq-themed h1 { font-size: 2.5rem; font-weight: 800; }')
    expect(css).toContain('body.qqq-themed .text-xs { text-transform: uppercase; }')
    expect(css).toContain('letter-spacing: 0.1em;')
    expect(css).not.toContain('!important')
  })

  it('resolves radii as component, else global, else default times scale', () => {
    const global = buildThemeStyle({ borderRadiusGlobal: '4px', borderRadiusButton: '20px' })
    expect(global.variables['--radius-lg']).toBe('4px')
    expect(global.variables['--radius-xl']).toBe('4px')
    expect(global.css).toContain('border-radius: 20px;')
    const scaled = buildThemeStyle({ borderRadiusScale: 2 })
    expect(scaled.variables['--radius-md']).toBe('0.75rem')
    expect(scaled.variables['--radius-xl']).toBe('1.5rem')
    expect(buildThemeStyle({ borderRadiusScale: 1 }).variables['--radius-md']).toBeUndefined()
  })

  it('scales spacing with the density', () => {
    const compact = buildThemeStyle({ density: 'compact' })
    expect(compact.variables).toMatchObject({ '--qqq-spacing-base': '6px', '--qqq-spacing-small': '0.25rem' })
    expect(compact.css).toContain('--spacing: 0.1875rem;')
    expect(compact.css).toContain('body.qqq-themed #main-content { padding: 1.125rem; }')
    const normal = buildThemeStyle({ density: 'normal' })
    expect(normal.variables['--qqq-spacing-base']).toBe('8px')
    expect(normal.css).toBe('')
  })

  it('themes the navigation panel, the grid, dividers and card borders', () => {
    const { css } = buildThemeStyle({
      sidebarBackgroundColor: '#0b1f33', sidebarTextColor: '#e2e8f0', sidebarIconColor: '#94a3b8', sidebarSelectedBackgroundColor: '#f59e0b',
      sidebarSelectedTextColor: '#111827', sidebarHoverBackgroundColor: '#1e3a5f', sidebarDividerColor: '#334155',
      tableHeaderBackgroundColor: '#fef3c7', tableHeaderTextColor: '#78350f', tableRowHoverColor: '#fffbeb', tableRowSelectedColor: '#fde68a', tableBorderColor: '#fcd34d',
      dividerColor: '#a8a29e', cardBorderColor: '#78716c',
    })
    expect(css).toContain('body.qqq-themed [data-qqq-id="sidebar"] { background: #0b1f33; --color-sidebar: #0b1f33; color: #e2e8f0; --color-foreground: #e2e8f0; --color-muted-foreground: #e2e8f0; --color-accent: #1e3a5f; --color-border: #334155; }')
    expect(css).toContain('background-color: #f59e0b; color: #111827;')
    expect(css).toContain('body.qqq-themed table[role="grid"] thead tr, body.qqq-themed table[role="grid"] thead th { background-color: #fef3c7; }')
    expect(css).toContain('tbody tr:has(input[type="checkbox"]:checked)')
    expect(css).toContain('border-color: #fcd34d;')
    expect(css).toContain('body.qqq-themed hr, body.qqq-themed [role="separator"] { border-color: #a8a29e; background-color: #a8a29e; }')
    expect(css).toContain('body.qqq-themed .rounded-xl.border { border-color: #78716c; }')
  })
})

describe('buildThemedBaseCss', () => {
  it('prefers the info color by default and the primary color when the theme says so', () => {
    expect(buildThemedBaseCss({})).toContain(':root { --qqq-prefer-info-color-to-primary-color: 1; }')
    expect(buildThemedBaseCss({ preferInfoColorToPrimaryColor: true })).toContain('--qqq-prefer-info-color-to-primary-color: 1;')
    expect(buildThemedBaseCss({ preferInfoColorToPrimaryColor: false })).toContain('--qqq-prefer-info-color-to-primary-color: 0;')
    expect(buildThemedBaseCss({})).toContain('[data-qqq-id="button-save"]')
  })

  it('honors the component override variables with the Next values as fallbacks', () => {
    const css = buildThemedBaseCss({})
    expect(css).toContain('var(--qqq-stepper-inactive-color, var(--color-border))')
    expect(css).toContain('var(--qqq-tooltip-background-color, var(--color-card))')
    expect(css).toContain('var(--qqq-menu-hover-color, var(--color-accent))')
    expect(css).toContain('var(--qqq-switch-track-color, var(--color-muted))')
  })
})

describe('applyMaterialTheme', () => {
  it('adds the themed class, variables, rules and customCss, and removes them again', () => {
    const remove = applyMaterialTheme({ primaryColor: '#0f766e', tableHeaderBackgroundColor: '#fef3c7', customCss: '@import url("x.css"); .x { background: url(data:image/png;base64,AA==) }' })
    const root = document.documentElement
    expect(document.body.classList.contains('qqq-themed')).toBe(true)
    expect(root.style.getPropertyValue('--color-primary')).toBe('#0f766e')
    expect(document.getElementById(THEME_STYLE_ID)?.textContent).toContain('#fef3c7')
    const custom = document.getElementById(CUSTOM_CSS_STYLE_ID)
    expect(custom?.tagName).toBe('STYLE')
    // applied as written (Material parity); the Content-Security-Policy governs what it loads
    expect(custom?.textContent).toBe('@import url("x.css"); .x { background: url(data:image/png;base64,AA==) }')
    // customCss comes after the theme rules, so it wins over them
    expect(document.head.lastElementChild?.id).toBe(CUSTOM_CSS_STYLE_ID)

    remove()
    expect(document.body.classList.contains('qqq-themed')).toBe(false)
    expect(root.style.getPropertyValue('--color-primary')).toBe('')
    expect(document.getElementById(THEME_STYLE_ID)).toBeNull()
    expect(document.getElementById(CUSTOM_CSS_STYLE_ID)).toBeNull()
  })

  it('restores values set before the theme (such as the branding accent)', () => {
    document.documentElement.style.setProperty('--color-primary', '#1d4ed8')
    const remove = applyMaterialTheme({ primaryColor: '#0f766e' })
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#0f766e')
    remove()
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#1d4ed8')
  })

  it('leaves an unthemed document unthemed', () => {
    applyMaterialTheme(null)
    expect(document.body.classList.contains('qqq-themed')).toBe(false)
    expect(document.getElementById(THEME_STYLE_ID)).toBeNull()
  })
})
