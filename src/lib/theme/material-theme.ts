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
 * @file The application theme (the Material Dashboard's MaterialDashboardThemeMetaData,
 * QRun-IO/qqq#719): reading it from v1 metadata, validating every value, and mapping it
 * onto the Next tokens and the Material `--qqq-*` variable contract.
 *
 * Only the properties an application sets change the UI: an unset property keeps the Next
 * look (Material instead falls back to its own defaults, which are the Material look).
 * Values are validated per kind before they reach CSS, so a value can never add a rule.
 */

import type { QInstance, QThemeMetaData } from '@/types'

import { isSafeImageSource } from './apply-branding'

/** The kinds of theme values, each with its own validation. */
type ThemeValueKind = 'color' | 'length' | 'lineHeight' | 'weight' | 'font' | 'transform' | 'boolean' | 'density' | 'iconStyle' | 'image' | 'text' | 'css' | 'scale'

/** Material's typography variants, in the order of the theme metadata. */
export const TYPOGRAPHY_VARIANTS = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'Body1', 'Body2', 'Button', 'Caption'] as const

/** The components with their own radius in the theme, and each one's Material default (px). */
export const RADIUS_COMPONENTS = {
  Button: 8, Card: 12, Chip: 12, Dialog: 8, OutlinedInput: 6, LinearProgress: 6, MenuPaper: 6, PaperRounded: 12, PopoverPaper: 6, Tooltip: 6,
} as const

type RadiusComponent = keyof typeof RADIUS_COMPONENTS

/** Every theme property the UI reads, with its kind (the v1 allow-list mirrors this list). */
export const THEME_PROPERTY_KINDS: Record<keyof QThemeMetaData, ThemeValueKind> = {
  primaryColor: 'color', secondaryColor: 'color', backgroundColor: 'color', surfaceColor: 'color',
  textPrimary: 'color', textSecondary: 'color', errorColor: 'color', warningColor: 'color',
  successColor: 'color', infoColor: 'color', preferInfoColorToPrimaryColor: 'boolean',
  fontFamily: 'font', headerFontFamily: 'font', monoFontFamily: 'font', fontSizeBase: 'length',
  fontWeightLight: 'weight', fontWeightRegular: 'weight', fontWeightMedium: 'weight', fontWeightBold: 'weight',
  ...Object.fromEntries(TYPOGRAPHY_VARIANTS.flatMap((variant) => [
    [`typography${variant}FontSize`, 'length'],
    [`typography${variant}FontWeight`, 'weight'],
    [`typography${variant}LineHeight`, 'lineHeight'],
    [`typography${variant}LetterSpacing`, 'length'],
    [`typography${variant}TextTransform`, 'transform'],
  ])) as Record<`typography${(typeof TYPOGRAPHY_VARIANTS)[number]}${'FontSize' | 'FontWeight' | 'LineHeight' | 'LetterSpacing' | 'TextTransform'}`, ThemeValueKind>,
  borderRadiusGlobal: 'length', borderRadiusScale: 'scale',
  ...Object.fromEntries(Object.keys(RADIUS_COMPONENTS).map((component) => [`borderRadius${component}`, 'length'])) as Record<`borderRadius${RadiusComponent}`, ThemeValueKind>,
  density: 'density', logoPath: 'image', iconPath: 'image', faviconPath: 'image', customCss: 'css', iconStyle: 'iconStyle',
  brandedHeaderEnabled: 'boolean', brandedHeaderBackgroundColor: 'color', brandedHeaderTextColor: 'color',
  brandedHeaderLogoPath: 'image', brandedHeaderLogoAltText: 'text', brandedHeaderHeight: 'length', brandedHeaderTagline: 'text',
  appBarBackgroundColor: 'color', appBarTextColor: 'color',
  sidebarBackgroundColor: 'color', sidebarTextColor: 'color', sidebarIconColor: 'color', sidebarSelectedBackgroundColor: 'color',
  sidebarSelectedTextColor: 'color', sidebarHoverBackgroundColor: 'color', sidebarDividerColor: 'color',
  tableHeaderBackgroundColor: 'color', tableHeaderTextColor: 'color', tableRowHoverColor: 'color', tableRowSelectedColor: 'color', tableBorderColor: 'color',
  dividerColor: 'color', borderColor: 'color', cardBorderColor: 'color',
}

const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const COLOR_FUNCTION = /^(?:rgba?|hsla?)\(\s*[\d.\s,%/+-]+\)$/i
const NAMED_COLOR = /^[a-z]{3,24}$/i
const LENGTH = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em|%|vh|vw|pt|ch|ex)?$/i
const NUMBER = /^(?:\d+(?:\.\d+)?|\.\d+)$/
const FONT = /^[\w\s"',.-]{1,300}$/
const TRANSFORMS = new Set(['none', 'uppercase', 'lowercase', 'capitalize'])
const DENSITIES = new Set(['compact', 'normal', 'comfortable'])
const ICON_STYLES = new Set(['filled', 'outlined', 'rounded', 'sharp', 'two-tone'])

/**
 * Validates one theme value for its kind.
 *
 * @param kind - The value kind.
 * @param value - The raw value from metadata.
 * @returns The value to use, or undefined when it is not valid for the kind.
 */
function validValue(kind: ThemeValueKind, value: unknown): string | number | boolean | undefined {
  if (value === null || value === undefined) return undefined
  const text = typeof value === 'string' ? value.trim() : undefined
  switch (kind) {
    case 'color':
      return text && (HEX.test(text) || COLOR_FUNCTION.test(text) || NAMED_COLOR.test(text)) ? text : undefined
    case 'length':
      return text !== undefined && (LENGTH.test(text) || text === 'normal') ? text : undefined
    case 'lineHeight':
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value
      return text && (NUMBER.test(text) || LENGTH.test(text) || text === 'normal') ? text : undefined
    case 'weight': {
      const weight = typeof value === 'number' ? value : text && NUMBER.test(text) ? Number(text) : NaN
      return Number.isInteger(weight) && weight >= 1 && weight <= 1000 ? weight : undefined
    }
    case 'scale': {
      const scale = typeof value === 'number' ? value : text && NUMBER.test(text) ? Number(text) : NaN
      return Number.isFinite(scale) && scale >= 0 && scale <= 10 ? scale : undefined
    }
    case 'font':
      return text && FONT.test(text) ? text : undefined
    case 'transform':
      return text && TRANSFORMS.has(text.toLowerCase()) ? text.toLowerCase() : undefined
    case 'density':
      return text && DENSITIES.has(text.toLowerCase()) ? text.toLowerCase() : undefined
    case 'iconStyle':
      return text && ICON_STYLES.has(text.toLowerCase()) ? text.toLowerCase() : undefined
    case 'boolean':
      return typeof value === 'boolean' ? value : undefined
    case 'image':
      return text && isSafeImageSource(text) ? text : undefined
    case 'text':
      return text !== undefined && text.length <= 500 ? text : undefined
    case 'css':
      return typeof value === 'string' && value.length <= 200_000 ? value : undefined
  }
}

/**
 * Parses a theme object from metadata, keeping every valid value of a known property.
 *
 * @param raw - `supplementalInstanceMetaData.materialDashboardTheme` as received.
 * @returns The theme (possibly without properties), or null when there is no theme object.
 */
export function parseMaterialTheme(raw: unknown): QThemeMetaData | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const theme: Record<string, unknown> = {}
  const rejected: string[] = []
  for (const [property, kind] of Object.entries(THEME_PROPERTY_KINDS)) {
    const value = (raw as Record<string, unknown>)[property]
    if (value === undefined || value === null) continue
    const valid = validValue(kind, value)
    if (valid === undefined) rejected.push(property)
    else theme[property] = valid
  }
  if (rejected.length > 0) console.warn(`[Theme] Ignored invalid theme values: ${rejected.join(', ')}`)
  return theme as QThemeMetaData
}

/**
 * Reads the application theme from v1 instance metadata.
 *
 * @param metaData - The instance metadata.
 * @returns The theme, or null when the application defines none.
 */
export function readMaterialTheme(metaData: QInstance | undefined): QThemeMetaData | null {
  return parseMaterialTheme(metaData?.supplementalInstanceMetaData?.materialDashboardTheme)
}

/**
 * Material's camelCase to kebab-case conversion for `--qqq-*` variable names.
 *
 * @param name - A theme property name.
 * @returns The kebab-case name (`typographyH1FontSize` becomes `typography-h1-font-size`).
 */
export function toKebabCase(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/([0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

/** Material density spacing (px unit and the documented spacing variables). */
export const DENSITY_SPACING = {
  compact: { base: 6, small: '0.25rem', medium: '0.5rem', large: '0.75rem' },
  normal: { base: 8, small: '0.5rem', medium: '1rem', large: '1.5rem' },
  comfortable: { base: 10, small: '0.75rem', medium: '1.25rem', large: '2rem' },
} as const

/** Tailwind radius tokens and their defaults (rem), which the global radius and scale replace. */
const TAILWIND_RADII: Record<string, number> = { xs: 0.125, sm: 0.25, md: 0.375, lg: 0.5, xl: 0.75, '2xl': 1, '3xl': 1.5 }

/** Tailwind palettes that carry each status color in the Next components. */
const STATUS_PALETTES: Record<'successColor' | 'warningColor' | 'infoColor' | 'errorColor', string[]> = {
  successColor: ['green', 'emerald'],
  warningColor: ['yellow', 'amber', 'orange'],
  infoColor: ['blue', 'sky'],
  errorColor: ['red'],
}

/** How much of the status color each palette shade keeps (tints mix with white, shades with black). */
const SHADES: [number, string][] = [
  [50, 'white 92%'], [100, 'white 85%'], [200, 'white 70%'], [300, 'white 50%'], [400, 'white 25%'], [500, ''],
  [600, 'black 10%'], [700, 'black 25%'], [800, 'black 40%'], [900, 'black 55%'], [950, 'black 70%'],
]

/** Selectors of the Next elements that match each Material component with its own radius. */
const RADIUS_SELECTORS: Record<RadiusComponent, string> = {
  Button: 'button:not([role="switch"]):not([role="checkbox"]):not([role="radio"]):not([role="tab"]):not(.rounded-full), a[data-qqq-id^="button-"]',
  Card: '.rounded-xl.border',
  Chip: '[data-qqq-id^="chip-"], [data-qqq-id*="-chip-"]',
  Dialog: '[role="dialog"]:not([data-qqq-id="sidebar-mobile-drawer"]):not([data-radix-popper-content-wrapper] > *), [role="alertdialog"]',
  OutlinedInput: 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="hidden"]), select, textarea',
  LinearProgress: '[role="progressbar"], [role="progressbar"] > *',
  MenuPaper: '[role="menu"], [role="listbox"]',
  PaperRounded: '.rounded-lg.border',
  PopoverPaper: '[data-radix-popper-content-wrapper] > [data-state="open"]:not([role="menu"])',
  Tooltip: '[data-radix-popper-content-wrapper] > [data-state$="-open"]',
}

/** Element selectors for each Material typography variant in the Next markup. */
const TYPOGRAPHY_SELECTORS: Record<(typeof TYPOGRAPHY_VARIANTS)[number], string> = {
  H1: 'h1', H2: 'h2', H3: 'h3', H4: 'h4', H5: 'h5', H6: 'h6',
  Body1: '.text-base',
  Body2: '.text-sm',
  Button: 'button, [role="button"], a[data-qqq-id^="button-"]',
  Caption: '.text-xs',
}

/** The navigation panel (desktop and phone drawer). */
const SIDEBAR = '[data-qqq-id="sidebar"]'
/** The active navigation entry: Material's class hook, or the current page link and its row. */
const SIDEBAR_ACTIVE = `${SIDEBAR} :is(.qqq-sidebar-active, [aria-current="page"], div:has(> [aria-current="page"]))`
/** The query grid. */
const GRID = 'table[role="grid"]'

/** The generated variables and style rules for one theme. */
export interface ThemeStyle {
  /** Custom properties set on the document element (`--qqq-*` contract and Next tokens). */
  variables: Record<string, string>
  /** Style rules for the islands and components (scoped to `body.qqq-themed`). */
  css: string
}

/**
 * A palette shade of a status color.
 *
 * @param color - The status color.
 * @param mix - The color it mixes with and how much of it, or '' for the color itself.
 * @returns A CSS color.
 */
function shade(color: string, mix: string): string {
  return mix ? `color-mix(in srgb, ${color}, ${mix})` : color
}

/**
 * Splits a selector list on its top-level commas (not those inside `:is(...)` or `:not(...)`).
 *
 * @param selector - A selector list.
 * @returns The trimmed selectors.
 */
function splitSelectors(selector: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const character of selector) {
    if (character === '(') depth++
    if (character === ')') depth--
    if (character === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
    } else {
      current += character
    }
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

/**
 * The px value of a theme length, for Material's radius arithmetic.
 *
 * @param value - A length such as `8px`.
 * @returns The number, or null when the value is not a plain number of px.
 */
function parsePx(value: string | undefined): number | null {
  if (!value) return null
  const parsed = parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * Builds the variables and rules for a theme. Pure: callers apply the result.
 *
 * @param theme - A parsed theme ({@link parseMaterialTheme}).
 * @returns The variables and the style sheet text.
 */
export function buildThemeStyle(theme: QThemeMetaData): ThemeStyle {
  const variables: Record<string, string> = {}
  const rules: string[] = []
  const themed = 'body.qqq-themed'
  const set = (names: string[], value: string | number | undefined) => {
    if (value === undefined) return
    for (const name of names) variables[name] = String(value)
  }
  // Unlayered rules outrank the Tailwind utility layer without !important, so application
  // customCss (applied after them) still overrides them with ordinary rules.
  const rule = (selector: string, declarations: Record<string, string | number | undefined>) => {
    const body = Object.entries(declarations).filter(([, value]) => value !== undefined).map(([name, value]) => `${name}: ${value};`)
    if (body.length === 0) return
    const scoped = splitSelectors(selector).map((part) => (part === 'body' ? themed : `${themed} ${part}`)).join(', ')
    rules.push(`${scoped} { ${body.join(' ')} }`)
  }

  // The Material --qqq-* contract: every set property, by Material's kebab-case name
  for (const [property, value] of Object.entries(theme)) {
    if (property === 'customCss' || property === 'preferInfoColorToPrimaryColor' || value === undefined) continue
    variables[`--qqq-${toKebabCase(property)}`] = typeof value === 'boolean' ? String(value) : String(value)
  }
  variables['--qqq-branded-header-height'] = theme.brandedHeaderEnabled ? (theme.brandedHeaderHeight ?? '48px') : '0px'

  // Palette onto the Next tokens
  set(['--color-primary', '--color-ring', '--primary', '--ring', '--qqq-accent-color', '--qqq-sidebar-active-bg'], theme.primaryColor)
  set(['--color-background'], theme.backgroundColor)
  set(['--color-card', '--color-popover'], theme.surfaceColor)
  set(['--color-foreground', '--color-card-foreground', '--color-popover-foreground', '--color-secondary-foreground', '--color-accent-foreground'], theme.textPrimary)
  set(['--color-muted-foreground'], theme.textSecondary)
  set(['--color-destructive'], theme.errorColor)
  for (const [property, palettes] of Object.entries(STATUS_PALETTES) as [keyof typeof STATUS_PALETTES, string[]][]) {
    const color = theme[property]
    if (!color) continue
    for (const palette of palettes) {
      for (const [step, mix] of SHADES) variables[`--color-${palette}-${step}`] = shade(color, mix)
    }
  }
  set(['--color-border'], theme.borderColor)
  if (theme.borderColor) variables['--color-input'] = `var(--qqq-input-border-color, ${theme.borderColor})`

  // Typography: families, base size and the four Material weights onto the Tailwind tokens
  set(['--font-sans'], theme.fontFamily)
  set(['--font-mono'], theme.monoFontFamily)
  set(['--font-weight-light'], theme.fontWeightLight)
  set(['--font-weight-normal'], theme.fontWeightRegular)
  set(['--font-weight-medium', '--font-weight-semibold'], theme.fontWeightMedium)
  set(['--font-weight-bold'], theme.fontWeightBold)
  rule('h1, h2, h3, h4, h5, h6', { 'font-family': theme.headerFontFamily })
  rule('body', { 'font-size': theme.fontSizeBase })
  for (const variant of TYPOGRAPHY_VARIANTS) {
    rule(TYPOGRAPHY_SELECTORS[variant], {
      'font-size': theme[`typography${variant}FontSize`],
      'font-weight': theme[`typography${variant}FontWeight`],
      'line-height': theme[`typography${variant}LineHeight`],
      'letter-spacing': theme[`typography${variant}LetterSpacing`],
      'text-transform': theme[`typography${variant}TextTransform`],
    })
  }

  // Radii: global (absolute) or scale (times each default) onto the Tailwind radius tokens,
  // then per-component radii, which always win (Material: component ?? global ?? default * scale)
  const globalRadius = parsePx(theme.borderRadiusGlobal)
  const scale = theme.borderRadiusScale === undefined ? undefined : Number(theme.borderRadiusScale)
  for (const [token, rem] of Object.entries(TAILWIND_RADII)) {
    if (globalRadius !== null) variables[`--radius-${token}`] = `${globalRadius}px`
    else if (scale !== undefined && scale !== 1) variables[`--radius-${token}`] = `${Math.round(rem * scale * 1000) / 1000}rem`
  }
  for (const component of Object.keys(RADIUS_COMPONENTS) as RadiusComponent[]) {
    const own = parsePx(theme[`borderRadius${component}`])
    if (own !== null) rule(RADIUS_SELECTORS[component], { 'border-radius': `${own}px` })
  }

  // Density: Material's spacing unit (6, 8 or 10 px) scales the grid and the page padding
  if (theme.density) {
    const spacing = DENSITY_SPACING[theme.density]
    Object.assign(variables, {
      '--qqq-spacing-base': `${spacing.base}px`, '--qqq-spacing-small': spacing.small,
      '--qqq-spacing-medium': spacing.medium, '--qqq-spacing-large': spacing.large,
    })
    if (theme.density !== 'normal') {
      const unit = `${(0.25 * spacing.base) / 8}rem`
      rule(`[data-qqq-id^="grid-"], ${GRID}`, { '--spacing': unit })
      rule('#main-content', { padding: `${(spacing.base * 3) / 16}rem` })
    }
  }

  // The navigation panel: its own tokens, so every entry, icon and divider follows
  rule(SIDEBAR, {
    background: theme.sidebarBackgroundColor,
    '--color-sidebar': theme.sidebarBackgroundColor,
    color: theme.sidebarTextColor,
    '--color-foreground': theme.sidebarTextColor,
    '--color-muted-foreground': theme.sidebarTextColor,
    '--color-accent': theme.sidebarHoverBackgroundColor,
    '--color-border': theme.sidebarDividerColor,
  })
  // (hover: the entries' own hover:bg-accent picks up the panel's --color-accent)
  rule(`${SIDEBAR} nav :is(a, button)`, { color: theme.sidebarTextColor })
  rule(`${SIDEBAR} nav svg`, { color: theme.sidebarIconColor })
  rule(SIDEBAR_ACTIVE, { 'background-color': theme.sidebarSelectedBackgroundColor, color: theme.sidebarSelectedTextColor })
  rule(`${SIDEBAR_ACTIVE} *`, { color: theme.sidebarSelectedTextColor })

  // The query grid
  rule(`${GRID} thead tr, ${GRID} thead th`, { 'background-color': theme.tableHeaderBackgroundColor })
  rule(`${GRID} thead th, ${GRID} thead th *`, { color: theme.tableHeaderTextColor })
  rule(`${GRID} tbody tr:hover, ${GRID} tbody tr:hover > td`, { 'background-color': theme.tableRowHoverColor })
  rule(`${GRID} tbody tr:has(input[type="checkbox"]:checked), ${GRID} tbody tr:has(input[type="checkbox"]:checked) > td`, { 'background-color': theme.tableRowSelectedColor })
  rule(`${GRID}, ${GRID} tr, ${GRID} th, ${GRID} td`, { 'border-color': theme.tableBorderColor })

  // Dividers and card borders
  rule('hr, [role="separator"]', { 'border-color': theme.dividerColor, 'background-color': theme.dividerColor })
  rule('.rounded-xl.border', { 'border-color': theme.cardBorderColor })

  // Material colors themed links with --qqq-link-color, else the secondary color
  if (theme.secondaryColor) {
    rule('main a.text-primary:not([data-qqq-id^="button-"]), [role="dialog"] a.text-primary:not([data-qqq-id^="button-"])', { color: `var(--qqq-link-color, ${theme.secondaryColor})` })
  }

  return { variables, css: rules.join('\n') }
}

/**
 * Rules that exist whenever a theme is present: Material's component override variables
 * (set from customCss) and the prefer-info-over-primary color choice. Each falls back to the
 * value Next uses, so the look only changes when an application sets the variable.
 *
 * @param theme - The parsed theme.
 * @returns The style sheet text.
 */
export function buildThemedBaseCss(theme: QThemeMetaData): string {
  const preferInfo = theme.preferInfoColorToPrimaryColor === false ? 0 : 1
  const themed = 'body.qqq-themed'
  const preferred = 'var(--qqq-preferred-action-color)'
  return [
    // In the style sheet, not inline, so application customCss can still override it (Material)
    `:root { --qqq-prefer-info-color-to-primary-color: ${preferInfo}; }`,
    `${themed} { --qqq-preferred-action-color: color-mix(in srgb, var(--qqq-info-color) calc(var(--qqq-prefer-info-color-to-primary-color) * 100%), var(--color-primary)); }`,
    `${themed} :is([data-qqq-id="button-create"], [data-qqq-id="button-save"]) { background-color: ${preferred}; }`,
    `${themed} [data-qqq-id="step-wizard"] .bg-primary { background-color: ${preferred}; }`,
    `${themed} [data-qqq-id="step-wizard"] :is(.text-primary, .border-primary) { color: ${preferred}; border-color: ${preferred}; }`,
    `${themed} [data-qqq-id^="app-home-"] svg.text-primary { color: ${preferred}; }`,
    `${themed} [data-qqq-id^="pagination"] .bg-primary { background-color: ${preferred}; }`,
    // Component override variables (Material QQQ_THEMING_GUIDE.md, "Component-Specific Variables")
    `${themed} [data-qqq-id="step-wizard"] [data-qqq-step-state="pending"] { border-color: var(--qqq-stepper-inactive-color, var(--color-border)); color: var(--qqq-stepper-inactive-color, var(--color-muted-foreground)); }`,
    `${themed} [data-radix-popper-content-wrapper] > [data-state$="-open"] { background-color: var(--qqq-tooltip-background-color, var(--color-card)); color: var(--qqq-tooltip-text-color, var(--color-foreground)); box-shadow: var(--qqq-tooltip-shadow, 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)); }`,
    `${themed} [role="menu"] [role="menuitem"]:is(:hover, [data-highlighted]) { background-color: var(--qqq-menu-hover-color, var(--color-accent)); }`,
    `${themed} button[role="checkbox"][aria-checked="false"] { background-color: var(--qqq-switch-track-color, var(--color-muted)); }`,
  ].join('\n')
}

/** Element ids of the style elements the theme owns. */
export const THEME_STYLE_ID = 'qqq-theme'
export const CUSTOM_CSS_STYLE_ID = 'qqq-custom-theme-css'

/**
 * Upserts a style element in the document head.
 *
 * @param id - The element id.
 * @param text - The style sheet text.
 */
function upsertStyle(id: string, text: string): void {
  let element = document.getElementById(id)
  if (!(element instanceof HTMLStyleElement)) {
    element?.remove()
    element = document.createElement('style')
    element.id = id
    document.head.appendChild(element)
  }
  element.textContent = text
}

/**
 * Applies a theme to the document (or removes it): the `qqq-themed` body class (only when a
 * theme is present, as in Material), the variables on the document element, the theme rules,
 * and the application's customCss as `<style id="qqq-custom-theme-css">` after them.
 *
 * customCss is applied as written (Material allows `@import` and `data:` URLs); the dashboard's
 * Content-Security-Policy (QRun-IO/qqq#695) decides what it may load. It is set as the text of a
 * style element, so it can never become markup.
 *
 * @param theme - The theme, or null to remove every trace of one.
 * @returns A function that removes what was applied.
 */
export function applyMaterialTheme(theme: QThemeMetaData | null): () => void {
  if (typeof document === 'undefined') return () => undefined
  const root = document.documentElement
  if (!theme) {
    document.body.classList.remove('qqq-themed')
    document.getElementById(THEME_STYLE_ID)?.remove()
    document.getElementById(CUSTOM_CSS_STYLE_ID)?.remove()
    return () => undefined
  }
  const { variables, css } = buildThemeStyle(theme)
  const previous = new Map<string, string>()
  for (const [name, value] of Object.entries(variables)) {
    previous.set(name, root.style.getPropertyValue(name))
    root.style.setProperty(name, value)
  }
  document.body.classList.add('qqq-themed')
  upsertStyle(THEME_STYLE_ID, `${buildThemedBaseCss(theme)}\n${css}`)
  if (theme.customCss) upsertStyle(CUSTOM_CSS_STYLE_ID, theme.customCss)
  else document.getElementById(CUSTOM_CSS_STYLE_ID)?.remove()
  return () => {
    for (const [name, value] of previous) {
      if (value) root.style.setProperty(name, value)
      else root.style.removeProperty(name)
    }
    document.body.classList.remove('qqq-themed')
    document.getElementById(THEME_STYLE_ID)?.remove()
    document.getElementById(CUSTOM_CSS_STYLE_ID)?.remove()
  }
}
