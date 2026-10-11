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

import { compactDate, compactDateTime, formatDateTime, fromLocalDateTimeInput, relativeDateTime, toLocalDateTimeInput } from './datetime-utils'

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

  it('preserves the original instant and precision when local text is unchanged', () => {
    const original = '2024-11-03T06:30:15.123456Z'
    expect(fromLocalDateTimeInput(toLocalDateTimeInput(original), original)).toBe(original)
  })

  it('leaves an empty or unreadable stored value empty', () => {
    expect(toLocalDateTimeInput(null)).toBe('')
    expect(toLocalDateTimeInput('garbage')).toBe('')
  })
})

describe('compactDateTime', () => {
  const now = new Date('2026-10-11T16:20:00Z')
  const options = { now, timeZone: 'America/Chicago', locale: 'en-US' }

  it('shows only the time for today, month-day-time this year, and the date before', () => {
    expect(compactDateTime('2026-10-11T13:05:00Z', undefined, options)?.text).toBe('8:05 AM')
    expect(compactDateTime('2026-07-05T23:33:29Z', undefined, options)?.text).toBe('Jul 5, 6:33 PM')
    expect(compactDateTime('2025-07-05T23:33:29Z', undefined, options)?.text).toBe('Jul 5, 2025')
  })

  it('decides today in the viewer zone, not in UTC', () => {
    // 02:00 UTC on the 11th is still the evening of the 10th in Chicago
    expect(compactDateTime('2026-10-11T02:00:00Z', undefined, options)?.text).toBe('Oct 10, 9:00 PM')
  })

  it('keeps the full zoned timestamp and the instant for the tooltip and time element', () => {
    expect(compactDateTime('2026-07-05T23:33:29Z', undefined, options)).toEqual({
      text: 'Jul 5, 6:33 PM', title: '2026-07-05 06:33:29 PM CDT', dateTime: '2026-07-05T23:33:29.000Z',
    })
  })

  it('ignores a backend display value that is the raw value or in the viewer zone', () => {
    expect(compactDateTime('2026-07-05T23:33:29Z', '2026-07-05T23:33:29Z', options)?.text).toBe('Jul 5, 6:33 PM')
    expect(compactDateTime('2026-07-05T23:33:29Z', '2026-07-05 06:33:29 PM CDT', options)?.text).toBe('Jul 5, 6:33 PM')
  })

  it('keeps a backend zone that differs from the viewer zone', () => {
    const display = compactDateTime('2026-07-05T23:33:29Z', '2026-07-05 04:33:29 PM PDT', options)
    expect(display?.text).toBe('Jul 5, 4:33 PM PDT')
    expect(display?.title).toBe('2026-07-05 04:33:29 PM PDT\nYour time: 2026-07-05 06:33:29 PM CDT')
    expect(compactDateTime('2025-07-05T23:33:29Z', '2025-07-05 04:33:29 PM PDT', options)?.text).toBe('Jul 5, 2025')
  })

  it('reads zone-less timestamps as local wall-clock time and shows other text as sent', () => {
    expect(compactDateTime('2025-01-10T08:00:00', undefined, { now, locale: 'en-US' })?.text).toBe('Jan 10, 2025')
    expect(compactDateTime('soon', undefined, options)).toEqual({ text: 'soon', title: 'soon' })
    expect(compactDateTime(null, undefined, options)).toBeNull()
    expect(compactDateTime('', '', options)).toBeNull()
  })

  it('follows the locale', () => {
    expect(compactDateTime('2026-07-05T23:33:29Z', undefined, { ...options, locale: 'en-GB' })?.text).toBe('5 Jul, 18:33')
  })
})

describe('compactDate', () => {
  const now = new Date('2026-10-11T16:20:00Z')

  it('never shows a time and drops the year only for this year', () => {
    expect(compactDate('2026-07-05', undefined, { now, locale: 'en-US' })?.text).toBe('Jul 5')
    expect(compactDate('2025-07-05', undefined, { now, locale: 'en-US' })?.text).toBe('Jul 5, 2025')
    expect(compactDate('2025-07-05T00:00:00Z', undefined, { now, locale: 'en-US' })?.text).toBe('Jul 5, 2025')
  })

  it('does not shift the calendar day by the viewer zone', () => {
    expect(compactDate('2024-06-15', undefined, { now, timeZone: 'America/Los_Angeles', locale: 'en-US' })).toEqual({
      text: 'Jun 15, 2024', title: 'Saturday, June 15, 2024 (2024-06-15)', dateTime: '2024-06-15',
    })
  })

  it('falls back to the display value for anything that is not a date', () => {
    expect(compactDate('n/a', 'Not Applicable', { now })).toEqual({ text: 'Not Applicable', title: 'Not Applicable' })
    expect(compactDate(undefined, undefined, { now })).toBeNull()
  })
})

describe('relativeDateTime', () => {
  const now = new Date('2026-10-11T16:20:00Z')
  const options = { now, locale: 'en-US' }

  it('describes recent instants and leaves older ones to the date formatter', () => {
    expect(relativeDateTime('2026-10-11T16:19:40Z', options)).toBe('just now')
    expect(relativeDateTime('2026-10-11T16:15:00Z', options)).toBe('5m ago')
    expect(relativeDateTime('2026-10-11T13:20:00Z', options)).toBe('3h ago')
    expect(relativeDateTime('2026-10-10T12:00:00Z', options)).toBe('yesterday')
    expect(relativeDateTime('2026-10-01T12:00:00Z', options)).toBeNull()
    expect(relativeDateTime('garbage', options)).toBeNull()
  })
})
