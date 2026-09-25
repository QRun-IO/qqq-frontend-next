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

import { formatDateTime, fromLocalDateTimeInput, toLocalDateTimeInput } from './datetime-utils'

describe('formatDateTime', () => {
  it('formats an instant in the requested zone with a 12-hour clock and zone abbreviation', () => {
    expect(formatDateTime('2024-03-10T08:30:00Z', 'America/New_York')).toBe('2024-03-10 04:30:00 AM EDT')
    expect(formatDateTime('2024-03-10T08:30:00Z', 'America/Chicago')).toBe('2024-03-10 03:30:00 AM CDT')
    expect(formatDateTime('2026-09-25T13:05:09.887125Z', 'UTC')).toBe('2026-09-25 01:05:09 PM UTC')
    expect(formatDateTime('2026-01-01T00:00:00Z', 'UTC')).toBe('2026-01-01 12:00:00 AM UTC')
  })

  it('refuses values that are not zoned instants', () => {
    expect(formatDateTime('2024-03-10')).toBeNull()
    expect(formatDateTime('2024-03-10T08:30')).toBeNull()
    expect(formatDateTime(null)).toBeNull()
    expect(formatDateTime('not a date')).toBeNull()
  })
})

describe('datetime-local conversion', () => {
  it('round-trips a stored UTC instant through the local input value', () => {
    for (const instant of ['2024-03-10T08:30:00Z', '2024-11-03T06:30:15Z', '1999-12-31T23:59:59Z']) {
      const local = toLocalDateTimeInput(instant)
      expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
      expect(fromLocalDateTimeInput(local)).toBe(instant)
    }
  })

  it('interprets typed text in the browser zone and sends an explicit UTC instant', () => {
    const expected = new Date(2024, 2, 10, 9, 15, 0).toISOString().replace(/\.\d{3}Z$/, 'Z')
    expect(fromLocalDateTimeInput('2024-03-10T09:15')).toBe(expected)
    expect(fromLocalDateTimeInput('')).toBe('')
    expect(fromLocalDateTimeInput('2024-03-10T09:15:00Z')).toBe('2024-03-10T09:15:00Z')
  })

  it('leaves an empty or unreadable stored value empty', () => {
    expect(toLocalDateTimeInput(null)).toBe('')
    expect(toLocalDateTimeInput('garbage')).toBe('')
  })
})
