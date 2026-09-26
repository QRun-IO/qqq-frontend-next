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
  BASIC_MODE_INVALID,
  BASIC_MODE_UNSUPPORTED_PARTS,
  BASIC_MODE_UNSUPPORTED_VALUES,
  EMPTY_BASIC_SCHEDULE,
  buildBasicExpression,
  checkCron,
  cronPartAtCaret,
  describeCron,
  hourLabel,
  minuteLabel,
  ordinalDay,
  parseBasicSchedule,
} from './cron-utils'

describe('describeCron', () => {
  // The expected texts are the backend CronDescriberTest's, so the live
  // description matches the cronDescription QQQ stores.
  it.each([
    ['* * * * * ?', 'Every day, every second'],
    ['* * * ? * *', 'Every day, every second'],
    ['0 * * * * ?', 'Every day, every minute'],
    ['0 0 * * * ?', 'Every day, every hour, at minute 00'],
    ['0 0,30 * * * ?', 'Every day, every hour, at minutes 00 and 30'],
    ['0 0 0 * * ?', 'Every day, at 12:00 am'],
    ['0 0 1 * * ?', 'Every day, at 1:00 am'],
    ['0 0 11 * * ?', 'Every day, at 11:00 am'],
    ['0 0 12 * * ?', 'Every day, at 12:00 pm'],
    ['0 0 13 * * ?', 'Every day, at 1:00 pm'],
    ['0 0 23 * * ?', 'Every day, at 11:00 pm'],
    ['0 0 23, * * ?', 'Every day, at 11:00 pm'],
    ['0 0 0 10 * ?', 'Every month, on the 10th, at 12:00 am'],
    ['0 0 0 10,20 * ?', 'Every month, on the 10th and 20th, at 12:00 am'],
    ['0 0 0 10-15 * ?', 'Every month, every day between the 10th and 15th, at 12:00 am'],
    ['10-15 0 0 * * ?', 'Every day, at 12:00 am, every second between 10 and 15'],
    ['30 30 8-16 * * ?', 'Every day, every hour between 8am and 4pm, at minute 30, at second 30'],
    ['0/5 0 0 * * ?', 'Every day, at 12:00 am, every 5 seconds between 00 and 59'],
    ['0 3/30 0 * * ?', 'Every day, at 12am, every 30 minutes between 03 and 59'],
    ['0 0 0 ? * MON,WED,FRI', 'Every week, on Monday, Wednesday, and Friday, at 12:00 am'],
    ['0 0 0 ? * MON-FRI', 'Every week, every day between Monday and Friday, at 12:00 am'],
    ['0 0 0 ? * 1,7', 'Every week, on Sunday and Saturday, at 12:00 am'],
    ['0 5 2,6,12,16,20 * * ?', 'Every day, at 2:05 am, 6:05 am, 12:05 pm, 4:05 pm, and 8:05 pm'],
    ['30 15 2,6 * * ?', 'Every day, at 2:15:30 am and 6:15:30 am'],
    ['0/5 14,18,3-39,52 * ? JAN,MAR,SEP MON-FRI 2002-2010',
      'Every year between 2002 and 2010, in January, March, and September, every day between Monday and Friday, every hour, at minutes 14, 18, every minute between 03 and 39, and at minute 52, every 5 seconds between 00 and 59'],
    ['* * * ? 1-6 *', 'Every month between January and June, every second'],
    ['* * * ? 3,1-7/3 *', 'In March and every 3 months between January and July, every second'],
    ['* * * 1,3,5 * ?', 'Every month, on the 1st, 3rd, and 5th, every second'],
    ['* * * 1,3,5,7-9 * ?', 'Every month, on the 1st, 3rd, 5th, and every day between the 7th and 9th, every second'],
    ['* * 2-4,15 1,3,5 * ?', 'Every month, on the 1st, 3rd, and 5th, every hour between 2am and 4am and at 3pm, every second'],
    ['0 0 0 1 1 ?', 'In January, on the 1st, at 12:00 am'],
    ['59 59 23 * * ?', 'Every day, at 11:59:59 pm'],
    ['0 0 0 1 1 ? 2000,2010-2020,2030-2100/10', 'In the year 2000, every year between 2010 and 2020, and every 10 years between 2030 and 2100, in January, on the 1st, at 12:00 am'],
    ['0 0 0 ? Jan-Sep/2 *', 'Every 2 months between January and September, at 12:00 am'],
    ['0 0 0 ? * Mon-Sat/2', 'Every week, every 2 days between Monday and Saturday, at 12:00 am'],
    ['0 0 0 6-21/2 * ?', 'Every month, every 2 days between the 6th and 21st, at 12:00 am'],
    ['0 0 0 ? * Tues-Wed', 'Every week, on Tuesday, at 12:00 am'],
    ['0 0 0 ? * Mon-Tues', 'Every week, every day between Monday and Tuesday, at 12:00 am'],
  ])('%s is "%s"', (expression, description) => {
    expect(describeCron(expression)).toBe(description)
  })

  it.each([
    ['0 0 0 * * *', 'Cannot specify both day of month and day of week (one must be "?")'],
    ['0 0 0 1 * 1', 'Cannot specify both day of month and day of week (one must be "?")'],
    ['0 0 0 ? * ?', 'Cannot specify both day of month and day of week (only one can be "?")'],
    ['not a cron', 'Invalid cron expression: not a cron'],
    ['0 0 9 * *', 'Invalid cron expression: 0 0 9 * *'],
    ['0 A-B 9 * * ?', 'Invalid number: [A]'],
    ['0 1- 9 * * ?', 'Incomplete range expression: [1-]'],
    ['0 0 0 ? 1 2-THU', 'Range may not mix words and numbers: [2-THU]'],
    ['0 0 0 ? 1 3-*', 'Invalid day of week: [*]'],
    ['0 0 0 ? 13x *', 'Invalid month: [13x]'],
    ['0 0 12 L * ?', 'Invalid number: [L]'],
  ])('%s is rejected: %s', (expression, message) => {
    expect(() => describeCron(expression)).toThrow(message)
  })
})

describe('checkCron', () => {
  it('describes a valid expression', () => {
    expect(checkCron('0 0 9 * * ?')).toEqual({ description: 'Every day, at 9:00 am' })
  })

  it('is empty for a blank expression', () => {
    expect(checkCron('  ')).toEqual({})
  })

  it.each([
    ['0 75 9 * * ?', 'Minute values must be between 0 and 59'],
    ['0 0 24 * * ?', 'Hour values must be between 0 and 23'],
    ['60 0 9 * * ?', 'Second values must be between 0 and 59'],
    ['0 0 9 0 * ?', 'Day of month values must be between 1 and 31'],
    ['0 0 9 1-32 * ?', 'Day of month values must be between 1 and 31'],
    ['0 0 9 ? 13 *', 'Month values must be between 1 and 12'],
    ['0 0 9 ? * 8', 'Day of week values must be between 1 and 7'],
    ['0 0 9 * * ? 1969', 'Year values must be 1970 or later'],
    ['0 0/0 9 * * ?', 'Minute step must be 1 or more'],
  ])('rejects the out-of-range %s', (expression, error) => {
    expect(checkCron(expression)).toEqual({ error })
  })

  it('reports describer errors', () => {
    expect(checkCron('not a cron')).toEqual({ error: 'Invalid cron expression: not a cron' })
  })
})

describe('Basic mode', () => {
  it('starts an empty expression at midnight, every day', () => {
    expect(parseBasicSchedule('')).toEqual({ schedule: EMPTY_BASIC_SCHEDULE })
    expect(buildBasicExpression(EMPTY_BASIC_SCHEDULE)).toBe('0 0 0 * * ?')
  })

  it('reads days, hours and minutes, expanding lists and ranges', () => {
    expect(parseBasicSchedule('0 0,30 9-11 * * ?')).toEqual({ schedule: {
      days: { option: 'every', values: [] }, hours: { option: 'selected', values: [9, 10, 11] }, minutes: { option: 'selected', values: [0, 30] },
    } })
    expect(parseBasicSchedule('0 * * ? * mon,WED-FRI')).toEqual({ schedule: {
      days: { option: 'selectedWeekdays', values: [2, 4, 5, 6] }, hours: { option: 'every', values: [] }, minutes: { option: 'every', values: [] },
    } })
    expect(parseBasicSchedule('0 15 8 1,15 * ?')).toEqual({ schedule: {
      days: { option: 'selectedDates', values: [1, 15] }, hours: { option: 'selected', values: [8] }, minutes: { option: 'selected', values: [15] },
    } })
  })

  it('wraps a descending weekday range around the week, as Quartz does', () => {
    const parsed = parseBasicSchedule('0 0 9 ? * FRI-MON')
    expect('schedule' in parsed && parsed.schedule.days).toEqual({ option: 'selectedWeekdays', values: [1, 2, 6, 7] })
  })

  it.each([
    ['0 0 9 * *', BASIC_MODE_INVALID],
    ['30 0 9 * * ?', BASIC_MODE_UNSUPPORTED_PARTS],
    ['0 0 9 ? 1 *', BASIC_MODE_UNSUPPORTED_PARTS],
    ['0 0 9 * * ? 2030', BASIC_MODE_UNSUPPORTED_PARTS],
    ['0 */15 9 * * ?', BASIC_MODE_UNSUPPORTED_VALUES],
    ['0 75 9 * * ?', BASIC_MODE_INVALID],
    ['0 0 12 L * ?', BASIC_MODE_INVALID],
  ])('cannot show %s', (expression, reason) => {
    expect(parseBasicSchedule(expression)).toEqual({ reason })
  })

  it('builds sorted, distinct lists; weekdays by name; "selected" with no values means every', () => {
    expect(buildBasicExpression({ days: { option: 'selectedWeekdays', values: [6, 2, 4, 2] }, hours: { option: 'selected', values: [17, 9] }, minutes: { option: 'selected', values: [30, 0] } }))
      .toBe('0 0,30 9,17 ? * MON,WED,FRI')
    expect(buildBasicExpression({ days: { option: 'selectedDates', values: [15, 1] }, hours: { option: 'every', values: [9] }, minutes: { option: 'selected', values: [] } }))
      .toBe('0 * * 1,15 * ?')
    expect(buildBasicExpression({ days: { option: 'selectedDates', values: [] }, hours: { option: 'selected', values: [9] }, minutes: { option: 'selected', values: [0] } }))
      .toBe('0 0 9 * * ?')
  })

  it('round-trips a built expression', () => {
    const schedule = { days: { option: 'selectedWeekdays' as const, values: [2, 6] }, hours: { option: 'selected' as const, values: [9] }, minutes: { option: 'selected' as const, values: [30] } }
    const expression = buildBasicExpression(schedule)
    expect(parseBasicSchedule(expression)).toEqual({ schedule })
    expect(describeCron(expression)).toBe('Every week, on Monday and Friday, at 9:30 am')
  })
})

describe('labels', () => {
  it('formats ordinals, including the teens', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(ordinalDay)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '31st'])
  })

  it('formats hours and minutes', () => {
    expect([0, 9, 12, 17, 23].map(hourLabel)).toEqual(['12am', '9am', '12pm', '5pm', '11pm'])
    expect([0, 5, 30].map(minuteLabel)).toEqual(['00', '05', '30'])
  })
})

describe('cronPartAtCaret', () => {
  it('names the part the caret is in', () => {
    const expression = '0 30 9 * * ?'
    expect(cronPartAtCaret(expression, 0)).toBe('second')
    expect(cronPartAtCaret(expression, 2)).toBe('minute')
    expect(cronPartAtCaret(expression, 3)).toBe('minute')
    expect(cronPartAtCaret(expression, 5)).toBe('hour')
    expect(cronPartAtCaret(expression, 11)).toBe('day of week')
    expect(cronPartAtCaret(`${expression} `, 13)).toBe('year')
    expect(cronPartAtCaret('', 0)).toBe('second')
  })
})
