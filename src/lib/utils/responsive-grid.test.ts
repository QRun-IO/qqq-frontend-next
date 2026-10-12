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

import { describe, expect, it } from 'vitest'

import {
  containerSpanClasses, cssMaxWidth, DEFAULT_FIELD_SPAN_CLASSES, GRID_GAP_REM, gridMinWidthRem, gridProfileOf, MAX_THRESHOLD_REM, MIN_WIDTH_TIERS,
  minWidthSpanClasses, minWidthThreshold,
} from './responsive-grid'

/**
 * The span an item takes at each container level (base, L1, L2, L3), read back from its classes.
 *
 * @param classes - The item's classes.
 * @param breakpoints - The profile's L1-L3 widths.
 * @returns Spans at each level.
 */
function spansAt(classes: string, breakpoints: string[]): number[] {
  const spans = [12]
  for (const breakpoint of breakpoints) {
    const match = new RegExp(`@min-\\[${breakpoint}\\]:col-span-(\\d+)`).exec(classes)
    spans.push(match ? Number(match[1]) : spans[spans.length - 1])
  }
  return spans
}

describe('containerSpanClasses', () => {
  it('stacks table cards until the grid can hold two readable cards, then follows the metadata', () => {
    const cards = ['66rem', '100rem', '120rem']
    expect(spansAt(containerSpanClasses(6, 'cards'), cards)).toEqual([12, 6, 6, 6])
    expect(spansAt(containerSpanClasses(3, 'cards'), cards)).toEqual([12, 6, 4, 3])
    expect(spansAt(containerSpanClasses(8, 'cards'), cards)).toEqual([12, 12, 8, 8])
    expect(spansAt(containerSpanClasses(12, 'cards'), cards)).toEqual([12, 12, 12, 12])
  })

  it('lets small widgets and fields share a row in narrower grids', () => {
    expect(spansAt(containerSpanClasses(3, 'widgets'), ['40rem', '60rem', '76rem'])).toEqual([12, 6, 4, 3])
    expect(spansAt(containerSpanClasses(4, 'fields'), ['30rem', '44rem', '56rem'])).toEqual([12, 6, 4, 4])
  })

  it('treats a missing or invalid span as full width and always allows the item to shrink', () => {
    for (const span of [undefined, null, 0, 13, Number.NaN]) {
      expect(containerSpanClasses(span, 'cards')).toBe('col-span-12 min-w-0')
    }
    expect(containerSpanClasses(5.6, 'widgets')).toBe(containerSpanClasses(6, 'widgets'))
  })
})

describe('DEFAULT_FIELD_SPAN_CLASSES', () => {
  it('pairs read-only fields from a 24rem grid (a tablet panel beside the sidebar) and widens on very wide grids', () => {
    expect(spansAt(DEFAULT_FIELD_SPAN_CLASSES, ['24rem', '64rem', '96rem'])).toEqual([12, 6, 4, 3])
  })
})

/**
 * The span classes the min-width ladder should hold, recomputed from {@link minWidthThreshold}.
 *
 * @param minRem - Tier width.
 * @param span - Declared span.
 * @returns Expected classes.
 */
function expectedMinWidthClasses(minRem: number, span: number): string {
  const spans = [...new Set([6, 4, 3, 2, 1, span])].filter((t) => t >= span && t < 12).sort((a, b) => b - a)
  const steps = spans.filter((t) => minWidthThreshold(minRem, t) <= MAX_THRESHOLD_REM).map((t) => `@min-[${minWidthThreshold(minRem, t)}rem]:col-span-${t}`)
  return ['col-span-12', ...steps, 'min-w-0'].join(' ')
}

/**
 * Width of an item spanning `span` twelfths of a grid `gridRem` wide, in rem.
 *
 * @param gridRem - Grid width.
 * @param span - Span.
 * @returns Item width.
 */
const itemWidth = (gridRem: number, span: number) => ((gridRem - 11 * GRID_GAP_REM) * span) / 12 + (span - 1) * GRID_GAP_REM

describe('minWidthSpanClasses', () => {
  it('matches the threshold formula for every tier and span (the static table is not hand-edited)', () => {
    for (const tier of MIN_WIDTH_TIERS) {
      for (let span = 1; span <= 12; span++) expect(minWidthSpanClasses(span, tier)).toBe(expectedMinWidthClasses(tier, span))
    }
  })

  it('gives every item at least its minimum at each threshold, and a neighbour of the same minimum the rest of the row', () => {
    for (const tier of MIN_WIDTH_TIERS) {
      for (let span = 1; span < 12; span++) {
        const grid = minWidthThreshold(tier, span)
        expect(itemWidth(grid, span)).toBeGreaterThanOrEqual(tier - 1e-9)
        expect(itemWidth(grid, 12 - span)).toBeGreaterThanOrEqual(tier - 1e-9)
      }
    }
  })

  it('pairs two half-width 28rem tables only from a 57.5rem grid, thirds from 116rem', () => {
    const classes = minWidthSpanClasses(4, 28)
    expect(spansAt(classes, ['57.5rem', '86.5rem'])).toEqual([12, 6, 4])
    expect(classes).not.toContain('col-span-3')
  })

  it('snaps a declared minimum up to the next tier and keeps oversize or missing spans full width', () => {
    expect(minWidthSpanClasses(6, 25)).toBe(minWidthSpanClasses(6, 28))
    expect(minWidthSpanClasses(6, 65)).toBe('col-span-12 min-w-0')
    expect(minWidthSpanClasses(undefined, 20)).toBe('col-span-12 min-w-0')
  })
})

describe('grid hint parsing', () => {
  it('reads gridMinWidth as rem or px', () => {
    expect(gridMinWidthRem(28)).toBe(28)
    expect(gridMinWidthRem('28rem')).toBe(28)
    expect(gridMinWidthRem(' 448px ')).toBe(28)
    expect(gridMinWidthRem('20')).toBe(20)
    for (const bad of [0, -4, 'wide', '10vw', null, undefined, Number.NaN]) expect(gridMinWidthRem(bad)).toBeUndefined()
  })

  it('reads gridProfile, with table as an alias of cards', () => {
    expect(gridProfileOf('table')).toBe('cards')
    expect(gridProfileOf('cards')).toBe('cards')
    expect(gridProfileOf('widgets')).toBe('widgets')
    expect(gridProfileOf('fields')).toBe('fields')
    expect(gridProfileOf('TABLE')).toBeUndefined()
  })

  it('reads a max width as rem, a CSS length or none', () => {
    expect(cssMaxWidth(120)).toBe('120rem')
    expect(cssMaxWidth('1600px')).toBe('1600px')
    expect(cssMaxWidth('90ch')).toBe('90ch')
    expect(cssMaxWidth('none', '96rem')).toBeUndefined()
    expect(cssMaxWidth(0, '96rem')).toBeUndefined()
    expect(cssMaxWidth('calc(100% - 1px)', '96rem')).toBe('96rem')
    expect(cssMaxWidth(undefined)).toBeUndefined()
  })
})
