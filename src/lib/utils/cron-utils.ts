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
 * @file cron-utils — Quartz cron expressions for the schedule editor: a
 * human-readable describer that follows the backend's `CronDescriber` (so the
 * live description matches the one QQQ stores), Quartz range checks, and the
 * Basic-mode model (days, hours and minutes) of the Material `CronUIWidget`.
 */

/** A cron expression that cannot be described or is not valid. */
export class CronParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CronParseError'
  }
}

type CronField = 'SECONDS' | 'MINUTES' | 'HOURS' | 'DAY_OF_MONTH' | 'MONTH' | 'DAY_OF_WEEK' | 'YEAR'

interface FieldSpec {
  min: number
  max: number
  singular: string
  plural: string
  /** Label used in range errors. */
  rangeLabel: string
}

const FIELD_SPECS: Record<CronField, FieldSpec> = {
  SECONDS: { min: 0, max: 59, singular: 'second', plural: 'seconds', rangeLabel: 'Second' },
  MINUTES: { min: 0, max: 59, singular: 'minute', plural: 'minutes', rangeLabel: 'Minute' },
  HOURS: { min: 0, max: 23, singular: 'hour', plural: 'hours', rangeLabel: 'Hour' },
  DAY_OF_MONTH: { min: 1, max: 31, singular: 'day', plural: 'days', rangeLabel: 'Day of month' },
  MONTH: { min: 1, max: 12, singular: 'month', plural: 'months', rangeLabel: 'Month' },
  DAY_OF_WEEK: { min: 1, max: 7, singular: 'day', plural: 'days', rangeLabel: 'Day of week' },
  YEAR: { min: 1970, max: Number.MAX_SAFE_INTEGER, singular: 'year', plural: 'years', rangeLabel: 'Year' },
}

/** Weekdays in Quartz numbering (1 = Sunday). */
export const CRON_WEEKDAYS = [
  { number: 1, short: 'SUN', label: 'Sunday' },
  { number: 2, short: 'MON', label: 'Monday' },
  { number: 3, short: 'TUE', label: 'Tuesday' },
  { number: 4, short: 'WED', label: 'Wednesday' },
  { number: 5, short: 'THU', label: 'Thursday' },
  { number: 6, short: 'FRI', label: 'Friday' },
  { number: 7, short: 'SAT', label: 'Saturday' },
] as const

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const

interface Scalar { kind: 'scalar'; value: number }
interface Range { kind: 'range'; from: number; to: number }
interface Step { kind: 'step'; range: Range; stepSize: number }
type Token = Scalar | Range | Step

const scalar = (value: number): Scalar => ({ kind: 'scalar', value })

/**
 * A range, or a scalar when both ends are the same (as the backend's `Range.of` does).
 *
 * @param from - First value.
 * @param to - Last value.
 * @returns The token.
 */
function rangeOf(from: number, to: number): Scalar | Range {
  return from === to ? scalar(from) : { kind: 'range', from, to }
}

/**
 * Splits once on a separator, keeping empty sides (Java `split(sep, 2)`).
 *
 * @param input - Text to split.
 * @param separator - Separator character.
 * @returns One element when the separator is absent, else two.
 */
function splitOnce(input: string, separator: string): string[] {
  const index = input.indexOf(separator)
  return index < 0 ? [input] : [input.slice(0, index), input.slice(index + 1)]
}

/**
 * Splits on commas, dropping trailing empty parts (Java `split(",")`).
 *
 * @param input - A cron field.
 * @returns The comma-separated parts.
 */
function splitCommas(input: string): string[] {
  const parts = input.split(',')
  while (parts.length > 1 && parts[parts.length - 1] === '') parts.pop()
  return parts
}

const isInt = (input: string) => /^[+-]?\d+$/.test(input)

/**
 * Parses one value of a field: a number, or a weekday/month abbreviation.
 *
 * @param input - The value text.
 * @param field - The cron field.
 * @returns The numeric value.
 * @throws {CronParseError} When the value is not recognized.
 */
function parseToInt(input: string, field: CronField): number {
  if (isInt(input)) return Number.parseInt(input, 10)
  const abbreviation = input.toUpperCase().slice(0, 3)
  if (field === 'DAY_OF_WEEK') {
    const weekday = CRON_WEEKDAYS.find((day) => day.short === abbreviation)
    if (weekday) return weekday.number
    throw new CronParseError(`Invalid day of week: [${input}]`)
  }
  if (field === 'MONTH') {
    const month = MONTHS.indexOf(abbreviation as (typeof MONTHS)[number])
    if (month >= 0) return month + 1
    throw new CronParseError(`Invalid month: [${input}]`)
  }
  throw new CronParseError(`Invalid number: [${input}]`)
}

/**
 * Parses the range side of a field part (`*`, `a-b`, or `a` meaning `a` to the maximum).
 *
 * @param input - Range text.
 * @param field - The cron field.
 * @returns The range, or a scalar for a one-value range.
 */
function parseRange(input: string, field: CronField): Scalar | Range {
  const spec = FIELD_SPECS[field]
  if (input === '*') return rangeOf(spec.min, spec.max)
  if (!input.includes('-')) return rangeOf(parseToInt(input, field), spec.max)
  const parts = splitOnce(input, '-')
  if (parts.length !== 2 || parts[0] === '' || parts[1] === '') throw new CronParseError(`Incomplete range expression: [${input}]`)
  if (parts[0] === '*') return rangeOf(spec.min, spec.max)
  if (field === 'DAY_OF_WEEK' || field === 'MONTH') {
    const numeric0 = isInt(parts[0]) || parts[0] === '*'
    const numeric1 = isInt(parts[1]) || parts[1] === '*'
    if (numeric0 !== numeric1) throw new CronParseError(`Range may not mix words and numbers: [${input}]`)
    if (parts[0].length > 3) return scalar(parseToInt(parts[0], field))
  }
  return rangeOf(parseToInt(parts[0], field), parseToInt(parts[1], field))
}

/**
 * Tokenizes a cron field into scalars, ranges and steps.
 *
 * @param input - The field text.
 * @param field - The cron field.
 * @returns The tokens.
 */
function tokenize(input: string, field: CronField): Token[] {
  const spec = FIELD_SPECS[field]
  return splitCommas(input).map((part): Token => {
    if (part.includes('/')) {
      const [rangeText, stepText] = splitOnce(part, '/')
      const range = parseRange(rangeText, field)
      if (range.kind === 'scalar') return range
      return { kind: 'step', range, stepSize: parseToInt(stepText, field) }
    }
    if (part.includes('-')) return parseRange(part, field)
    if (part === '*') return { kind: 'range', from: spec.min, to: spec.max }
    return scalar(parseToInt(part, field))
  })
}

const zeroPadded = (value: number) => (value < 10 ? `0${value}` : String(value))
const twelveHour = (hour: number) => (hour === 0 || hour === 12 ? 12 : hour < 12 ? hour : hour - 12)
const amPm = (hour: number) => (hour < 12 ? 'am' : 'pm')

/**
 * An ordinal day of the month: 1st, 2nd, 3rd, 11th, 12th, 13th, 21st...
 *
 * @param day - Day of the month.
 * @returns The ordinal text.
 */
export function ordinalDay(day: number): string {
  const teen = day % 100 >= 11 && day % 100 <= 13
  const suffix = teen ? 'th' : day % 10 === 1 ? 'st' : day % 10 === 2 ? 'nd' : day % 10 === 3 ? 'rd' : 'th'
  return `${day}${suffix}`
}

/**
 * An hour as the schedule editor shows it: 12am, 9am, 12pm, 5pm.
 *
 * @param hour - Hour of the day, 0 to 23.
 * @returns The hour text.
 */
export function hourLabel(hour: number): string {
  return `${twelveHour(hour)}${amPm(hour)}`
}

/**
 * A minute as the schedule editor shows it: 00, 05, 30.
 *
 * @param minute - Minute of the hour, 0 to 59.
 * @returns The minute text.
 */
export function minuteLabel(minute: number): string {
  return zeroPadded(minute)
}

/**
 * One value in words: month and weekday names, ordinal days, padded minutes, 12-hour hours.
 *
 * @param value - The value.
 * @param field - The cron field.
 * @returns The text.
 */
function scalarText(value: number, field: CronField): string {
  switch (field) {
    case 'MONTH': return MONTH_NAMES[value - 1] ?? String(value)
    case 'DAY_OF_WEEK': return CRON_WEEKDAYS[value - 1]?.label ?? String(value)
    case 'DAY_OF_MONTH': return ordinalDay(value)
    case 'MINUTES':
    case 'SECONDS': return zeroPadded(value)
    case 'HOURS': return hourLabel(value)
    default: return String(value)
  }
}

/**
 * A token in words: a value, `a and b` for a range, or `every n units between a and b` for a step.
 *
 * @param token - The token.
 * @param field - The cron field.
 * @returns The text.
 */
function tokenText(token: Token, field: CronField): string {
  if (token.kind === 'scalar') return scalarText(token.value, field)
  if (token.kind === 'range') return `${scalarText(token.from, field)} and ${scalarText(token.to, field)}`
  const spec = FIELD_SPECS[field]
  const every = token.stepSize === 1 ? spec.singular : `${token.stepSize} ${spec.plural}`
  return `every ${every} between ${field === 'DAY_OF_MONTH' ? 'the ' : ''}${tokenText(token.range, field)}`
}

/**
 * Joins phrases as the backend does: `a`, `a and b`, `a, b, and c`.
 *
 * @param parts - Phrases.
 * @returns The joined text.
 */
function joinWithCommasAndAnd(parts: string[]): string {
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return parts.map((part, index) => (index === 0 ? part : index === parts.length - 1 ? `, and ${part}` : `, ${part}`)).join('')
}

const isPlural = (tokens: Token[]) => !(tokens.length === 1 && isSingle(tokens[0]))
const isSingle = (token: Token) => token.kind === 'scalar' || (token.kind === 'range' && token.from === token.to)

/**
 * The phrase for a field's tokens, such as `at minutes 00 and 30` or `on Monday, Wednesday, and Friday`.
 *
 * @param tokens - The field's tokens.
 * @param field - The cron field.
 * @param prefix - Word before the first value of a run (`at`, `on`, `in`).
 * @param labelOverride - Unit label after the prefix, instead of the field's singular or plural label.
 * @param wordAfterBetween - Word after "between" in a range (`the` for days of the month).
 * @returns The phrase.
 */
function buildPhrase(tokens: Token[], field: CronField, prefix: string, labelOverride: string | null, wordAfterBetween: string | null): string {
  const spec = FIELD_SPECS[field]
  let needPrefix = true
  const parts = tokens.map((token, index) => {
    if (token.kind === 'range') {
      needPrefix = true
      return `every ${spec.singular} between ${wordAfterBetween ? `${wordAfterBetween} ` : ''}${tokenText(token, field)}`
    }
    if (token.kind === 'step') {
      needPrefix = true
      return tokenText(token, field)
    }
    let label = tokens[index + 1]?.kind === 'scalar' ? spec.plural : spec.singular
    if (labelOverride !== null) label = labelOverride
    if (label !== '') label += ' '
    const text = (needPrefix ? `${prefix} ${label}` : '') + tokenText(token, field)
    needPrefix = false
    return text
  })
  return joinWithCommasAndAnd(parts)
}

/**
 * The value of a single-valued token.
 *
 * @param token - A token that is not plural.
 * @returns Its value.
 */
function scalarValue(token: Token): number {
  return token.kind === 'scalar' ? token.value : token.kind === 'range' ? token.from : token.range.from
}

/**
 * The hours phrase; every hour of the day is `every hour`.
 *
 * @param tokens - The hour tokens.
 * @returns The phrase.
 */
function buildHourPhrase(tokens: Token[]): string {
  const [only] = tokens
  if (tokens.length === 1 && only.kind === 'range' && only.from === 0 && only.to === 23) return 'every hour'
  return buildPhrase(tokens, 'HOURS', 'at', '', null)
}

/**
 * The time-of-day phrases for the seconds, minutes and hours fields.
 *
 * @param seconds - Seconds field.
 * @param minutes - Minutes field.
 * @param hours - Hours field.
 * @returns The phrases, in order.
 */
function buildTimePhrases(seconds: string, minutes: string, hours: string): string[] {
  const hourTokens = tokenize(hours, 'HOURS')
  const minuteTokens = tokenize(minutes, 'MINUTES')
  const secondTokens = tokenize(seconds, 'SECONDS')
  const secondsIs0 = secondTokens.length === 1 && secondTokens[0].kind === 'scalar' && secondTokens[0].value === 0
  const [hoursIsStar, minutesIsStar, secondsIsStar] = [hours === '*', minutes === '*', seconds === '*']
  const minutesIsOneScalar = minuteTokens.length === 1 && minuteTokens[0].kind === 'scalar'
  const secondsIsOneScalar = secondTokens.length === 1 && secondTokens[0].kind === 'scalar'
  const hm = (h: number, m: number) => `${twelveHour(h)}:${zeroPadded(m)} ${amPm(h)}`
  const hms = (h: number, m: number, s: number) => `${twelveHour(h)}:${zeroPadded(m)}:${zeroPadded(s)} ${amPm(h)}`
  const secondPhrase = () => buildPhrase(secondTokens, 'SECONDS', 'at', null, null)

  if (hoursIsStar && minutesIsStar && secondsIsStar) return ['every second']
  if (hoursIsStar && minutesIsStar && secondsIs0) return ['every minute']
  if (!isPlural(hourTokens) && !isPlural(minuteTokens)) {
    const h = scalarValue(hourTokens[0])
    const m = scalarValue(minuteTokens[0])
    if (secondsIs0) return [`at ${hm(h, m)}`]
    if (isPlural(secondTokens)) return [`at ${hm(h, m)}`, secondPhrase()]
    return [`at ${hms(h, m, scalarValue(secondTokens[0]))}`]
  }
  if (minutesIsStar && secondsIsStar) return [buildHourPhrase(hourTokens), 'every second']
  if (minutesIsStar && secondsIs0) return [buildHourPhrase(hourTokens), 'every minute']
  if (hourTokens.every((token) => token.kind === 'scalar') && minutesIsOneScalar && secondsIsOneScalar) {
    const m = scalarValue(minuteTokens[0])
    const s = scalarValue(secondTokens[0])
    return [`at ${joinWithCommasAndAnd(hourTokens.map((token) => (secondsIs0 ? hm(scalarValue(token), m) : hms(scalarValue(token), m, s))))}`]
  }
  const phrases = [buildHourPhrase(hourTokens), buildPhrase(minuteTokens, 'MINUTES', 'at', null, null)]
  if (!secondsIs0) phrases.push(secondPhrase())
  return phrases
}

/**
 * The day phrases for the day-of-month, month, day-of-week and year fields.
 *
 * @param dayOfMonth - Day-of-month field.
 * @param month - Month field.
 * @param dayOfWeek - Day-of-week field.
 * @param year - Year field (`*` when absent).
 * @returns The phrases, in order.
 * @throws {CronParseError} When neither or both day fields are `?`.
 */
function buildDayPhrases(dayOfMonth: string, month: string, dayOfWeek: string, year: string): string[] {
  const monthIsStar = month === '*'
  const yearIsStar = year === '*'
  const dayOfMonthIsQuestion = dayOfMonth === '?'
  const dayOfWeekIsQuestion = dayOfWeek === '?'
  const dayOfMonthIsAny = dayOfMonth === '*' || dayOfMonthIsQuestion
  const dayOfWeekIsAny = dayOfWeek === '*' || dayOfWeekIsQuestion
  if (!dayOfWeekIsQuestion && !dayOfMonthIsQuestion) throw new CronParseError('Cannot specify both day of month and day of week (one must be "?")')
  if (dayOfWeekIsQuestion && dayOfMonthIsQuestion) throw new CronParseError('Cannot specify both day of month and day of week (only one can be "?")')
  if (dayOfMonthIsAny && dayOfWeekIsAny && monthIsStar && yearIsStar) return ['every day']
  const phrases: string[] = []
  if (!yearIsStar) phrases.push(buildPhrase(tokenize(year, 'YEAR'), 'YEAR', 'in the', null, null))
  if (!monthIsStar) phrases.push(buildPhrase(tokenize(month, 'MONTH'), 'MONTH', 'in', '', null))
  if (!dayOfWeekIsAny) {
    if (yearIsStar && monthIsStar) phrases.push('every week')
    phrases.push(buildPhrase(tokenize(dayOfWeek, 'DAY_OF_WEEK'), 'DAY_OF_WEEK', 'on', '', null))
  }
  if (!dayOfMonthIsAny) {
    if (yearIsStar && monthIsStar) phrases.push('every month')
    phrases.push(buildPhrase(tokenize(dayOfMonth, 'DAY_OF_MONTH'), 'DAY_OF_MONTH', 'on', 'the', 'the'))
  }
  return phrases
}

/** The seven Quartz fields of an expression (year defaults to `*`). */
interface CronParts { seconds: string; minutes: string; hours: string; dayOfMonth: string; month: string; dayOfWeek: string; year: string }

/**
 * Splits an expression into its six or seven whitespace-separated parts.
 *
 * @param expression - Cron expression.
 * @returns The parts.
 * @throws {CronParseError} When the expression does not have six or seven parts.
 */
function splitExpression(expression: string): CronParts {
  const parts = expression.trim().split(/\s+/)
  if (parts.length < 6 || parts.length > 7) throw new CronParseError(`Invalid cron expression: ${expression}`)
  const [seconds, minutes, hours, dayOfMonth, month, dayOfWeek, year = '*'] = parts
  return { seconds, minutes, hours, dayOfMonth, month, dayOfWeek, year }
}

/**
 * Describes a Quartz cron expression in words, as the backend's `CronDescriber`
 * does (for example `0 0 9 * * ?` is "Every day, at 9:00 am").
 *
 * @param expression - Cron expression.
 * @returns The description.
 * @throws {CronParseError} When the expression cannot be described.
 */
export function describeCron(expression: string): string {
  const { seconds, minutes, hours, dayOfMonth, month, dayOfWeek, year } = splitExpression(expression)
  const description = [...buildDayPhrases(dayOfMonth, month, dayOfWeek, year), ...buildTimePhrases(seconds, minutes, hours)].join(', ')
  return description.charAt(0).toUpperCase() + description.slice(1)
}

/**
 * Checks every value of a field against Quartz's bounds and step sizes.
 *
 * @param text - The field text (`?` is skipped).
 * @param field - The cron field.
 * @throws {CronParseError} When a value is out of range.
 */
function checkBounds(text: string, field: CronField): void {
  if (text === '?' || text === '*') return
  const spec = FIELD_SPECS[field]
  const inRange = (value: number) => value >= spec.min && value <= spec.max
  const fail = (): never => {
    throw new CronParseError(field === 'YEAR' ? `Year values must be ${spec.min} or later` : `${spec.rangeLabel} values must be between ${spec.min} and ${spec.max}`)
  }
  for (const token of tokenize(text, field)) {
    if (token.kind === 'scalar' && !inRange(token.value)) fail()
    if (token.kind === 'range' && (!inRange(token.from) || !inRange(token.to))) fail()
    if (token.kind === 'step') {
      if (!inRange(token.range.from) || !inRange(token.range.to)) fail()
      if (token.stepSize < 1) throw new CronParseError(`${spec.rangeLabel} step must be 1 or more`)
    }
  }
}

/** The outcome of checking an expression: its description, or why it is not valid. */
export interface CronCheck {
  description?: string
  error?: string
}

/**
 * Describes an expression and checks it against Quartz's value bounds, for the
 * editor's live feedback. The server stays authoritative when the record is saved.
 *
 * @param expression - Cron expression (blank yields an empty result).
 * @returns The description, or the error message.
 */
export function checkCron(expression: string): CronCheck {
  if (!expression.trim()) return {}
  try {
    const description = describeCron(expression)
    const parts = splitExpression(expression)
    checkBounds(parts.seconds, 'SECONDS')
    checkBounds(parts.minutes, 'MINUTES')
    checkBounds(parts.hours, 'HOURS')
    checkBounds(parts.dayOfMonth, 'DAY_OF_MONTH')
    checkBounds(parts.month, 'MONTH')
    checkBounds(parts.dayOfWeek, 'DAY_OF_WEEK')
    checkBounds(parts.year, 'YEAR')
    return { description }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

// ---------------------------------------------------------------------------
// Basic mode (Material CronUIWidget): days, hours and minutes of a schedule.
// ---------------------------------------------------------------------------

/** How the days of a basic schedule are chosen. */
export type CronDaysOption = 'every' | 'selectedWeekdays' | 'selectedDates'
/** How the hours or minutes of a basic schedule are chosen. */
export type CronTimeOption = 'every' | 'selected'

/** A schedule the Basic editor can show: seconds 0, every month and year. */
export interface BasicCronSchedule {
  /** Weekday values are Quartz numbers (1 = Sunday), dates are 1 to 31. */
  days: { option: CronDaysOption; values: number[] }
  hours: { option: CronTimeOption; values: number[] }
  minutes: { option: CronTimeOption; values: number[] }
}

/** The schedule Basic mode starts from before an expression is set: every day at midnight, as in Material. */
export const EMPTY_BASIC_SCHEDULE: BasicCronSchedule = {
  days: { option: 'every', values: [] },
  hours: { option: 'selected', values: [0] },
  minutes: { option: 'selected', values: [0] },
}

/** Why an expression cannot be edited in Basic mode. */
export const BASIC_MODE_INVALID = 'To use Basic mode the expression must be valid'
/** Why an expression with seconds, months or years cannot be edited in Basic mode. */
export const BASIC_MODE_UNSUPPORTED_PARTS = 'To use Basic mode Seconds must be 0, Month must be *, and Year must be *'
/** Why an expression with steps or special characters cannot be edited in Basic mode. */
export const BASIC_MODE_UNSUPPORTED_VALUES = 'To use Basic mode each part must be *, single values, lists or ranges'

/**
 * Expands a field into its sorted, distinct values, or undefined when it uses
 * steps (or anything else Basic mode cannot show).
 *
 * @param text - The field text.
 * @param field - The cron field.
 * @returns The values.
 */
function expandValues(text: string, field: CronField): number[] | undefined {
  const values = new Set<number>()
  for (const token of tokenize(text, field)) {
    if (token.kind === 'step') return undefined
    if (token.kind === 'scalar') {
      values.add(token.value)
      continue
    }
    // Quartz wraps a descending range around the end (FRI-MON is Friday to Monday)
    const { min, max } = FIELD_SPECS[field]
    const ends = token.from <= token.to ? [[token.from, token.to]] : [[token.from, max], [min, token.to]]
    for (const [from, to] of ends) for (let value = from; value <= to; value++) values.add(value)
  }
  return [...values].sort((a, b) => a - b)
}

/**
 * Reads an expression into the Basic editor's days, hours and minutes.
 *
 * @param expression - Cron expression (blank yields {@link EMPTY_BASIC_SCHEDULE}).
 * @returns The schedule, or the reason Basic mode cannot show it.
 */
export function parseBasicSchedule(expression: string): { schedule: BasicCronSchedule } | { reason: string } {
  if (!expression.trim()) return { schedule: EMPTY_BASIC_SCHEDULE }
  const check = checkCron(expression)
  let parts: CronParts
  try {
    parts = splitExpression(expression.toUpperCase())
  } catch {
    return { reason: BASIC_MODE_INVALID }
  }
  if (parts.seconds !== '0' || parts.month !== '*' || parts.year !== '*') return { reason: BASIC_MODE_UNSUPPORTED_PARTS }
  if (check.error) return { reason: BASIC_MODE_INVALID }
  const time = (text: string, field: CronField): BasicCronSchedule['hours'] | undefined => {
    if (text === '*') return { option: 'every', values: [] }
    const values = expandValues(text, field)
    return values && { option: 'selected', values }
  }
  const minutes = time(parts.minutes, 'MINUTES')
  const hours = time(parts.hours, 'HOURS')
  const anyDayOfMonth = parts.dayOfMonth === '*' || parts.dayOfMonth === '?'
  const anyDayOfWeek = parts.dayOfWeek === '*' || parts.dayOfWeek === '?'
  let days: BasicCronSchedule['days'] | undefined
  if (anyDayOfMonth && anyDayOfWeek) days = { option: 'every', values: [] }
  else if (anyDayOfMonth) {
    const values = expandValues(parts.dayOfWeek, 'DAY_OF_WEEK')
    days = values && { option: 'selectedWeekdays', values }
  } else {
    const values = expandValues(parts.dayOfMonth, 'DAY_OF_MONTH')
    days = values && { option: 'selectedDates', values }
  }
  if (!minutes || !hours || !days) return { reason: BASIC_MODE_UNSUPPORTED_VALUES }
  return { schedule: { days, hours, minutes } }
}

/**
 * Builds the expression for a Basic schedule: `0 {minutes} {hours} {day of month} * {day of week}`.
 * A "selected" slot with no values means every value.
 *
 * @param schedule - Days, hours and minutes.
 * @returns The cron expression.
 */
export function buildBasicExpression(schedule: BasicCronSchedule): string {
  const list = (values: number[]) => [...new Set(values)].sort((a, b) => a - b)
  const time = ({ option, values }: BasicCronSchedule['hours']) => (option === 'selected' && values.length > 0 ? list(values).join(',') : '*')
  const { option, values } = schedule.days
  let dayOfMonth = '*'
  let dayOfWeek = '?'
  if (option === 'selectedDates' && values.length > 0) {
    dayOfMonth = list(values).join(',')
  } else if (option === 'selectedWeekdays' && values.length > 0) {
    dayOfMonth = '?'
    dayOfWeek = list(values).map((value) => CRON_WEEKDAYS[value - 1]?.short ?? String(value)).join(',')
  }
  return `0 ${time(schedule.minutes)} ${time(schedule.hours)} ${dayOfMonth} * ${dayOfWeek}`
}

/** The names of the seven parts of an expression, in order. */
export const CRON_PART_NAMES = ['second', 'minute', 'hour', 'day of month', 'month', 'day of week', 'year'] as const

/**
 * The part of an expression the caret is in (Material's advanced-mode hint).
 *
 * @param expression - The typed expression.
 * @param caret - Caret offset.
 * @returns The part name, or undefined past the seventh part.
 */
export function cronPartAtCaret(expression: string, caret: number): (typeof CRON_PART_NAMES)[number] | undefined {
  let inPart = false
  let index = -1
  for (let i = 0; i < expression.length; i++) {
    if (/\s/.test(expression.charAt(i))) {
      inPart = false
    } else {
      if (!inPart) index++
      inPart = true
    }
    if (i === caret) break
  }
  if (!inPart && caret >= expression.length) index++
  return CRON_PART_NAMES[Math.max(index, 0)]
}
