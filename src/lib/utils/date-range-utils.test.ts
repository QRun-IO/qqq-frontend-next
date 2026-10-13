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

// Tests for date-first filtering: dates to exact bounds across zones and daylight-saving changes,
// inclusive "between", relative ranges, and saved-view / URL serialisation.

import { describe, it, expect } from 'vitest'
import type { QFilterCriteria, QQueryFilter } from '@/types'
import {
  RANGE_PRESETS,
  asLastRange,
  countFilterConditions,
  criteriaToDateCondition,
  dateConditionToCriteria,
  dateConditionToExactCriterion,
  dateOfValue,
  dayStartedBy,
  describeDateCondition,
  describeRange,
  describeTimeZone,
  emptyDateCondition,
  evaluateStartOfPeriod,
  exactCriterionToDateCondition,
  formatYmdRange,
  isYmd,
  lastRange,
  periodStart,
  presetOf,
  rangeDays,
  rangeExpressions,
  rangeOfExpressions,
  startOfDayMs,
  startOfDayWire,
  startOfPeriod,
  timeZoneNote,
  toWireInstant,
  ymdAdd,
  ymdOfInstant,
  type DateCondition,
  type DateContext,
} from './date-range-utils'
import { deserializeFilter, serializeFilter, prepFilterForBackend, isCriterionComplete, describeExpression } from './filter-utils'

const CHICAGO: DateContext = { timeZone: 'America/Chicago', weekStart: 7, locale: 'en-US' }
const CHICAGO_MONDAY: DateContext = { ...CHICAGO, weekStart: 1 }
const UTC: DateContext = { timeZone: 'UTC', weekStart: 7, locale: 'en-US' }

function condition(mode: DateCondition['mode'], from = '', to = ''): DateCondition {
  return { ...emptyDateCondition(mode), from, to }
}

describe('calendar dates', () => {
  it('validates real dates only', () => {
    expect(isYmd('2026-10-12')).toBe(true)
    expect(isYmd('2028-02-29')).toBe(true)
    expect(isYmd('2026-02-29')).toBe(false)
    expect(isYmd('2026-13-01')).toBe(false)
    expect(isYmd('10/12/2026')).toBe(false)
    expect(isYmd(null)).toBe(false)
  })

  it('adds days across month, year and leap boundaries', () => {
    expect(ymdAdd('2026-10-31', 1)).toBe('2026-11-01')
    expect(ymdAdd('2026-12-31', 1)).toBe('2027-01-01')
    expect(ymdAdd('2028-02-28', 1)).toBe('2028-02-29')
    expect(ymdAdd('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('start of day in a zone', () => {
  it('is local midnight as a UTC instant', () => {
    expect(startOfDayWire('2026-10-01', 'America/Chicago')).toBe('2026-10-01T05:00:00Z') // CDT, UTC-5
    expect(startOfDayWire('2026-01-15', 'America/Chicago')).toBe('2026-01-15T06:00:00Z') // CST, UTC-6
    expect(startOfDayWire('2026-10-01', 'UTC')).toBe('2026-10-01T00:00:00Z')
    expect(startOfDayWire('2026-10-01', 'Asia/Kolkata')).toBe('2026-09-30T18:30:00Z') // UTC+5:30
    expect(startOfDayWire('2026-10-01', 'Pacific/Auckland')).toBe('2026-09-30T11:00:00Z') // NZDT, UTC+13
    expect(startOfDayWire('2026-10-01', 'America/Los_Angeles')).toBe('2026-10-01T07:00:00Z')
  })

  it('follows daylight saving: Chicago in March (23-hour day) and November (25-hour day)', () => {
    // spring forward: Sunday 2026-03-08, 2:00 CST becomes 3:00 CDT
    expect(startOfDayWire('2026-03-07', 'America/Chicago')).toBe('2026-03-07T06:00:00Z')
    expect(startOfDayWire('2026-03-08', 'America/Chicago')).toBe('2026-03-08T06:00:00Z')
    expect(startOfDayWire('2026-03-09', 'America/Chicago')).toBe('2026-03-09T05:00:00Z')
    expect(startOfDayMs('2026-03-09', 'America/Chicago') - startOfDayMs('2026-03-08', 'America/Chicago')).toBe(23 * 3_600_000)
    // fall back: Sunday 2026-11-01, 2:00 CDT becomes 1:00 CST
    expect(startOfDayWire('2026-11-01', 'America/Chicago')).toBe('2026-11-01T05:00:00Z')
    expect(startOfDayWire('2026-11-02', 'America/Chicago')).toBe('2026-11-02T06:00:00Z')
    expect(startOfDayMs('2026-11-02', 'America/Chicago') - startOfDayMs('2026-11-01', 'America/Chicago')).toBe(25 * 3_600_000)
  })

  it('takes the first valid moment when daylight saving skips midnight', () => {
    // Havana springs forward at 00:00 on 2026-03-08, so the day starts at 01:00 CDT (UTC-4)
    expect(startOfDayWire('2026-03-08', 'America/Havana')).toBe('2026-03-08T05:00:00Z')
  })

  it('reads an instant back to its local date, and recognises only exact day starts', () => {
    expect(ymdOfInstant(Date.parse('2026-10-13T04:59:59Z'), 'America/Chicago')).toBe('2026-10-12')
    expect(ymdOfInstant(Date.parse('2026-10-13T05:00:00Z'), 'America/Chicago')).toBe('2026-10-13')
    expect(dayStartedBy('2026-10-13T05:00:00Z', 'America/Chicago')).toBe('2026-10-13')
    expect(dayStartedBy('2026-10-13T05:00:00.001Z', 'America/Chicago')).toBeNull()
    expect(dayStartedBy('2026-10-13T06:00:00Z', 'America/Chicago')).toBeNull()
    expect(dayStartedBy('2026-10-13', 'America/Chicago')).toBeNull()
    expect(dayStartedBy({ type: 'Now' }, 'America/Chicago')).toBeNull()
    expect(dateOfValue('2026-10-13T04:00:00Z', 'America/Chicago')).toBe('2026-10-12')
    expect(dateOfValue('2026-10-13T08:30', 'America/Chicago')).toBe('2026-10-13')
    expect(dateOfValue('2026-10-13', 'America/Chicago')).toBe('2026-10-13')
    expect(dateOfValue('soon', 'America/Chicago')).toBeNull()
  })

  it('writes whole seconds without a fraction', () => {
    expect(toWireInstant(Date.parse('2026-10-01T05:00:00Z'))).toBe('2026-10-01T05:00:00Z')
    expect(toWireInstant(Date.parse('2026-10-01T05:00:00.500Z'))).toBe('2026-10-01T05:00:00.500Z')
  })
})

describe('dates to bounds on a DATE_TIME field', () => {
  const sql = (criteria: QFilterCriteria[]) => criteria.map((c) => `${c.operator} ${String(c.values[0])}`)
  // a tiny evaluator for the half-open pair, to check which instants a range selects
  const selects = (criteria: QFilterCriteria[], instant: string) =>
    criteria.every((c) => (c.operator === 'GREATER_THAN_OR_EQUALS' ? Date.parse(instant) >= Date.parse(String(c.values[0])) : Date.parse(instant) < Date.parse(String(c.values[0]))))

  it('"On" a date is that day, start inclusive and the next day start exclusive', () => {
    expect(sql(dateConditionToCriteria('created', 'DATE_TIME', condition('on', '2026-10-05'), CHICAGO)))
      .toEqual(['GREATER_THAN_OR_EQUALS 2026-10-05T05:00:00Z', 'LESS_THAN 2026-10-06T05:00:00Z'])
  })

  it('"Between Oct 1 and Oct 12" includes 23:59 on Oct 12 and excludes Oct 13 00:00', () => {
    const criteria = dateConditionToCriteria('created', 'DATE_TIME', condition('between', '2026-10-01', '2026-10-12'), CHICAGO)
    expect(sql(criteria)).toEqual(['GREATER_THAN_OR_EQUALS 2026-10-01T05:00:00Z', 'LESS_THAN 2026-10-13T05:00:00Z'])
    expect(selects(criteria, '2026-10-01T04:59:59.999Z')).toBe(false) // Sep 30, 11:59:59.999 PM
    expect(selects(criteria, '2026-10-01T05:00:00Z')).toBe(true) // Oct 1, 00:00
    expect(selects(criteria, '2026-10-13T04:59:00Z')).toBe(true) // Oct 12, 23:59
    expect(selects(criteria, '2026-10-13T04:59:59.999Z')).toBe(true) // Oct 12, 23:59:59.999
    expect(selects(criteria, '2026-10-13T05:00:00Z')).toBe(false) // Oct 13, 00:00
  })

  it('"Between" across the November change covers the 25-hour day', () => {
    const criteria = dateConditionToCriteria('created', 'DATE_TIME', condition('between', '2026-10-30', '2026-11-01'), CHICAGO)
    expect(sql(criteria)).toEqual(['GREATER_THAN_OR_EQUALS 2026-10-30T05:00:00Z', 'LESS_THAN 2026-11-02T06:00:00Z'])
    expect(selects(criteria, '2026-11-02T05:59:00Z')).toBe(true) // Nov 1, 23:59 CST
    expect(selects(criteria, '2026-11-02T06:00:00Z')).toBe(false) // Nov 2, 00:00 CST
  })

  it('"Between" across the March change covers the 23-hour day', () => {
    const criteria = dateConditionToCriteria('created', 'DATE_TIME', condition('on', '2026-03-08'), CHICAGO)
    expect(sql(criteria)).toEqual(['GREATER_THAN_OR_EQUALS 2026-03-08T06:00:00Z', 'LESS_THAN 2026-03-09T05:00:00Z'])
  })

  it('"Before" and "After" are exclusive of the day, "on or" variants inclusive', () => {
    expect(sql(dateConditionToCriteria('created', 'DATE_TIME', condition('before', '2026-10-05'), CHICAGO))).toEqual(['LESS_THAN 2026-10-05T05:00:00Z'])
    expect(sql(dateConditionToCriteria('created', 'DATE_TIME', condition('onOrAfter', '2026-10-05'), CHICAGO))).toEqual(['GREATER_THAN_OR_EQUALS 2026-10-05T05:00:00Z'])
    expect(sql(dateConditionToCriteria('created', 'DATE_TIME', condition('after', '2026-10-05'), CHICAGO))).toEqual(['GREATER_THAN_OR_EQUALS 2026-10-06T05:00:00Z'])
    expect(sql(dateConditionToCriteria('created', 'DATE_TIME', condition('onOrBefore', '2026-10-05'), CHICAGO))).toEqual(['LESS_THAN 2026-10-06T05:00:00Z'])
  })

  it('uses the zone it is given, so the same date is a different range elsewhere', () => {
    expect(sql(dateConditionToCriteria('created', 'DATE_TIME', condition('on', '2026-10-05'), UTC))).toEqual(['GREATER_THAN_OR_EQUALS 2026-10-05T00:00:00Z', 'LESS_THAN 2026-10-06T00:00:00Z'])
    expect(sql(dateConditionToCriteria('created', 'DATE_TIME', condition('on', '2026-10-05'), { ...UTC, timeZone: 'Asia/Tokyo' })))
      .toEqual(['GREATER_THAN_OR_EQUALS 2026-10-04T15:00:00Z', 'LESS_THAN 2026-10-05T15:00:00Z'])
  })

  it('is one placeholder with no values until the dates are picked', () => {
    expect(dateConditionToCriteria('created', 'DATE_TIME', condition('between', '2026-10-01', ''), CHICAGO)).toEqual([{ fieldName: 'created', operator: 'BETWEEN', values: [] }])
    expect(dateConditionToCriteria('created', 'DATE_TIME', condition('between', '2026-10-12', '2026-10-01'), CHICAGO)).toEqual([{ fieldName: 'created', operator: 'BETWEEN', values: [] }])
    expect(dateConditionToCriteria('created', 'DATE_TIME', condition('on'), CHICAGO)).toEqual([{ fieldName: 'created', operator: 'EQUALS', values: [] }])
    expect(isCriterionComplete(dateConditionToCriteria('created', 'DATE_TIME', condition('on'), CHICAGO)[0])).toBe(false)
  })

  it('"is empty" and "is not empty" take no dates', () => {
    expect(dateConditionToCriteria('created', 'DATE_TIME', condition('empty'), CHICAGO)).toEqual([{ fieldName: 'created', operator: 'IS_BLANK', values: [] }])
    expect(dateConditionToCriteria('created', 'DATE', condition('notEmpty'), CHICAGO)).toEqual([{ fieldName: 'created', operator: 'IS_NOT_BLANK', values: [] }])
  })
})

describe('dates on a DATE field', () => {
  it('stay plain dates, one criterion each', () => {
    expect(dateConditionToCriteria('due', 'DATE', condition('on', '2026-10-05'), CHICAGO)).toEqual([{ fieldName: 'due', operator: 'EQUALS', values: ['2026-10-05'] }])
    expect(dateConditionToCriteria('due', 'DATE', condition('between', '2026-10-01', '2026-10-12'), CHICAGO)).toEqual([{ fieldName: 'due', operator: 'BETWEEN', values: ['2026-10-01', '2026-10-12'] }])
    expect(dateConditionToCriteria('due', 'DATE', condition('before', '2026-10-05'), CHICAGO)).toEqual([{ fieldName: 'due', operator: 'LESS_THAN', values: ['2026-10-05'] }])
    expect(dateConditionToCriteria('due', 'DATE', condition('after', '2026-10-05'), CHICAGO)).toEqual([{ fieldName: 'due', operator: 'GREATER_THAN', values: ['2026-10-05'] }])
    expect(dateConditionToCriteria('due', 'DATE', condition('notOn', '2026-10-05'), CHICAGO)).toEqual([{ fieldName: 'due', operator: 'NOT_EQUALS_OR_IS_NULL', values: ['2026-10-05'] }])
    expect(dateConditionToCriteria('due', 'DATE', condition('notBetween', '2026-10-01', '2026-10-12'), CHICAGO)).toEqual([{ fieldName: 'due', operator: 'NOT_BETWEEN', values: ['2026-10-01', '2026-10-12'] }])
  })

  it('reads them back', () => {
    expect(criteriaToDateCondition([{ fieldName: 'due', operator: 'EQUALS', values: ['2026-10-05'] }], 'DATE', CHICAGO)).toMatchObject({ mode: 'on', from: '2026-10-05' })
    expect(criteriaToDateCondition([{ fieldName: 'due', operator: 'BETWEEN', values: ['2026-10-01', '2026-10-12'] }], 'DATE', CHICAGO)).toMatchObject({ mode: 'between', from: '2026-10-01', to: '2026-10-12' })
    expect(criteriaToDateCondition([{ fieldName: 'due', operator: 'EQUALS', values: [{ type: 'Now' }] }], 'DATE', CHICAGO)).toBeNull()
  })
})

describe('reading criteria back into dates', () => {
  it.each([
    ['on', '2026-10-05', ''],
    ['between', '2026-10-01', '2026-10-12'],
    ['before', '2026-10-05', ''],
    ['onOrAfter', '2026-10-05', ''],
  ] as const)('round-trips %s on a DATE_TIME field', (mode, from, to) => {
    const written = dateConditionToCriteria('created', 'DATE_TIME', condition(mode, from, to), CHICAGO)
    expect(criteriaToDateCondition(written, 'DATE_TIME', CHICAGO)).toMatchObject({ mode, from, to })
  })

  it('reads "after" and "on or before" as the equivalent whole-day bound', () => {
    // GTE start of Oct 6 is "on or after Oct 6" (the same records as "after Oct 5")
    const after = dateConditionToCriteria('created', 'DATE_TIME', condition('after', '2026-10-05'), CHICAGO)
    expect(criteriaToDateCondition(after, 'DATE_TIME', CHICAGO)).toMatchObject({ mode: 'onOrAfter', from: '2026-10-06' })
    const onOrBefore = dateConditionToCriteria('created', 'DATE_TIME', condition('onOrBefore', '2026-10-05'), CHICAGO)
    expect(criteriaToDateCondition(onOrBefore, 'DATE_TIME', CHICAGO)).toMatchObject({ mode: 'before', from: '2026-10-06' })
  })

  it('treats plain datetime bounds that are not day starts as exact times', () => {
    expect(criteriaToDateCondition([{ fieldName: 'created', operator: 'GREATER_THAN_OR_EQUALS', values: ['2026-10-05T14:30:00Z'] }], 'DATE_TIME', CHICAGO)).toBeNull()
    expect(criteriaToDateCondition([{ fieldName: 'created', operator: 'BETWEEN', values: ['2026-10-05T05:00:00Z', '2026-10-06T05:00:00Z'] }], 'DATE_TIME', CHICAGO)).toBeNull()
    expect(criteriaToDateCondition([{ fieldName: 'created', operator: 'EQUALS', values: ['2026-10-05T05:00:00Z'] }], 'DATE_TIME', CHICAGO)).toBeNull()
  })

  it('reads a pair written in another zone as exact times (not whole days here)', () => {
    const written = dateConditionToCriteria('created', 'DATE_TIME', condition('between', '2026-10-01', '2026-10-12'), UTC)
    expect(criteriaToDateCondition(written, 'DATE_TIME', CHICAGO)).toBeNull()
    expect(criteriaToDateCondition(written, 'DATE_TIME', UTC)).toMatchObject({ mode: 'between', from: '2026-10-01', to: '2026-10-12' })
  })

  it('does not model field functions, other-field comparisons or three criteria', () => {
    const weekday: QFilterCriteria = { fieldName: 'created', operator: 'IN', values: [1], fieldFunction: { fieldName: 'created', functionTypeIdentifierName: 'WeekdayOfDateTime' } }
    expect(criteriaToDateCondition([weekday], 'DATE_TIME', CHICAGO)).toBeNull()
    const gte: QFilterCriteria = { fieldName: 'created', operator: 'GREATER_THAN_OR_EQUALS', values: ['2026-10-05T05:00:00Z'] }
    expect(criteriaToDateCondition([gte, gte, gte], 'DATE_TIME', CHICAGO)).toBeNull()
    expect(criteriaToDateCondition([], 'DATE_TIME', CHICAGO)).toBeNull()
  })

  it('reads a placeholder as the comparison it was made for', () => {
    expect(criteriaToDateCondition([{ fieldName: 'created', operator: 'EQUALS', values: [] }], 'DATE_TIME', CHICAGO)).toMatchObject({ mode: 'on', from: '' })
    expect(criteriaToDateCondition([{ fieldName: 'created', operator: 'BETWEEN', values: [] }], 'DATE_TIME', CHICAGO)).toMatchObject({ mode: 'between' })
    expect(criteriaToDateCondition([{ fieldName: 'created', operator: 'IS_BLANK', values: [] }], 'DATE_TIME', CHICAGO)).toMatchObject({ mode: 'empty' })
  })
})

describe('periods', () => {
  // Wednesday 2026-10-14
  const today = '2026-10-14'

  it('finds the start of a day, week, month, quarter and year, this and neighbouring', () => {
    expect(periodStart(today, 'DAYS', 0)).toBe('2026-10-14')
    expect(periodStart(today, 'DAYS', -6)).toBe('2026-10-08')
    expect(periodStart(today, 'WEEKS', 0, 7)).toBe('2026-10-11') // Sunday
    expect(periodStart(today, 'WEEKS', 0, 1)).toBe('2026-10-12') // Monday
    expect(periodStart(today, 'WEEKS', -1, 1)).toBe('2026-10-05')
    expect(periodStart(today, 'WEEKS', 1, 7)).toBe('2026-10-18')
    expect(periodStart(today, 'WEEKS', 0, 6)).toBe('2026-10-10') // Saturday
    expect(periodStart(today, 'MONTHS', 0)).toBe('2026-10-01')
    expect(periodStart(today, 'MONTHS', -1)).toBe('2026-09-01')
    expect(periodStart(today, 'MONTHS', 3)).toBe('2027-01-01')
    expect(periodStart(today, 'QUARTERS', 0)).toBe('2026-10-01')
    expect(periodStart(today, 'QUARTERS', -1)).toBe('2026-07-01')
    expect(periodStart('2027-02-10', 'QUARTERS', -1)).toBe('2026-10-01')
    expect(periodStart(today, 'YEARS', 0)).toBe('2026-01-01')
    expect(periodStart(today, 'YEARS', 1)).toBe('2027-01-01')
  })

  it('keeps a week start that falls on today', () => {
    expect(periodStart('2026-10-12', 'WEEKS', 0, 1)).toBe('2026-10-12')
    expect(periodStart('2026-10-11', 'WEEKS', 0, 1)).toBe('2026-10-05')
  })

  it('evaluates StartOfPeriod in the zone, as the backend does', () => {
    const lateEveningChicago = new Date('2026-10-15T03:30:00Z') // Oct 14, 10:30 PM CDT; already Oct 15 in UTC
    expect(evaluateStartOfPeriod(startOfPeriod('DAYS', 0), lateEveningChicago, 'America/Chicago')).toBe('2026-10-14')
    expect(evaluateStartOfPeriod(startOfPeriod('DAYS', 0), lateEveningChicago, 'UTC')).toBe('2026-10-15')
    expect(evaluateStartOfPeriod(startOfPeriod('WEEKS', -1, 1), lateEveningChicago, 'America/Chicago')).toBe('2026-10-05')
  })

  it('stamps the week start on weeks only', () => {
    expect(startOfPeriod('WEEKS', 0, 1)).toEqual({ type: 'StartOfPeriod', unit: 'WEEKS', offset: 0, weekStart: 'MONDAY' })
    expect(startOfPeriod('WEEKS', 0, 7)).toMatchObject({ weekStart: 'SUNDAY' })
    expect(startOfPeriod('MONTHS', -1, 1)).toEqual({ type: 'StartOfPeriod', unit: 'MONTHS', offset: -1 })
  })
})

describe('relative ranges and presets', () => {
  const now = new Date('2026-10-14T15:30:00Z') // Wednesday, Oct 14 in Chicago

  const daysOf = (id: string, context: DateContext = CHICAGO) => rangeDays(RANGE_PRESETS.find((p) => p.id === id)!.range, now, context)

  it('resolves every preset to the right days', () => {
    expect(daysOf('today')).toEqual({ from: '2026-10-14', to: '2026-10-14' })
    expect(daysOf('yesterday')).toEqual({ from: '2026-10-13', to: '2026-10-13' })
    expect(daysOf('last7')).toEqual({ from: '2026-10-08', to: '2026-10-14' })
    expect(daysOf('last30')).toEqual({ from: '2026-09-15', to: '2026-10-14' })
    expect(daysOf('thisWeek')).toEqual({ from: '2026-10-11', to: '2026-10-17' })
    expect(daysOf('lastWeek')).toEqual({ from: '2026-10-04', to: '2026-10-10' })
    expect(daysOf('thisWeek', CHICAGO_MONDAY)).toEqual({ from: '2026-10-12', to: '2026-10-18' })
    expect(daysOf('lastWeek', CHICAGO_MONDAY)).toEqual({ from: '2026-10-05', to: '2026-10-11' })
    expect(daysOf('thisMonth')).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(daysOf('lastMonth')).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(daysOf('thisQuarter')).toEqual({ from: '2026-10-01', to: '2026-12-31' })
    expect(daysOf('thisYear')).toEqual({ from: '2026-01-01', to: '2026-12-31' })
    expect(daysOf('lastYear')).toEqual({ from: '2025-01-01', to: '2025-12-31' })
  })

  it('"Last 7 days" stays relative: tomorrow it is a day later', () => {
    const range = RANGE_PRESETS.find((p) => p.id === 'last7')!.range
    const tomorrow = new Date(now.getTime() + 24 * 3_600_000)
    expect(rangeDays(range, now, CHICAGO)).toEqual({ from: '2026-10-08', to: '2026-10-14' })
    expect(rangeDays(range, tomorrow, CHICAGO)).toEqual({ from: '2026-10-09', to: '2026-10-15' })
  })

  it('builds custom "last N" ranges', () => {
    expect(lastRange(3, 'DAYS')).toEqual({ unit: 'DAYS', start: -2, end: 1 })
    expect(lastRange(2, 'WEEKS')).toEqual({ unit: 'WEEKS', start: -2, end: 0 })
    expect(lastRange(3, 'MONTHS')).toEqual({ unit: 'MONTHS', start: -3, end: 0 })
    expect(lastRange(0, 'DAYS')).toEqual({ unit: 'DAYS', start: 0, end: 1 })
    expect(rangeDays(lastRange(3, 'MONTHS'), now, CHICAGO)).toEqual({ from: '2026-07-01', to: '2026-09-30' })
    expect(rangeDays(lastRange(2, 'WEEKS'), now, CHICAGO)).toEqual({ from: '2026-09-27', to: '2026-10-10' })
    expect(asLastRange(lastRange(12, 'DAYS'))).toEqual({ count: 12, unit: 'DAYS' })
    expect(asLastRange({ unit: 'MONTHS', start: 0, end: 1 })).toBeNull()
  })

  it('names presets and custom ranges', () => {
    expect(describeRange(RANGE_PRESETS[2].range)).toBe('Last 7 days')
    expect(describeRange(lastRange(1, 'MONTHS'))).toBe('Last month')
    expect(describeRange(lastRange(3, 'MONTHS'))).toBe('Last 3 months')
    expect(describeRange(lastRange(10, 'DAYS'))).toBe('Last 10 days')
    expect(describeRange({ unit: 'WEEKS', start: 1, end: 2 })).toBe('week 1 to 2')
    expect(presetOf(lastRange(7, 'DAYS'))?.id).toBe('last7')
  })

  it('is a StartOfPeriod pair of criteria, in both field types, and reads back', () => {
    const range = lastRange(7, 'DAYS')
    for (const type of ['DATE', 'DATE_TIME'] as const) {
      const criteria = dateConditionToCriteria('created', type, { ...emptyDateCondition('within'), range }, CHICAGO)
      expect(criteria).toEqual([
        { fieldName: 'created', operator: 'GREATER_THAN_OR_EQUALS', values: [{ type: 'StartOfPeriod', unit: 'DAYS', offset: -6 }] },
        { fieldName: 'created', operator: 'LESS_THAN', values: [{ type: 'StartOfPeriod', unit: 'DAYS', offset: 1 }] },
      ])
      expect(criteriaToDateCondition(criteria, type, CHICAGO)).toMatchObject({ mode: 'within', range })
      expect(criteria.every(isCriterionComplete)).toBe(true)
    }
  })

  it('stamps the week start so a saved view means the same for everyone', () => {
    const [from, to] = rangeExpressions(RANGE_PRESETS.find((p) => p.id === 'lastWeek')!.range, 1)
    expect(from).toEqual({ type: 'StartOfPeriod', unit: 'WEEKS', offset: -1, weekStart: 'MONDAY' })
    expect(to).toEqual({ type: 'StartOfPeriod', unit: 'WEEKS', offset: 0, weekStart: 'MONDAY' })
    expect(rangeOfExpressions(from, to)).toEqual({ unit: 'WEEKS', start: -1, end: 0 })
    expect(rangeOfExpressions(from, startOfPeriod('WEEKS', 0, 7))).toBeNull()
    expect(rangeOfExpressions(from, startOfPeriod('MONTHS', 0))).toBeNull()
    expect(rangeOfExpressions('x', to)).toBeNull()
  })
})

describe('Include time conversions', () => {
  const NOW = new Date('2026-10-14T15:30:00Z')

  it('turns a date condition into one exact date-time criterion', () => {
    expect(dateConditionToExactCriterion('created', condition('between', '2026-10-01', '2026-10-12'), CHICAGO, NOW))
      .toEqual({ fieldName: 'created', operator: 'BETWEEN', values: ['2026-10-01T00:00', '2026-10-12T23:59:59.999'] })
    expect(dateConditionToExactCriterion('created', condition('on', '2026-10-05'), CHICAGO, NOW))
      .toEqual({ fieldName: 'created', operator: 'BETWEEN', values: ['2026-10-05T00:00', '2026-10-05T23:59:59.999'] })
    expect(dateConditionToExactCriterion('created', condition('before', '2026-10-05'), CHICAGO, NOW)).toMatchObject({ operator: 'LESS_THAN', values: ['2026-10-05T00:00'] })
    expect(dateConditionToExactCriterion('created', condition('after', '2026-10-05'), CHICAGO, NOW)).toMatchObject({ operator: 'GREATER_THAN', values: ['2026-10-05T23:59:59.999'] })
    expect(dateConditionToExactCriterion('created', { ...emptyDateCondition('within'), range: lastRange(7, 'DAYS') }, CHICAGO, NOW))
      .toMatchObject({ operator: 'BETWEEN', values: ['2026-10-08T00:00', '2026-10-14T23:59:59.999'] })
    expect(dateConditionToExactCriterion('created', condition('between', '2026-10-01', ''), CHICAGO, NOW)).toEqual({ fieldName: 'created', operator: 'BETWEEN', values: [] })
  })

  it('turns an exact date-time criterion back into the dates it falls on', () => {
    expect(exactCriterionToDateCondition({ fieldName: 'created', operator: 'BETWEEN', values: ['2026-10-01T00:00', '2026-10-12T23:59:59.999'] }, CHICAGO))
      .toMatchObject({ mode: 'between', from: '2026-10-01', to: '2026-10-12' })
    expect(exactCriterionToDateCondition({ fieldName: 'created', operator: 'GREATER_THAN', values: ['2026-10-13T04:30:00Z'] }, CHICAGO))
      .toMatchObject({ mode: 'after', from: '2026-10-12' })
    expect(exactCriterionToDateCondition({ fieldName: 'created', operator: 'NOT_BETWEEN', values: ['2026-10-01T00:00', '2026-10-02T00:00'] }, CHICAGO)).toBeNull()
    expect(exactCriterionToDateCondition({ fieldName: 'created', operator: 'GREATER_THAN', values: [{ type: 'Now' }] }, CHICAGO)).toBeNull()
  })
})

describe('plain language', () => {
  it('describes ranges and dates', () => {
    expect(formatYmdRange('2026-10-01', '2026-10-12', 'en-US')).toBe('Oct 1 – Oct 12, 2026')
    expect(formatYmdRange('2025-12-20', '2026-01-03', 'en-US')).toBe('Dec 20, 2025 – Jan 3, 2026')
    expect(formatYmdRange('2026-10-05', '2026-10-05', 'en-US')).toBe('Oct 5, 2026')
    expect(describeDateCondition(condition('between', '2026-10-01', '2026-10-12'), 'en-US')).toBe('Oct 1 – Oct 12, 2026')
    expect(describeDateCondition(condition('on', '2026-10-05'), 'en-US')).toBe('Oct 5, 2026')
    expect(describeDateCondition(condition('before', '2026-10-05'), 'en-US')).toBe('before Oct 5, 2026')
    expect(describeDateCondition(condition('onOrAfter', '2026-10-05'), 'en-US')).toBe('on or after Oct 5, 2026')
    expect(describeDateCondition({ ...emptyDateCondition('within'), range: RANGE_PRESETS[0].range }, 'en-US')).toBe('Today')
    expect(describeDateCondition(condition('between', '2026-10-01', ''), 'en-US')).toBe('')
  })

  it('names the zone for the tooltip', () => {
    expect(describeTimeZone('America/Chicago', new Date('2026-10-14T12:00:00Z'))).toBe('America/Chicago (CDT)')
    expect(describeTimeZone('America/Chicago', new Date('2026-12-14T12:00:00Z'))).toBe('America/Chicago (CST)')
    expect(timeZoneNote('UTC', 1)).toContain('Weeks start on Monday')
  })

  it('describes a StartOfPeriod expression', () => {
    expect(describeExpression(startOfPeriod('MONTHS', -1))).toBe('start of last month')
    expect(describeExpression(startOfPeriod('DAYS', 0))).toBe('start of this day')
    expect(describeExpression(startOfPeriod('QUARTERS', 1))).toBe('start of next quarter')
    expect(describeExpression(startOfPeriod('DAYS', -6))).toBe('start of 6 days ago')
  })
})

describe('saved views, URLs and the API', () => {
  const filterWith = (criteria: QFilterCriteria[]): QQueryFilter => ({ criteria, orderBys: [], subFilters: [], booleanOperator: 'AND', skip: 0, limit: 25 })

  it('keeps relative expressions relative through a URL round trip', () => {
    const criteria = dateConditionToCriteria('created', 'DATE_TIME', { ...emptyDateCondition('within'), range: lastRange(7, 'DAYS') }, CHICAGO)
    const restored = deserializeFilter(serializeFilter(filterWith(criteria)))
    expect(restored.criteria).toEqual(criteria)
    expect(criteriaToDateCondition(restored.criteria, 'DATE_TIME', CHICAGO)).toMatchObject({ mode: 'within', range: lastRange(7, 'DAYS') })
  })

  it('keeps concrete day bounds as plain ISO datetimes through a round trip', () => {
    const criteria = dateConditionToCriteria('created', 'DATE_TIME', condition('between', '2026-10-01', '2026-10-12'), CHICAGO)
    const restored = deserializeFilter(serializeFilter(filterWith(criteria)))
    expect(restored.criteria).toEqual(criteria)
    expect(restored.criteria.map((c) => c.values)).toEqual([['2026-10-01T05:00:00Z'], ['2026-10-13T05:00:00Z']])
  })

  it('sends both bounds to the backend unchanged, and drops an unfinished placeholder', () => {
    const complete = dateConditionToCriteria('created', 'DATE_TIME', condition('between', '2026-10-01', '2026-10-12'), CHICAGO)
    const placeholder = dateConditionToCriteria('created', 'DATE_TIME', condition('between', '2026-10-01', ''), CHICAGO)
    const field = () => ({ name: 'created', label: 'Created', type: 'DATE_TIME' as const, isRequired: false, isEditable: true, isHeavy: false, isHidden: false, adornments: [] })
    expect(prepFilterForBackend(filterWith(complete), field).criteria).toEqual(complete)
    expect(prepFilterForBackend(filterWith(placeholder), field).criteria).toEqual([])
  })

  it('still reads an older saved view whose bounds are plain datetimes', () => {
    const legacy = deserializeFilter(JSON.stringify({ criteria: [{ fieldName: 'created', operator: 'BETWEEN', values: ['2026-10-01T05:00:00Z', '2026-10-13T04:59:59Z'] }] }))
    expect(legacy.criteria).toHaveLength(1)
    expect(criteriaToDateCondition(legacy.criteria, 'DATE_TIME', CHICAGO)).toBeNull() // exact times: shown with "Include time"
  })
})

describe('counting conditions', () => {
  const typeOf = (name: string) => (name === 'created' ? 'DATE_TIME' as const : name === 'due' ? 'DATE' as const : 'STRING' as const)
  const filter = (criteria: QFilterCriteria[], booleanOperator: 'AND' | 'OR' = 'AND'): QQueryFilter => ({ criteria, orderBys: [], subFilters: [], booleanOperator, skip: 0, limit: 25 })
  const range = dateConditionToCriteria('created', 'DATE_TIME', condition('between', '2026-10-01', '2026-10-12'), CHICAGO)

  it('counts a date range once, and everything else per criterion', () => {
    const name: QFilterCriteria = { fieldName: 'name', operator: 'CONTAINS', values: ['x'] }
    expect(countFilterConditions(filter(range), typeOf, CHICAGO)).toBe(1)
    expect(countFilterConditions(filter([...range, name]), typeOf, CHICAGO)).toBe(2)
    expect(countFilterConditions(filter([name, { ...name, fieldName: 'name' }]), typeOf, CHICAGO)).toBe(2)
    expect(countFilterConditions(filter([...range, { fieldName: 'name', operator: 'CONTAINS', values: [] }]), typeOf, CHICAGO)).toBe(1)
  })

  it('counts two bounds separately in an OR group, and nested groups', () => {
    expect(countFilterConditions(filter(range, 'OR'), typeOf, CHICAGO)).toBe(2)
    expect(countFilterConditions({ ...filter(range), subFilters: [filter(range)] }, typeOf, CHICAGO)).toBe(2)
  })
})
