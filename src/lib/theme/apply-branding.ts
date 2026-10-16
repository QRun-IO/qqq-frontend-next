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
 * @file Applies branding (accent colors, favicon) to the document, for the dashboard
 * shell and for the login page before sign-in (QRun-IO/qqq#703).
 */

import type { QLoginBranding } from '@/types'

/** CSS color formats accepted for branding accents (MED-3: nothing else reaches a custom property). */
const ACCENT_COLOR_RE = /^#[0-9a-fA-F]{3,8}$|^rgb\(|^rgba\(|^hsl\(|^hsla\(/

/** Custom properties that carry the primary accent color (including the Material `--qqq-primary-color`). */
const ACCENT_PROPERTIES = ['--qqq-accent-color', '--qqq-primary-color', '--color-primary', '--primary', '--ring', '--qqq-sidebar-active-bg']

/** Background of the muted surface in the light theme: the darkest surface text may sit on. */
const LIGHT_SURFACE = '#f0f2f6'

/** Background of the muted surface in the dark theme: the lightest surface text may sit on. */
const DARK_SURFACE = '#1e2130'

/** Contrast the derived link text color must reach on its surface (WCAG AA is 4.5; a little margin for rounding). */
const LINK_CONTRAST = 4.6

/**
 * Parses a `#rgb`, `#rrggbb` or `rgb()/rgba()` color.
 *
 * @param color - The CSS color.
 * @returns Its red, green and blue channels (0-255), or `null` for any other format.
 */
function parseRgb(color: string): [number, number, number] | null {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(color.trim())
  if (hex) {
    const digits = hex[1].length === 3 ? hex[1].replace(/./g, (c) => c + c) : hex[1].slice(0, 6)
    return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16)) as [number, number, number]
  }
  const rgb = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/i.exec(color.trim())
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null
}

/**
 * Relative luminance of a color (WCAG 2).
 *
 * @param rgb - Red, green and blue channels (0-255).
 * @returns The luminance, 0 (black) to 1 (white).
 */
function luminance(rgb: readonly number[]): number {
  const [r, g, b] = rgb.map((channel) => {
    const value = Math.max(0, Math.min(255, channel)) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * WCAG contrast ratio of two colors.
 *
 * @param a - First color channels.
 * @param b - Second color channels.
 * @returns The ratio, 1 to 21.
 */
export function contrastRatio(a: readonly number[], b: readonly number[]): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

/**
 * Moves a color toward black or white, in the smallest steps, until it reaches {@link LINK_CONTRAST}
 * on a surface. A color that already does is returned unchanged.
 *
 * @param rgb - The accent channels.
 * @param surface - The surface channels the text sits on.
 * @param target - What to mix in: black (0) or white (255).
 * @returns The adjusted color as `#rrggbb`.
 */
function mixUntilReadable(rgb: [number, number, number], surface: readonly number[], target: 0 | 255): string {
  let result = rgb
  for (let step = 0; step <= 50 && contrastRatio(result, surface) < LINK_CONTRAST; step += 1) {
    const t = step / 50
    result = rgb.map((channel) => Math.round(channel + (target - channel) * t)) as [number, number, number]
  }
  return `#${result.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

/**
 * Derives the link-text colors of an accent: the accent itself when it is readable, otherwise
 * darkened (light theme) or lightened (dark theme) until it reaches 4.5:1 on the theme's surfaces.
 *
 * @param accent - The branding accent color.
 * @returns The light-theme and dark-theme text colors, or `null` when the color format is not parsed
 *   (the stylesheet then derives them from the accent).
 */
export function linkTextColors(accent: string): { light: string; dark: string } | null {
  const rgb = parseRgb(accent)
  if (!rgb) return null
  const light = mixUntilReadable(rgb, parseRgb(LIGHT_SURFACE)!, 0)
  const dark = mixUntilReadable(rgb, parseRgb(DARK_SURFACE)!, 255)
  return { light, dark }
}

/**
 * Text color for a surface filled with the accent (buttons, the active sidebar item, selected
 * tabs): white when that reaches 4.5:1, else black (one of the two always does).
 *
 * @param accent - The branding accent color.
 * @returns `#ffffff` or `#000000`, or `null` when the color format is not parsed.
 */
export function onAccentColor(accent: string): '#ffffff' | '#000000' | null {
  const rgb = parseRgb(accent)
  if (!rgb) return null
  return contrastRatio([255, 255, 255], rgb) >= 4.5 ? '#ffffff' : '#000000'
}

/**
 * Whether a branding color may be applied to CSS custom properties.
 *
 * @param color - The branding color.
 * @returns True for hex, rgb(a) and hsl(a) colors.
 */
export function isSafeAccentColor(color: string | undefined): color is string {
  return Boolean(color && ACCENT_COLOR_RE.test(color))
}

/**
 * Whether a branding image source may be used for an image: a same-origin path, an
 * http(s) URL, or an inline image. Anything else (for example `javascript:`) is dropped.
 *
 * @param source - The logo or icon path or URL.
 * @returns True when the source is safe to load.
 */
export function isSafeImageSource(source: string | undefined): source is string {
  if (!source?.trim()) return false
  try {
    const url = new URL(source, typeof window === 'undefined' ? 'http://localhost' : window.location.origin)
    if (url.protocol === 'http:' || url.protocol === 'https:') return true
    return url.protocol === 'data:' && /^data:image\//i.test(source.trim())
  } catch {
    return false
  }
}

/**
 * Applies the accent colors and the favicon of a branding to the document.
 *
 * @param branding - The branding (full metadata branding or the pre-sign-in subset).
 * @returns The accent color that was applied, if any.
 */
export function applyBrandingTheme(branding: QLoginBranding | undefined): string | undefined {
  if (!branding || typeof document === 'undefined') return undefined
  const root = document.documentElement
  let applied: string | undefined
  if (isSafeAccentColor(branding.accentColor)) {
    for (const property of ACCENT_PROPERTIES) root.style.setProperty(property, branding.accentColor)
    applied = branding.accentColor
    // Link text must stay readable whatever the brand color is (--color-link, see qqq-theme.css).
    const onAccent = onAccentColor(branding.accentColor)
    if (onAccent) root.style.setProperty('--color-primary-foreground', onAccent)
    const link = linkTextColors(branding.accentColor)
    if (link) {
      root.style.setProperty('--qqq-link-text-light', link.light)
      root.style.setProperty('--qqq-link-text-dark', link.dark)
    }
  }
  if (isSafeAccentColor(branding.accentColorLight)) {
    root.style.setProperty('--qqq-accent-color-light', branding.accentColorLight)
  }
  // Favicon and touch icon from branding (as Material Dashboard does)
  if (isSafeImageSource(branding.icon)) {
    for (const selector of ["link[rel~='icon']", "link[rel~='apple-touch-icon']"]) {
      const linkEl = document.querySelector(selector)
      if (linkEl instanceof HTMLLinkElement) linkEl.href = branding.icon
    }
  }
  return applied
}
