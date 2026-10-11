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
