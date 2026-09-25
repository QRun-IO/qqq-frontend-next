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

/** Custom properties that carry the primary accent color. */
const ACCENT_PROPERTIES = ['--qqq-accent-color', '--color-primary', '--primary', '--ring', '--qqq-sidebar-active-bg']

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
