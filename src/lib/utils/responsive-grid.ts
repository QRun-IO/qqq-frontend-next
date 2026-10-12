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
 * @file responsive-grid — 12-column grid spans that follow the width of the grid itself
 * (CSS container queries), not the viewport.
 *
 * QQQ metadata sizes cards, widgets and fields in twelfths (`gridColumns`). Applied at a
 * viewport breakpoint, a half-width card is half of whatever is left after the sidebar, so two
 * table panels sit side by side at 350px each on a laptop. Here an item only takes its declared
 * width when the grid is wide enough for that many items of its kind to sit in a row:
 *
 * | grid width ≥ | cards (tables)  | widgets  | fields   | span                     |
 * |--------------|-----------------|----------|----------|--------------------------|
 * | 0            |                 |          |          | full width               |
 * | L1           | 66rem (1056px)  | 40rem    | 30rem    | ≤ 6 → half, else full    |
 * | L2           | 100rem (1600px) | 60rem    | 44rem    | at least a third         |
 * | L3           | 120rem (1920px) | 76rem    | 56rem    | the declared span        |
 *
 * The grid element must carry {@link GRID_CONTAINER} (`@container`) so its items can query it.
 * Every class is spelled out below so Tailwind generates it.
 */

/** Which kind of item a grid holds, which sets how narrow an item may get. */
export type GridItemProfile = 'cards' | 'widgets' | 'fields'

/** Class for a grid element whose items use {@link containerSpanClasses}. */
export const GRID_CONTAINER = '@container'

/** Span classes per profile and declared span (static strings for the Tailwind scanner). */
const SPANS: Record<GridItemProfile, Record<number, string>> = {
  cards: {
    1: 'col-span-12 @min-[66rem]:col-span-6 @min-[100rem]:col-span-4 @min-[120rem]:col-span-1',
    2: 'col-span-12 @min-[66rem]:col-span-6 @min-[100rem]:col-span-4 @min-[120rem]:col-span-2',
    3: 'col-span-12 @min-[66rem]:col-span-6 @min-[100rem]:col-span-4 @min-[120rem]:col-span-3',
    4: 'col-span-12 @min-[66rem]:col-span-6 @min-[100rem]:col-span-4',
    5: 'col-span-12 @min-[66rem]:col-span-6 @min-[100rem]:col-span-5',
    6: 'col-span-12 @min-[66rem]:col-span-6',
    7: 'col-span-12 @min-[100rem]:col-span-7',
    8: 'col-span-12 @min-[100rem]:col-span-8',
    9: 'col-span-12 @min-[100rem]:col-span-9',
    10: 'col-span-12 @min-[100rem]:col-span-10',
    11: 'col-span-12 @min-[100rem]:col-span-11',
    12: 'col-span-12',
  },
  widgets: {
    1: 'col-span-12 @min-[40rem]:col-span-6 @min-[60rem]:col-span-4 @min-[76rem]:col-span-1',
    2: 'col-span-12 @min-[40rem]:col-span-6 @min-[60rem]:col-span-4 @min-[76rem]:col-span-2',
    3: 'col-span-12 @min-[40rem]:col-span-6 @min-[60rem]:col-span-4 @min-[76rem]:col-span-3',
    4: 'col-span-12 @min-[40rem]:col-span-6 @min-[60rem]:col-span-4',
    5: 'col-span-12 @min-[40rem]:col-span-6 @min-[60rem]:col-span-5',
    6: 'col-span-12 @min-[40rem]:col-span-6',
    7: 'col-span-12 @min-[60rem]:col-span-7',
    8: 'col-span-12 @min-[60rem]:col-span-8',
    9: 'col-span-12 @min-[60rem]:col-span-9',
    10: 'col-span-12 @min-[60rem]:col-span-10',
    11: 'col-span-12 @min-[60rem]:col-span-11',
    12: 'col-span-12',
  },
  fields: {
    1: 'col-span-12 @min-[30rem]:col-span-6 @min-[44rem]:col-span-4 @min-[56rem]:col-span-1',
    2: 'col-span-12 @min-[30rem]:col-span-6 @min-[44rem]:col-span-4 @min-[56rem]:col-span-2',
    3: 'col-span-12 @min-[30rem]:col-span-6 @min-[44rem]:col-span-4 @min-[56rem]:col-span-3',
    4: 'col-span-12 @min-[30rem]:col-span-6 @min-[44rem]:col-span-4',
    5: 'col-span-12 @min-[30rem]:col-span-6 @min-[44rem]:col-span-5',
    6: 'col-span-12 @min-[30rem]:col-span-6',
    7: 'col-span-12 @min-[44rem]:col-span-7',
    8: 'col-span-12 @min-[44rem]:col-span-8',
    9: 'col-span-12 @min-[44rem]:col-span-9',
    10: 'col-span-12 @min-[44rem]:col-span-10',
    11: 'col-span-12 @min-[44rem]:col-span-11',
    12: 'col-span-12',
  },
}

/**
 * Default field width when metadata sets none, in a two-column layout of read-only label/value
 * pairs: half from 24rem (two ~180px values beside the sidebar on a tablet), a third and then a
 * quarter on very wide grids (ultra-wide record tabs); phones stack.
 */
export const DEFAULT_FIELD_SPAN_CLASSES = 'col-span-12 min-w-0 @min-[24rem]:col-span-6 @min-[64rem]:col-span-4 @min-[96rem]:col-span-3'

/**
 * A declared `gridColumns` value as a span of 1 to 12.
 *
 * @param span - Declared twelfths.
 * @returns The rounded span, or 12 when unset or invalid.
 */
function normalizedSpan(span: number | undefined | null): number {
  return typeof span === 'number' && Number.isFinite(span) && span >= 1 && span <= 12 ? Math.round(span) : 12
}

/**
 * Classes that size an item of a 12-column `@container` grid by the grid's own width.
 *
 * @param span - Declared width in twelfths (`gridColumns`); full width when unset.
 * @param profile - What the grid holds.
 * @returns The classes (always including `min-w-0`, so wide content cannot stretch the track).
 */
export function containerSpanClasses(span: number | undefined | null, profile: GridItemProfile): string {
  return `${SPANS[profile][normalizedSpan(span)]} min-w-0`
}

/**
 * Minimum-width tiers (rem) a widget may declare with `gridMinWidth`; a declared value snaps up
 * to the next tier, so the widget never gets narrower than it asked for.
 */
export const MIN_WIDTH_TIERS = [16, 20, 24, 28, 32, 40, 48, 64] as const

/** The dashboard grid gap (`gap-5`) the min-width thresholds allow for, in rem. */
export const GRID_GAP_REM = 1.25

/** The widest grid (rem, a 3200px window) a min-width threshold is generated for. */
export const MAX_THRESHOLD_REM = 200

/**
 * The narrowest 12-column grid (rem, rounded up to 0.5rem) in which an item spanning `span`
 * twelfths is at least `minRem` wide, and so is an item of the same minimum spanning the
 * rest of the row (`12 - span`), so a widget wider than half never leaves a hole too narrow
 * for its neighbour. An item of span t in a grid of width W is `(W - 11g) * t / 12 + (t - 1)g` wide.
 *
 * @param minRem - The item's minimum width in rem.
 * @param span - Declared span, 1 to 11.
 * @returns The grid width in rem.
 */
export function minWidthThreshold(minRem: number, span: number): number {
  const fits = (t: number) => (12 * (minRem - (t - 1) * GRID_GAP_REM)) / t + 11 * GRID_GAP_REM
  return Math.ceil(Math.max(fits(span), fits(12 - span)) * 2) / 2
}

/**
 * Span classes per min-width tier and declared span: full width, then half, a third, a quarter,
 * a sixth (never narrower than declared, then the declared span itself) from the grid width at
 * which each fits ({@link minWidthThreshold}). Static strings for the Tailwind scanner; the
 * unit test regenerates them from the formula.
 */
const MIN_WIDTH_SPANS: Record<(typeof MIN_WIDTH_TIERS)[number], Record<number, string>> = {
  16: {
    1: 'col-span-12 @min-[33.5rem]:col-span-6 @min-[50.5rem]:col-span-4 @min-[68rem]:col-span-3 @min-[102.5rem]:col-span-2',
    2: 'col-span-12 @min-[33.5rem]:col-span-6 @min-[50.5rem]:col-span-4 @min-[68rem]:col-span-3 @min-[102.5rem]:col-span-2',
    3: 'col-span-12 @min-[33.5rem]:col-span-6 @min-[50.5rem]:col-span-4 @min-[68rem]:col-span-3',
    4: 'col-span-12 @min-[33.5rem]:col-span-6 @min-[50.5rem]:col-span-4',
    5: 'col-span-12 @min-[33.5rem]:col-span-6 @min-[40.5rem]:col-span-5',
    6: 'col-span-12 @min-[33.5rem]:col-span-6',
    7: 'col-span-12 @min-[40.5rem]:col-span-7',
    8: 'col-span-12 @min-[50.5rem]:col-span-8',
    9: 'col-span-12 @min-[68rem]:col-span-9',
    10: 'col-span-12 @min-[102.5rem]:col-span-10',
    11: 'col-span-12',
    12: 'col-span-12',
  },
  20: {
    1: 'col-span-12 @min-[41.5rem]:col-span-6 @min-[62.5rem]:col-span-4 @min-[84rem]:col-span-3 @min-[126.5rem]:col-span-2',
    2: 'col-span-12 @min-[41.5rem]:col-span-6 @min-[62.5rem]:col-span-4 @min-[84rem]:col-span-3 @min-[126.5rem]:col-span-2',
    3: 'col-span-12 @min-[41.5rem]:col-span-6 @min-[62.5rem]:col-span-4 @min-[84rem]:col-span-3',
    4: 'col-span-12 @min-[41.5rem]:col-span-6 @min-[62.5rem]:col-span-4',
    5: 'col-span-12 @min-[41.5rem]:col-span-6 @min-[50rem]:col-span-5',
    6: 'col-span-12 @min-[41.5rem]:col-span-6',
    7: 'col-span-12 @min-[50rem]:col-span-7',
    8: 'col-span-12 @min-[62.5rem]:col-span-8',
    9: 'col-span-12 @min-[84rem]:col-span-9',
    10: 'col-span-12 @min-[126.5rem]:col-span-10',
    11: 'col-span-12',
    12: 'col-span-12',
  },
  24: {
    1: 'col-span-12 @min-[49.5rem]:col-span-6 @min-[74.5rem]:col-span-4 @min-[100rem]:col-span-3 @min-[150.5rem]:col-span-2',
    2: 'col-span-12 @min-[49.5rem]:col-span-6 @min-[74.5rem]:col-span-4 @min-[100rem]:col-span-3 @min-[150.5rem]:col-span-2',
    3: 'col-span-12 @min-[49.5rem]:col-span-6 @min-[74.5rem]:col-span-4 @min-[100rem]:col-span-3',
    4: 'col-span-12 @min-[49.5rem]:col-span-6 @min-[74.5rem]:col-span-4',
    5: 'col-span-12 @min-[49.5rem]:col-span-6 @min-[59.5rem]:col-span-5',
    6: 'col-span-12 @min-[49.5rem]:col-span-6',
    7: 'col-span-12 @min-[59.5rem]:col-span-7',
    8: 'col-span-12 @min-[74.5rem]:col-span-8',
    9: 'col-span-12 @min-[100rem]:col-span-9',
    10: 'col-span-12 @min-[150.5rem]:col-span-10',
    11: 'col-span-12',
    12: 'col-span-12',
  },
  28: {
    1: 'col-span-12 @min-[57.5rem]:col-span-6 @min-[86.5rem]:col-span-4 @min-[116rem]:col-span-3 @min-[174.5rem]:col-span-2',
    2: 'col-span-12 @min-[57.5rem]:col-span-6 @min-[86.5rem]:col-span-4 @min-[116rem]:col-span-3 @min-[174.5rem]:col-span-2',
    3: 'col-span-12 @min-[57.5rem]:col-span-6 @min-[86.5rem]:col-span-4 @min-[116rem]:col-span-3',
    4: 'col-span-12 @min-[57.5rem]:col-span-6 @min-[86.5rem]:col-span-4',
    5: 'col-span-12 @min-[57.5rem]:col-span-6 @min-[69rem]:col-span-5',
    6: 'col-span-12 @min-[57.5rem]:col-span-6',
    7: 'col-span-12 @min-[69rem]:col-span-7',
    8: 'col-span-12 @min-[86.5rem]:col-span-8',
    9: 'col-span-12 @min-[116rem]:col-span-9',
    10: 'col-span-12 @min-[174.5rem]:col-span-10',
    11: 'col-span-12',
    12: 'col-span-12',
  },
  32: {
    1: 'col-span-12 @min-[65.5rem]:col-span-6 @min-[98.5rem]:col-span-4 @min-[132rem]:col-span-3 @min-[198.5rem]:col-span-2',
    2: 'col-span-12 @min-[65.5rem]:col-span-6 @min-[98.5rem]:col-span-4 @min-[132rem]:col-span-3 @min-[198.5rem]:col-span-2',
    3: 'col-span-12 @min-[65.5rem]:col-span-6 @min-[98.5rem]:col-span-4 @min-[132rem]:col-span-3',
    4: 'col-span-12 @min-[65.5rem]:col-span-6 @min-[98.5rem]:col-span-4',
    5: 'col-span-12 @min-[65.5rem]:col-span-6 @min-[79rem]:col-span-5',
    6: 'col-span-12 @min-[65.5rem]:col-span-6',
    7: 'col-span-12 @min-[79rem]:col-span-7',
    8: 'col-span-12 @min-[98.5rem]:col-span-8',
    9: 'col-span-12 @min-[132rem]:col-span-9',
    10: 'col-span-12 @min-[198.5rem]:col-span-10',
    11: 'col-span-12',
    12: 'col-span-12',
  },
  40: {
    1: 'col-span-12 @min-[81.5rem]:col-span-6 @min-[122.5rem]:col-span-4 @min-[164rem]:col-span-3',
    2: 'col-span-12 @min-[81.5rem]:col-span-6 @min-[122.5rem]:col-span-4 @min-[164rem]:col-span-3',
    3: 'col-span-12 @min-[81.5rem]:col-span-6 @min-[122.5rem]:col-span-4 @min-[164rem]:col-span-3',
    4: 'col-span-12 @min-[81.5rem]:col-span-6 @min-[122.5rem]:col-span-4',
    5: 'col-span-12 @min-[81.5rem]:col-span-6 @min-[98rem]:col-span-5',
    6: 'col-span-12 @min-[81.5rem]:col-span-6',
    7: 'col-span-12 @min-[98rem]:col-span-7',
    8: 'col-span-12 @min-[122.5rem]:col-span-8',
    9: 'col-span-12 @min-[164rem]:col-span-9',
    10: 'col-span-12',
    11: 'col-span-12',
    12: 'col-span-12',
  },
  48: {
    1: 'col-span-12 @min-[97.5rem]:col-span-6 @min-[146.5rem]:col-span-4 @min-[196rem]:col-span-3',
    2: 'col-span-12 @min-[97.5rem]:col-span-6 @min-[146.5rem]:col-span-4 @min-[196rem]:col-span-3',
    3: 'col-span-12 @min-[97.5rem]:col-span-6 @min-[146.5rem]:col-span-4 @min-[196rem]:col-span-3',
    4: 'col-span-12 @min-[97.5rem]:col-span-6 @min-[146.5rem]:col-span-4',
    5: 'col-span-12 @min-[97.5rem]:col-span-6 @min-[117rem]:col-span-5',
    6: 'col-span-12 @min-[97.5rem]:col-span-6',
    7: 'col-span-12 @min-[117rem]:col-span-7',
    8: 'col-span-12 @min-[146.5rem]:col-span-8',
    9: 'col-span-12 @min-[196rem]:col-span-9',
    10: 'col-span-12',
    11: 'col-span-12',
    12: 'col-span-12',
  },
  64: {
    1: 'col-span-12 @min-[129.5rem]:col-span-6 @min-[194.5rem]:col-span-4',
    2: 'col-span-12 @min-[129.5rem]:col-span-6 @min-[194.5rem]:col-span-4',
    3: 'col-span-12 @min-[129.5rem]:col-span-6 @min-[194.5rem]:col-span-4',
    4: 'col-span-12 @min-[129.5rem]:col-span-6 @min-[194.5rem]:col-span-4',
    5: 'col-span-12 @min-[129.5rem]:col-span-6 @min-[155.5rem]:col-span-5',
    6: 'col-span-12 @min-[129.5rem]:col-span-6',
    7: 'col-span-12 @min-[155.5rem]:col-span-7',
    8: 'col-span-12 @min-[194.5rem]:col-span-8',
    9: 'col-span-12',
    10: 'col-span-12',
    11: 'col-span-12',
    12: 'col-span-12',
  },
}

/**
 * A declared minimum widget width in rem: a number (rem) or a string with a `rem` or `px`
 * unit (16px = 1rem).
 *
 * @param value - The declared value (`defaultValues.gridMinWidth`).
 * @returns The width in rem, or undefined when the value is not a positive length.
 */
export function gridMinWidthRem(value: unknown): number | undefined {
  let rem = NaN
  if (typeof value === 'number') rem = value
  else if (typeof value === 'string') {
    const match = /^\s*(\d*\.?\d+)\s*(rem|px)?\s*$/i.exec(value)
    if (match) rem = match[2]?.toLowerCase() === 'px' ? Number(match[1]) / 16 : Number(match[1])
  }
  return Number.isFinite(rem) && rem > 0 ? rem : undefined
}

/**
 * Classes that size an item of a 12-column `@container` grid so it only shares a row when it
 * gets at least `minRem` (snapped up to a {@link MIN_WIDTH_TIERS} tier); an item wider than
 * the last tier always takes the full width.
 *
 * @param span - Declared width in twelfths (`gridColumns`); full width when unset.
 * @param minRem - The item's minimum width in rem.
 * @returns The classes (always including `min-w-0`).
 */
export function minWidthSpanClasses(span: number | undefined | null, minRem: number): string {
  const tier = MIN_WIDTH_TIERS.find((candidate) => candidate >= minRem)
  return `${tier ? MIN_WIDTH_SPANS[tier][normalizedSpan(span)] : 'col-span-12'} min-w-0`
}

/**
 * A declared grid profile (`defaultValues.gridProfile`): `table` is an alias of `cards`.
 *
 * @param value - The declared value.
 * @returns The profile, or undefined when the value is not one.
 */
export function gridProfileOf(value: unknown): GridItemProfile | undefined {
  if (value === 'table' || value === 'cards') return 'cards'
  return value === 'widgets' || value === 'fields' ? value : undefined
}

/**
 * A declared maximum width as CSS: a number is rem, a string may be a length in `rem`, `px`,
 * `ch`, `em` or `%`; `none` (or 0) lifts the cap.
 *
 * @param value - The declared value.
 * @param fallback - The width when nothing usable is declared.
 * @returns The CSS `max-width`, or undefined for no cap.
 */
export function cssMaxWidth(value: unknown, fallback?: string): string | undefined {
  if (value === 'none' || value === 0 || value === '0') return undefined
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return `${value}rem`
  if (typeof value === 'string' && /^\s*\d*\.?\d+(rem|px|ch|em|%)\s*$/i.test(value)) return value.trim().toLowerCase()
  return fallback
}
