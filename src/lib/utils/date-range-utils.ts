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
 * @file date-range-utils — date-first filtering for DATE and DATE_TIME fields.
 *
 * People filter on dates ("orders from Oct 1 to Oct 12"), while a DATE_TIME field stores
 * instants. This module turns the dates a person picks into exact bounds in their time zone, and
 * reads such bounds back into dates, without changing any stored value or the backend filter
 * format:
 *
 * - A date, or a range of whole days, on a DATE_TIME field is a half-open pair of ordinary
 *   criteria: `>=` the local midnight that starts the first day and `<` the local midnight that
 *   starts the day after the last (so there is no 23:59:59 edge, and a 23 or 25 hour day around a
 *   daylight-saving change is covered exactly).
 * - A relative range ("Last 7 days") is the same pair, but with `StartOfPeriod` expressions for
 *   the bounds, which the backend evaluates in the user's time zone on every query.
 * - Everything is plain criteria, so saved views, URLs, exports and the API keep working with no
 *   new format beyond the one new expression.
 *
 * Time zone arithmetic uses `Intl` only (no library), so it follows the browser's tz database.
 */

import type { PeriodUnit, QFieldType, QFilterCriteria, QQueryFilter, StartOfPeriodExpression, WeekStartName } from '@/types'
import { isCriterionComplete, isStartOfPeriodExpression, localeFirstDayOfWeek, type CriteriaValue } from './filter-utils'

// ------------------------------------------------------------------
// Context: the zone and week start dates are interpreted with
// ------------------------------------------------------------------

/** What dates are interpreted with. */
export interface DateContext {
  /** IANA zone whose midnights bound a day (the browser's; also what is sent to the backend as `X-QQQ-UserTimezone`). */
  timeZone: string
  /** ISO number of the first day of the week: 1 Monday to 7 Sunday. */
  weekStart: number
  /** BCP 47 locale for month names. */
  locale?: string
}

/**
 * The browser's IANA time zone.
 *
 * @returns The zone, or `UTC` when the browser does not report one.
 */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/**
 * The context for the current browser: its zone and its locale's first day of the week.
 *
 * @returns The context.
 */
export function defaultDateContext(): DateContext {
  return { timeZone: browserTimeZone(), weekStart: localeFirstDayOfWeek() }
}

const WEEK_START_NAMES: WeekStartName[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

// ------------------------------------------------------------------
// Calendar dates (YYYY-MM-DD) and time zone arithmetic
// ------------------------------------------------------------------

/** A calendar date, `YYYY-MM-DD`. */
export type Ymd = string

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Whether a value is a real `YYYY-MM-DD` calendar date.
 *
 * @param value - Any value.
 * @returns True for a valid date.
 */
export function isYmd(value: unknown): value is Ymd {
  if (typeof value !== 'string') return false
  const match = YMD.exec(value)
  if (!match) return false
  const [, y, m, d] = match.map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

/**
 * Two-digit zero padding.
 *
 * @param value - A non-negative number below 100.
 * @returns The padded text.
 */
function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * The calendar date of a UTC-midnight Date.
 *
 * @param date - The Date.
 * @returns Its UTC date.
 */
function fromUtcDate(date: Date): Ymd {
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

/**
 * A calendar date as a UTC-midnight Date.
 *
 * @param ymd - The date.
 * @returns The Date.
 */
function toUtcDate(ymd: Ymd): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/**
 * Adds whole days to a calendar date.
 *
 * @param ymd - The date.
 * @param days - Days to add (negative to subtract).
 * @returns The new date.
 */
export function ymdAdd(ymd: Ymd, days: number): Ymd {
  const date = toUtcDate(ymd)
  date.setUTCDate(date.getUTCDate() + days)
  return fromUtcDate(date)
}

const formatters = new Map<string, Intl.DateTimeFormat>()

/**
 * A cached formatter that reads the wall clock in a zone.
 *
 * @param timeZone - IANA zone.
 * @returns The formatter.
 */
function wallFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    formatters.set(timeZone, formatter)
  }
  return formatter
}

/**
 * The wall-clock fields of an instant in a zone.
 *
 * @param ms - The instant, in epoch milliseconds.
 * @param timeZone - IANA zone.
 * @returns Year, month, day, hour, minute and second there.
 */
function wallParts(ms: number, timeZone: string): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const parts: Record<string, number> = {}
  for (const part of wallFormatter(timeZone).formatToParts(new Date(ms))) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value)
  }
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour === 24 ? 0 : parts.hour, minute: parts.minute, second: parts.second }
}

/**
 * Milliseconds a zone is ahead of UTC at an instant.
 *
 * @param ms - The instant, in epoch milliseconds.
 * @param timeZone - IANA zone.
 * @returns The offset in milliseconds.
 */
export function zoneOffsetMs(ms: number, timeZone: string): number {
  const seconds = Math.floor(ms / 1000) * 1000
  const w = wallParts(seconds, timeZone)
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - seconds
}

/**
 * The calendar date an instant falls on in a zone.
 *
 * @param ms - The instant, in epoch milliseconds.
 * @param timeZone - IANA zone.
 * @returns The date there.
 */
export function ymdOfInstant(ms: number, timeZone: string): Ymd {
  const w = wallParts(ms, timeZone)
  return `${String(w.year).padStart(4, '0')}-${pad(w.month)}-${pad(w.day)}`
}

/**
 * The first instant of a calendar date in a zone: its local midnight, or, where a daylight-saving
 * change skips midnight, the first moment of the day. Matches Java's `LocalDate.atStartOfDay(zone)`
 * (which is what the backend's `StartOfPeriod` uses).
 *
 * @param ymd - The date.
 * @param timeZone - IANA zone.
 * @returns The instant, in epoch milliseconds.
 */
export function startOfDayMs(ymd: Ymd, timeZone: string): number {
  const utcMidnight = toUtcDate(ymd).getTime()
  const DAY = 86_400_000
  // The offsets in effect a day either side bracket any change that touches this day's midnight.
  const candidates = new Set([zoneOffsetMs(utcMidnight - DAY, timeZone), zoneOffsetMs(utcMidnight + DAY, timeZone)])
  const valid = [...candidates].map((offset) => utcMidnight - offset).filter((ms) => ymdOfInstant(ms, timeZone) === ymd)
  return valid.length > 0 ? Math.min(...valid) : utcMidnight - zoneOffsetMs(utcMidnight, timeZone)
}

/**
 * Formats an instant as the QQQ wire value: ISO-8601 UTC, without a zero millisecond part.
 *
 * @param ms - The instant, in epoch milliseconds.
 * @returns `yyyy-MM-ddTHH:mm:ssZ` (or with `.SSS` when not a whole second).
 */
export function toWireInstant(ms: number): string {
  return new Date(ms).toISOString().replace(/\.000Z$/, 'Z')
}

/**
 * The start of a calendar date in a zone, as a wire value.
 *
 * @param ymd - The date.
 * @param timeZone - IANA zone.
 * @returns The instant of its first moment, e.g. `2026-10-01T05:00:00Z` for Oct 1 in Chicago.
 */
export function startOfDayWire(ymd: Ymd, timeZone: string): string {
  return toWireInstant(startOfDayMs(ymd, timeZone))
}

const ZONED = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i

/**
 * Reads a wire instant (ISO-8601 with a zone) that is exactly the first moment of a day in a zone.
 *
 * @param value - A criterion value.
 * @param timeZone - IANA zone.
 * @returns The date it starts, or `null` when it is any other value (a time of day, text, an expression).
 */
export function dayStartedBy(value: unknown, timeZone: string): Ymd | null {
  if (typeof value !== 'string' || !ZONED.test(value.trim())) return null
  const ms = Date.parse(value.trim())
  if (Number.isNaN(ms)) return null
  const ymd = ymdOfInstant(ms, timeZone)
  return startOfDayMs(ymd, timeZone) === ms ? ymd : null
}

/**
 * The calendar date a typed or stored value falls on in a zone: a `YYYY-MM-DD`, a local
 * `YYYY-MM-DDTHH:mm` (taken as written), or a zoned instant (converted to the zone).
 *
 * @param value - A criterion value.
 * @param timeZone - IANA zone.
 * @returns The date, or `null` for anything else.
 */
export function dateOfValue(value: unknown, timeZone: string): Ymd | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (ZONED.test(text)) {
    const ms = Date.parse(text)
    return Number.isNaN(ms) ? null : ymdOfInstant(ms, timeZone)
  }
  const head = text.slice(0, 10)
  return isYmd(head) && (text.length === 10 || text[10] === 'T') ? head : null
}

// ------------------------------------------------------------------
// Periods and the StartOfPeriod expression
// ------------------------------------------------------------------

/**
 * ISO day of the week of a date.
 *
 * @param ymd - The date.
 * @returns 1 Monday to 7 Sunday.
 */
function isoDayOfWeek(ymd: Ymd): number {
  const day = toUtcDate(ymd).getUTCDay()
  return day === 0 ? 7 : day
}

/**
 * The first day of the period that is `offset` periods from the one containing a date.
 *
 * @param today - A date inside the base period.
 * @param unit - The period.
 * @param offset - Whole periods to move (negative for the past).
 * @param weekStart - ISO first day of the week (for `WEEKS`).
 * @returns The first day of that period.
 */
export function periodStart(today: Ymd, unit: PeriodUnit, offset: number, weekStart = 7): Ymd {
  const [y, m] = today.split('-').map(Number)
  switch (unit) {
    case 'DAYS':
      return ymdAdd(today, offset)
    case 'WEEKS':
      return ymdAdd(today, -((isoDayOfWeek(today) - weekStart + 7) % 7) + 7 * offset)
    case 'MONTHS':
      return fromUtcDate(new Date(Date.UTC(y, m - 1 + offset, 1)))
    case 'QUARTERS':
      return fromUtcDate(new Date(Date.UTC(y, Math.floor((m - 1) / 3) * 3 + 3 * offset, 1)))
    case 'YEARS':
      return fromUtcDate(new Date(Date.UTC(y + offset, 0, 1)))
  }
}

/**
 * A `StartOfPeriod` expression. The week start is stamped on week periods, so a saved view means
 * the same thing for everyone who opens it; the time zone is left to the session.
 *
 * @param unit - The period.
 * @param offset - Whole periods from the current one.
 * @param weekStart - ISO first day of the week (used for `WEEKS`).
 * @returns The expression.
 */
export function startOfPeriod(unit: PeriodUnit, offset: number, weekStart = 7): StartOfPeriodExpression {
  return { type: 'StartOfPeriod', unit, offset, ...(unit === 'WEEKS' ? { weekStart: WEEK_START_NAMES[weekStart - 1] } : {}) }
}

/**
 * The ISO first day of the week an expression names.
 *
 * @param expression - The expression.
 * @returns 1 Monday to 7 Sunday; Sunday when it names none, as the backend does.
 */
function weekStartOf(expression: StartOfPeriodExpression): number {
  const index = expression.weekStart ? WEEK_START_NAMES.indexOf(expression.weekStart) : -1
  return index >= 0 ? index + 1 : 7
}

/**
 * Evaluates a `StartOfPeriod` expression the way the backend does.
 *
 * @param expression - The expression.
 * @param now - The current moment.
 * @param timeZone - IANA zone ("today" is the date in it).
 * @returns The first day of the period.
 */
export function evaluateStartOfPeriod(expression: StartOfPeriodExpression, now: Date, timeZone: string): Ymd {
  return periodStart(ymdOfInstant(now.getTime(), timeZone), expression.unit, expression.offset, weekStartOf(expression))
}

// ------------------------------------------------------------------
// Relative ranges and presets
// ------------------------------------------------------------------

/**
 * A relative range of whole days: from the start of the period `start` periods away, up to (not
 * including) the start of the period `end` periods away. "Last 7 days" is days -6 to 1.
 */
export interface RelativeRange {
  /** The period the bounds snap to. */
  unit: PeriodUnit
  /** Periods from the current one to the first included period. */
  start: number
  /** Periods from the current one to the first period not included. */
  end: number
}

/** A named range offered in the picker. */
export interface RangePreset {
  /** Stable id. */
  id: string
  /** Label shown. */
  label: string
  /** The range. */
  range: RelativeRange
}

export const RANGE_PRESETS: RangePreset[] = [
  { id: 'today', label: 'Today', range: { unit: 'DAYS', start: 0, end: 1 } },
  { id: 'yesterday', label: 'Yesterday', range: { unit: 'DAYS', start: -1, end: 0 } },
  { id: 'last7', label: 'Last 7 days', range: { unit: 'DAYS', start: -6, end: 1 } },
  { id: 'last30', label: 'Last 30 days', range: { unit: 'DAYS', start: -29, end: 1 } },
  { id: 'thisWeek', label: 'This week', range: { unit: 'WEEKS', start: 0, end: 1 } },
  { id: 'lastWeek', label: 'Last week', range: { unit: 'WEEKS', start: -1, end: 0 } },
  { id: 'thisMonth', label: 'This month', range: { unit: 'MONTHS', start: 0, end: 1 } },
  { id: 'lastMonth', label: 'Last month', range: { unit: 'MONTHS', start: -1, end: 0 } },
  { id: 'thisQuarter', label: 'This quarter', range: { unit: 'QUARTERS', start: 0, end: 1 } },
  { id: 'lastQuarter', label: 'Last quarter', range: { unit: 'QUARTERS', start: -1, end: 0 } },
  { id: 'thisYear', label: 'This year', range: { unit: 'YEARS', start: 0, end: 1 } },
  { id: 'lastYear', label: 'Last year', range: { unit: 'YEARS', start: -1, end: 0 } },
]

/** Units a custom "last N" range offers. */
export type LastUnit = 'DAYS' | 'WEEKS' | 'MONTHS'

/**
 * A custom "last N days / weeks / months" range. Days run up to and including today; weeks and
 * months are the N complete ones before the current one (so "Last 1 week" is "Last week").
 *
 * @param count - How many.
 * @param unit - Days, weeks or months.
 * @returns The range.
 */
export function lastRange(count: number, unit: LastUnit): RelativeRange {
  const n = Math.max(1, Math.trunc(count) || 1)
  return unit === 'DAYS' ? { unit, start: 1 - n, end: 1 } : { unit, start: -n, end: 0 }
}

/**
 * The preset a range is, if it is one.
 *
 * @param range - The range.
 * @returns The preset, or `undefined`.
 */
export function presetOf(range: RelativeRange): RangePreset | undefined {
  return RANGE_PRESETS.find((p) => p.range.unit === range.unit && p.range.start === range.start && p.range.end === range.end)
}

/**
 * Reads a range as "Last N days/weeks/months", when it is one (and not already a named preset).
 *
 * @param range - The range.
 * @returns The count and unit, or `null`.
 */
export function asLastRange(range: RelativeRange): { count: number; unit: LastUnit } | null {
  if (range.unit === 'DAYS' && range.end === 1 && range.start <= 0) return { count: 1 - range.start, unit: 'DAYS' }
  if ((range.unit === 'WEEKS' || range.unit === 'MONTHS') && range.end === 0 && range.start < 0) return { count: -range.start, unit: range.unit }
  return null
}

/**
 * Plain-language name of a range.
 *
 * @param range - The range.
 * @returns For example "Last 7 days", "This month", or "Last 3 months".
 */
export function describeRange(range: RelativeRange): string {
  const preset = presetOf(range)
  if (preset) return preset.label
  const last = asLastRange(range)
  if (last) return `Last ${last.count} ${last.unit.toLowerCase().slice(0, -1)}${last.count === 1 ? '' : 's'}`
  const unit = range.unit.toLowerCase().slice(0, -1)
  return `${unit} ${range.start} to ${range.end}`
}

/**
 * The two bound expressions of a range: `>=` the first and `<` the second.
 *
 * @param range - The range.
 * @param weekStart - ISO first day of the week.
 * @returns The bounds.
 */
export function rangeExpressions(range: RelativeRange, weekStart = 7): [StartOfPeriodExpression, StartOfPeriodExpression] {
  return [startOfPeriod(range.unit, range.start, weekStart), startOfPeriod(range.unit, range.end, weekStart)]
}

/**
 * Reads two bound expressions as a range.
 *
 * @param from - The `>=` bound.
 * @param to - The `<` bound.
 * @returns The range, or `null` when they are not a matching pair.
 */
export function rangeOfExpressions(from: unknown, to: unknown): RelativeRange | null {
  if (!isStartOfPeriodExpression(from) || !isStartOfPeriodExpression(to)) return null
  if (from.unit !== to.unit || from.timeZoneId !== to.timeZoneId) return null
  if (from.unit === 'WEEKS' && weekStartOf(from) !== weekStartOf(to)) return null
  return { unit: from.unit, start: from.offset, end: to.offset }
}

/**
 * The days a relative range covers right now.
 *
 * @param range - The range.
 * @param now - The current moment.
 * @param context - Zone and week start.
 * @returns The first and last day included.
 */
export function rangeDays(range: RelativeRange, now: Date, context: DateContext): { from: Ymd; to: Ymd } {
  const today = ymdOfInstant(now.getTime(), context.timeZone)
  return { from: periodStart(today, range.unit, range.start, context.weekStart), to: ymdAdd(periodStart(today, range.unit, range.end, context.weekStart), -1) }
}

// ------------------------------------------------------------------
// A date condition: what the person picked
// ------------------------------------------------------------------

/** How a date or range of dates is compared. */
export type DateMode = 'on' | 'between' | 'within' | 'before' | 'onOrBefore' | 'after' | 'onOrAfter' | 'notOn' | 'notBetween' | 'empty' | 'notEmpty'

/** The dates (or relative range) a person picked. */
export interface DateCondition {
  /** The comparison. */
  mode: DateMode
  /** The date (first date for "between"); empty until picked. */
  from: Ymd | ''
  /** The last date for "between"; empty until picked. */
  to: Ymd | ''
  /** The range for "within". */
  range: RelativeRange
}

/** The relative range a new "within" condition starts with. */
export const DEFAULT_RANGE: RelativeRange = RANGE_PRESETS[2].range

/**
 * A new, empty condition.
 *
 * @param mode - The comparison.
 * @returns The condition with no dates picked.
 */
export function emptyDateCondition(mode: DateMode = 'on'): DateCondition {
  return { mode, from: '', to: '', range: DEFAULT_RANGE }
}

/**
 * Whether a condition has everything it needs to be part of a filter.
 *
 * @param condition - The condition.
 * @returns True when complete.
 */
export function isDateConditionComplete(condition: DateCondition): boolean {
  switch (condition.mode) {
    case 'within':
    case 'empty':
    case 'notEmpty':
      return true
    case 'between':
    case 'notBetween':
      return isYmd(condition.from) && isYmd(condition.to) && condition.to >= condition.from
    default:
      return isYmd(condition.from)
  }
}

const MODE_OPERATOR: Record<DateMode, QFilterCriteria['operator']> = {
  on: 'EQUALS',
  between: 'BETWEEN',
  within: 'GREATER_THAN_OR_EQUALS',
  before: 'LESS_THAN',
  onOrBefore: 'LESS_THAN_OR_EQUALS',
  after: 'GREATER_THAN',
  onOrAfter: 'GREATER_THAN_OR_EQUALS',
  notOn: 'NOT_EQUALS_OR_IS_NULL',
  notBetween: 'NOT_BETWEEN',
  empty: 'IS_BLANK',
  notEmpty: 'IS_NOT_BLANK',
}

const OPERATOR_MODE: Partial<Record<QFilterCriteria['operator'], DateMode>> = {
  EQUALS: 'on',
  BETWEEN: 'between',
  LESS_THAN: 'before',
  LESS_THAN_OR_EQUALS: 'onOrBefore',
  GREATER_THAN: 'after',
  GREATER_THAN_OR_EQUALS: 'onOrAfter',
  NOT_EQUALS_OR_IS_NULL: 'notOn',
  NOT_BETWEEN: 'notBetween',
  IS_BLANK: 'empty',
  IS_NOT_BLANK: 'notEmpty',
}

/**
 * The criteria for a condition. An incomplete condition is one placeholder criterion with no
 * values (never sent to the backend); its operator records the comparison.
 *
 * @param fieldName - The field.
 * @param fieldType - DATE or DATE_TIME.
 * @param condition - What was picked.
 * @param context - Zone and week start.
 * @returns One criterion, or two (a `>=` and a `<` bound) for a DATE_TIME day, range or relative range.
 */
export function dateConditionToCriteria(fieldName: string, fieldType: QFieldType, condition: DateCondition, context: DateContext): QFilterCriteria[] {
  const make = (operator: QFilterCriteria['operator'], values: CriteriaValue[]): QFilterCriteria => ({ fieldName, operator, values })
  if (condition.mode === 'empty' || condition.mode === 'notEmpty') return [make(MODE_OPERATOR[condition.mode], [])]
  if (!isDateConditionComplete(condition)) return [make(MODE_OPERATOR[condition.mode], [])]

  const { from, to } = condition
  if (condition.mode === 'within') {
    const [start, end] = rangeExpressions(condition.range, context.weekStart)
    return [make('GREATER_THAN_OR_EQUALS', [start]), make('LESS_THAN', [end])]
  }
  if (fieldType === 'DATE') {
    if (condition.mode === 'between' || condition.mode === 'notBetween') return [make(MODE_OPERATOR[condition.mode], [from, to])]
    return [make(MODE_OPERATOR[condition.mode], [from])]
  }

  const start = (ymd: Ymd) => startOfDayWire(ymd, context.timeZone)
  switch (condition.mode) {
    case 'on':
      return [make('GREATER_THAN_OR_EQUALS', [start(from)]), make('LESS_THAN', [start(ymdAdd(from, 1))])]
    case 'between':
      return [make('GREATER_THAN_OR_EQUALS', [start(from)]), make('LESS_THAN', [start(ymdAdd(to, 1))])]
    case 'before':
      return [make('LESS_THAN', [start(from)])]
    case 'onOrBefore':
      return [make('LESS_THAN', [start(ymdAdd(from, 1))])]
    case 'after':
      return [make('GREATER_THAN_OR_EQUALS', [start(ymdAdd(from, 1))])]
    case 'onOrAfter':
      return [make('GREATER_THAN_OR_EQUALS', [start(from)])]
    default:
      // "is not on" / "is not between" have no whole-day form on a DATE_TIME field: those are "Include time" conditions
      return [make(MODE_OPERATOR[condition.mode], [])]
  }
}

/**
 * Reads criteria back into the dates a person would pick.
 *
 * @param criteria - The one or two criteria of a row, in order.
 * @param fieldType - DATE or DATE_TIME.
 * @param context - Zone and week start.
 * @returns The condition, or `null` when the criteria need exact times (or are something this does not model).
 */
export function criteriaToDateCondition(criteria: QFilterCriteria[], fieldType: QFieldType, context: DateContext): DateCondition | null {
  if (criteria.length === 0 || criteria.length > 2) return null
  if (criteria.some((c) => c.fieldFunction || c.otherFieldName)) return null
  const first = criteria[0]
  const filled = (c: QFilterCriteria) => (c.values ?? []).filter((v) => v !== null && v !== undefined && String(typeof v === 'object' ? 'x' : v).trim() !== '')

  if (criteria.length === 2) {
    const second = criteria[1]
    if (first.fieldName !== second.fieldName || first.operator !== 'GREATER_THAN_OR_EQUALS' || second.operator !== 'LESS_THAN') return null
    const lo = filled(first)[0]
    const hi = filled(second)[0]
    const range = rangeOfExpressions(lo, hi)
    if (range) return { mode: 'within', from: '', to: '', range }
    const loYmd = fieldType === 'DATE' ? (isYmd(lo) ? lo : null) : dayStartedBy(lo, context.timeZone)
    const hiYmd = fieldType === 'DATE' ? (isYmd(hi) ? hi : null) : dayStartedBy(hi, context.timeZone)
    if (!loYmd || !hiYmd || hiYmd <= loYmd) return null
    const last = ymdAdd(hiYmd, -1)
    return last === loYmd ? { mode: 'on', from: loYmd, to: '', range: DEFAULT_RANGE } : { mode: 'between', from: loYmd, to: last, range: DEFAULT_RANGE }
  }

  const mode = OPERATOR_MODE[first.operator]
  if (!mode) return null
  const values = filled(first)
  if (mode === 'empty' || mode === 'notEmpty') return { ...emptyDateCondition(mode) }
  if (values.length === 0) return emptyDateCondition(mode)

  if (fieldType === 'DATE') {
    const picked = values.map((v) => (isYmd(v) ? v : null))
    if (picked.some((v) => v === null)) return null
    if (mode === 'between' || mode === 'notBetween') return picked.length === 2 ? { mode, from: picked[0]!, to: picked[1]!, range: DEFAULT_RANGE } : null
    return picked.length === 1 ? { mode, from: picked[0]!, to: '', range: DEFAULT_RANGE } : null
  }

  // DATE_TIME: only a bound that is exactly a local midnight is a whole-day bound
  const day = dayStartedBy(values[0], context.timeZone)
  if (values.length !== 1 || !day) return null
  if (mode === 'onOrAfter') return { mode: 'onOrAfter', from: day, to: '', range: DEFAULT_RANGE }
  if (mode === 'before') return { mode: 'before', from: day, to: '', range: DEFAULT_RANGE }
  return null
}

// ------------------------------------------------------------------
// "Include time": a condition as exact date-times, and back
// ------------------------------------------------------------------

/**
 * A date condition as one exact date-time criterion, for switching "Include time" on. The values
 * are local date-times (`YYYY-MM-DDTHH:mm`), as the date-time inputs hold them, which are turned
 * into instants when the filter is sent. A day spans 00:00 to 23:59:59.999.
 *
 * @param fieldName - The field.
 * @param condition - What was picked.
 * @param context - Zone and week start.
 * @param now - The current moment (to resolve a relative range).
 * @returns The criterion.
 */
export function dateConditionToExactCriterion(fieldName: string, condition: DateCondition, context: DateContext, now: Date): QFilterCriteria {
  const startOf = (ymd: Ymd) => `${ymd}T00:00`
  const endOf = (ymd: Ymd) => `${ymd}T23:59:59.999`
  const make = (operator: QFilterCriteria['operator'], values: CriteriaValue[]): QFilterCriteria => ({ fieldName, operator, values })
  if (!isDateConditionComplete(condition)) return make(MODE_OPERATOR[condition.mode === 'within' ? 'between' : condition.mode], [])
  switch (condition.mode) {
    case 'within': {
      const days = rangeDays(condition.range, now, context)
      return make('BETWEEN', [startOf(days.from), endOf(days.to)])
    }
    case 'on':
      return make('BETWEEN', [startOf(condition.from), endOf(condition.from)])
    case 'between':
      return make('BETWEEN', [startOf(condition.from), endOf(condition.to)])
    case 'before':
      return make('LESS_THAN', [startOf(condition.from)])
    case 'onOrBefore':
      return make('LESS_THAN_OR_EQUALS', [endOf(condition.from)])
    case 'after':
      return make('GREATER_THAN', [endOf(condition.from)])
    case 'onOrAfter':
      return make('GREATER_THAN_OR_EQUALS', [startOf(condition.from)])
    default:
      return make(MODE_OPERATOR[condition.mode], [])
  }
}

/**
 * An exact date-time criterion as the dates it falls on, for switching "Include time" off.
 *
 * @param criterion - The criterion.
 * @param context - Zone and week start.
 * @returns The condition, or `null` when it has no whole-day form (a relative or empty condition).
 */
export function exactCriterionToDateCondition(criterion: QFilterCriteria, context: DateContext): DateCondition | null {
  const mode = OPERATOR_MODE[criterion.operator]
  if (!mode || criterion.fieldFunction) return null
  if (mode === 'empty' || mode === 'notEmpty') return emptyDateCondition(mode)
  const dates = (criterion.values ?? []).map((v) => dateOfValue(v, context.timeZone))
  if (dates.length === 0 || dates.some((d) => d === null)) return null
  if (mode === 'notOn' || mode === 'notBetween') return null
  if (mode === 'between') return dates.length === 2 ? { mode, from: dates[0]!, to: dates[1]!, range: DEFAULT_RANGE } : null
  return dates.length === 1 ? { mode, from: dates[0]!, to: '', range: DEFAULT_RANGE } : null
}

// ------------------------------------------------------------------
// Plain language
// ------------------------------------------------------------------

/**
 * A date as plain text.
 *
 * @param ymd - The date.
 * @param withYear - Whether to include the year.
 * @param locale - BCP 47 locale; defaults to the browser's.
 * @returns For example "Oct 1" or "Oct 1, 2026".
 */
export function formatYmd(ymd: Ymd, withYear = true, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}) }).format(toUtcDate(ymd))
}

/**
 * A range of dates as plain text, with the year said once when both ends are in it.
 *
 * @param from - First day.
 * @param to - Last day.
 * @param locale - BCP 47 locale.
 * @returns For example "Oct 1 – Oct 12, 2026", or just "Oct 12, 2026" for one day.
 */
export function formatYmdRange(from: Ymd, to: Ymd, locale?: string): string {
  if (from === to) return formatYmd(from, true, locale)
  const sameYear = from.slice(0, 4) === to.slice(0, 4)
  return `${formatYmd(from, !sameYear, locale)} – ${formatYmd(to, true, locale)}`
}

/** The label of each comparison, as the operator list shows it. */
export const DATE_MODE_LABELS: Record<DateMode, string> = {
  on: 'is on',
  between: 'is between',
  within: 'is within',
  before: 'is before',
  onOrBefore: 'is on or before',
  after: 'is after',
  onOrAfter: 'is on or after',
  notOn: 'is not on',
  notBetween: 'is not between',
  empty: 'is empty',
  notEmpty: 'is not empty',
}

/**
 * A condition in plain language, for a chip: "Oct 1 – Oct 12, 2026", "Today", "before Oct 5, 2026".
 *
 * @param condition - The condition.
 * @param locale - BCP 47 locale.
 * @returns The text, or `''` for an incomplete condition.
 */
export function describeDateCondition(condition: DateCondition, locale?: string): string {
  if (condition.mode === 'empty') return 'is empty'
  if (condition.mode === 'notEmpty') return 'is not empty'
  if (condition.mode === 'within') return describeRange(condition.range)
  if (!isDateConditionComplete(condition)) return ''
  const from = formatYmd(condition.from as Ymd, true, locale)
  switch (condition.mode) {
    case 'on':
      return from
    case 'between':
      return formatYmdRange(condition.from as Ymd, condition.to as Ymd, locale)
    case 'notBetween':
      return `not ${formatYmdRange(condition.from as Ymd, condition.to as Ymd, locale)}`
    case 'notOn':
      return `not ${from}`
    default:
      return `${DATE_MODE_LABELS[condition.mode].replace(/^is /, '')} ${from}`
  }
}

/**
 * The time zone, named for a tooltip: "America/Chicago (CDT)".
 *
 * @param timeZone - IANA zone.
 * @param at - The moment the abbreviation applies to.
 * @returns The zone and its current abbreviation.
 */
export function describeTimeZone(timeZone: string, at: Date = new Date()): string {
  try {
    const abbreviation = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }).formatToParts(at).find((p) => p.type === 'timeZoneName')?.value
    return abbreviation && abbreviation !== timeZone ? `${timeZone} (${abbreviation})` : timeZone
  } catch {
    return timeZone
  }
}

/**
 * The sentence the filter shows (and a tooltip repeats) about which zone dates are read in.
 *
 * @param timeZone - IANA zone.
 * @param weekStart - ISO first day of the week.
 * @returns The text.
 */
export function timeZoneNote(timeZone: string, weekStart: number): string {
  const day = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][weekStart - 1]
  return `Days start and end at midnight in your time zone, ${describeTimeZone(timeZone)}. Weeks start on ${day}.`
}

// ------------------------------------------------------------------
// Counting
// ------------------------------------------------------------------

/**
 * Counts the conditions a person sees in a filter: complete criteria, with a date range (its `>=`
 * and `<` bounds) counted once, including nested sub-filters.
 *
 * @param filter - The filter.
 * @param typeOf - Looks up a field's type by name.
 * @param context - Zone and week start.
 * @returns The number of conditions.
 */
export function countFilterConditions(filter: QQueryFilter, typeOf: (fieldName: string) => QFieldType | undefined, context: DateContext = defaultDateContext()): number {
  const complete = (filter.criteria ?? []).filter(isCriterionComplete)
  let count = 0
  for (let i = 0; i < complete.length; i++) {
    const type = typeOf(complete[i].fieldName)
    const next = complete[i + 1]
    if (filter.booleanOperator !== 'OR' && next && (type === 'DATE' || type === 'DATE_TIME') && criteriaToDateCondition([complete[i], next], type, context)) i++
    count++
  }
  for (const sub of filter.subFilters ?? []) count += countFilterConditions(sub, typeOf, context)
  return count
}
