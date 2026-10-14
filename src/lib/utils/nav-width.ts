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
 * @file Width of the resizable desktop navigation: limits, clamping, keyboard steps and the
 * per-browser persistence of the width the user chose.
 */

/** Default width (px) when the theme sets no `--qqq-sidebar-width`: the width before it became resizable. */
export const NAV_WIDTH_DEFAULT = 256
/** Narrowest width (px) at which navigation labels stay readable. */
export const NAV_WIDTH_MIN = 200
/** Widest width (px), further limited to {@link NAV_WIDTH_MAX_FRACTION} of the viewport. */
export const NAV_WIDTH_MAX = 480
/** Largest share of the viewport width the navigation may take. */
export const NAV_WIDTH_MAX_FRACTION = 0.4
/** Arrow-key step (px); Shift+Arrow moves {@link NAV_WIDTH_STEP_LARGE}. */
export const NAV_WIDTH_STEP = 16
/** Shift+Arrow step (px). */
export const NAV_WIDTH_STEP_LARGE = 64
/** localStorage key of the chosen width. */
export const NAV_WIDTH_KEY = 'qqq-nav-width'
/** CSS custom property the desktop navigation's width reads. */
export const NAV_WIDTH_VAR = '--qqq-nav-width'
/**
 * The navigation's CSS width: the chosen width, else the theme's `--qqq-sidebar-width` token,
 * held to the same limits as {@link clampNavWidth} so a window resize never needs script.
 */
export const NAV_WIDTH_CSS = `clamp(${NAV_WIDTH_MIN}px, var(${NAV_WIDTH_VAR}, var(--qqq-sidebar-width, ${NAV_WIDTH_DEFAULT}px)), min(${NAV_WIDTH_MAX}px, ${NAV_WIDTH_MAX_FRACTION * 100}vw))`

/**
 * Widest navigation for a viewport: {@link NAV_WIDTH_MAX} or 40% of the viewport, whichever is
 * smaller, but never below the minimum.
 *
 * @param viewportWidth - Window width in px.
 * @returns The maximum width in px.
 */
export function maxNavWidth(viewportWidth: number): number {
  return Math.max(NAV_WIDTH_MIN, Math.min(NAV_WIDTH_MAX, Math.floor(viewportWidth * NAV_WIDTH_MAX_FRACTION)))
}

/**
 * Holds a width within the navigation's limits for a viewport.
 *
 * @param width - Requested width in px (rounded; non-finite falls back to the default).
 * @param viewportWidth - Window width in px.
 * @returns The width in px between {@link NAV_WIDTH_MIN} and {@link maxNavWidth}.
 */
export function clampNavWidth(width: number, viewportWidth: number): number {
  const wanted = Number.isFinite(width) ? Math.round(width) : NAV_WIDTH_DEFAULT
  return Math.min(maxNavWidth(viewportWidth), Math.max(NAV_WIDTH_MIN, wanted))
}

/**
 * The width a resize-handle key moves to: Left/Right by a step (Shift for a larger one),
 * Home to the minimum, End to the maximum.
 *
 * @param key - `KeyboardEvent.key`.
 * @param shiftKey - Whether Shift is held.
 * @param current - Current width in px.
 * @param viewportWidth - Window width in px.
 * @returns The new width in px, or `null` when the key does not resize.
 */
export function navWidthForKey(key: string, shiftKey: boolean, current: number, viewportWidth: number): number | null {
  const step = shiftKey ? NAV_WIDTH_STEP_LARGE : NAV_WIDTH_STEP
  switch (key) {
    case 'ArrowLeft': return clampNavWidth(current - step, viewportWidth)
    case 'ArrowRight': return clampNavWidth(current + step, viewportWidth)
    case 'Home': return NAV_WIDTH_MIN
    case 'End': return maxNavWidth(viewportWidth)
    default: return null
  }
}

/**
 * Reads the width the user chose.
 *
 * @returns The stored width in px, or `null` when none is stored, it is not a number, or
 *   storage is unavailable.
 */
export function readNavWidth(): number | null {
  try {
    const stored = localStorage.getItem(NAV_WIDTH_KEY)
    const width = stored === null ? NaN : Number(stored)
    return Number.isFinite(width) && width > 0 ? Math.round(width) : null
  } catch {
    return null
  }
}

/**
 * Stores the width the user chose; `null` forgets it (back to the default). Storage errors
 * (private mode, quota) are ignored: the width then lasts for this page only.
 *
 * @param width - Width in px, or `null` to clear.
 */
export function writeNavWidth(width: number | null): void {
  try {
    if (width === null) localStorage.removeItem(NAV_WIDTH_KEY)
    else localStorage.setItem(NAV_WIDTH_KEY, String(Math.round(width)))
  } catch {
    // Storage unavailable: the width is not remembered
  }
}
