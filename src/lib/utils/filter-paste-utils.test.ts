/*
 * Copyright 2026 QRun.IO, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/** @file Spreadsheet paste parsing and review messages for query value lists. */

import { describe, expect, it } from 'vitest'

import { detectSeparator, invalidPastedValuesMessage, pastedValuesSummary, splitPastedValues } from './filter-paste-utils'

describe('bulk filter-value paste', () => {
  it('detects the most frequent separator and preserves duplicates for review', () => {
    expect(detectSeparator('one|two|one\nthree')).toBe('Pipe')
    expect(splitPastedValues('one|two|one\nthree', 'Detect Automatically')).toEqual(['one', 'two', 'one', 'three'])
    expect(pastedValuesSummary(['one', 'two', 'one', 'three'])).toBe('4 values (3 unique)')
  })

  it('accepts explicit tabs, newlines and a special custom separator', () => {
    expect(splitPastedValues('one\ttwo\nthree', 'Tab')).toEqual(['one', 'two', 'three'])
    expect(splitPastedValues('one]two\nthree', 'Custom', ']')).toEqual(['one', 'two', 'three'])
    expect(splitPastedValues(' one, , two ', 'Comma')).toEqual(['one', 'two'])
  })

  it('explains invalid numeric and possible-value labels without accepting them', () => {
    expect(invalidPastedValuesMessage(1, 'number')).toContain('value is not a number')
    expect(invalidPastedValuesMessage(2, 'pvs')).toContain('2 values were not found')
    expect(invalidPastedValuesMessage(0, 'pvs')).toBe('')
  })
})
