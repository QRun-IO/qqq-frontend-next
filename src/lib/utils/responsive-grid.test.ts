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

import { containerSpanClasses } from './responsive-grid'

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
