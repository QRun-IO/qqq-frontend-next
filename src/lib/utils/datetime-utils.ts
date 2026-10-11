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
 * @file datetime-utils — conversions between QQQ DATE_TIME instants (UTC ISO-8601)
 * and what a person reads or types in their own time zone, and the one compact
 * DATE / DATE_TIME presentation every table, record view, widget and card shares
 * (see {@link compactDateTime}, {@link compactDate} and {@link relativeDateTime}).
 */

/** A QQQ DATE_TIME wire value: ISO-8601 with an explicit `Z` or offset. */
const ZONED_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i

/** The value format of `<input type="datetime-local">`. */
const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/

/**
 * Parses a DATE_TIME wire value.
 *
 * @param value - ISO-8601 instant with zone, as QQQ sends it.
 * @returns The instant, or `null` when the value is not a zoned timestamp.
 */
function parseInstant(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value !== 'string' || !ZONED_ISO.test(value.trim())) return null
  const date = new Date(value.trim())
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Two-digit zero padding.
 *
 * @param value - A non-negative number below 100.
 * @returns The padded string.
 */
function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * Formats an instant the way the QQQ dashboards show DATE_TIME values:
 * `yyyy-MM-dd hh:mm:ss AM TZ`, in the viewer's (or the given) time zone.
 *
 * @param value - ISO-8601 instant with zone.
 * @param timeZone - IANA zone; defaults to the browser's zone.
 * @returns The formatted text, or `null` when the value is not a zoned timestamp.
 */
export function formatDateTime(value: unknown, timeZone?: string): string | null {
  const date = parseInstant(value)
  return date ? formatInstant(date, timeZone) : null
}

/**
 * Formats an instant as `yyyy-MM-dd hh:mm:ss AM TZ` in the given (or the browser's) zone.
 *
 * @param date - The instant.
 * @param timeZone - IANA zone; defaults to the browser's zone.
 * @returns The formatted text.
 */
function formatInstant(date: Date, timeZone?: string): string {
  const parts = Object.fromEntries(cachedFormat('en-US', timeZone, 'full', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: true, timeZoneName: 'short',
  }).formatToParts(date).map((part) => [part.type, part.value]))
  const hour = parts.hour === '24' ? '12' : parts.hour
  return `${parts.year}-${parts.month}-${parts.day} ${hour}:${parts.minute}:${parts.second} ${parts.dayPeriod.toUpperCase()} ${parts.timeZoneName}`
}

/**
 * Converts a DATE_TIME wire value to the local `datetime-local` input format.
 *
 * @param value - ISO-8601 instant with zone.
 * @returns `yyyy-MM-ddTHH:mm:ss` in the browser's zone, or `''` for an empty or unreadable value.
 */
export function toLocalDateTimeInput(value: unknown): string {
  const date = parseInstant(value)
  if (!date) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/**
 * Converts a local `datetime-local` value to the UTC instant QQQ stores.
 *
 * @param value - `yyyy-MM-ddTHH:mm[:ss]` typed in the browser's zone.
 * @param originalValue - Optional stored instant to retain when its local text is unchanged.
 * @returns `yyyy-MM-ddTHH:mm:ssZ`, `''` for an empty value, or the input unchanged when it is
 *   already a zoned timestamp.
 */
export function fromLocalDateTimeInput(value: string, originalValue?: unknown): string {
  const text = value.trim()
  if (!text) return ''
  if (ZONED_ISO.test(text)) return text
  const match = LOCAL_INPUT.exec(text)
  if (!match) return text
  const [, year, month, day, hour, minute, second] = match
  // Unchanged wall-clock text must retain the original offset during a repeated
  // DST hour, and retain subsecond precision hidden by a seconds-only control.
  const localSeconds = `${year}-${month}-${day}T${hour}:${minute}:${second ?? '00'}`
  if (parseInstant(originalValue) && toLocalDateTimeInput(originalValue) === localSeconds) {
    return originalValue instanceof Date ? originalValue.toISOString() : String(originalValue).trim()
  }
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second ?? 0))
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

// ---------------------------------------------------------------------------
// Compact presentation
// ---------------------------------------------------------------------------

/** Options shared by the compact formatters (all optional; tests pin them). */
export interface DateDisplayOptions {
  /** The reference "now" for today / this-year decisions; defaults to the current time. */
  now?: Date
  /** IANA zone to show instants in; defaults to the browser's zone. */
  timeZone?: string
  /** BCP 47 locale for month names and clock style; defaults to the browser's locale. */
  locale?: string
}

/** A date or timestamp ready to show: short text, its full form, and the machine value. */
export interface DateDisplay {
  /** Compact text, e.g. `6:33 PM`, `Jul 5, 6:33 PM` or `Jul 5, 2025`. */
  text: string
  /** The full value for a tooltip, e.g. `2026-07-05 06:33:29 PM CDT`. */
  title: string
  /** A `<time dateTime>` value, when the value could be read. */
  dateTime?: string
}

/**
 * Width, in CSS pixels, that fits the compact DATE_TIME form (`Sep 30, 12:59 PM`) in a
 * 14px table cell with padding, so grids size date-time columns to their content.
 */
export const DATE_TIME_COLUMN_WIDTH = 150

/**
 * Width, in CSS pixels, that fits the compact DATE form (`Sep 30, 2025`) in a table cell, with
 * room left for a two-word header's sort and menu controls.
 */
export const DATE_COLUMN_WIDTH = 130

/** Formatters are costly to build and a page can show thousands of dates (QRun-IO/qqq#710). */
const formatCache = new Map<string, Intl.DateTimeFormat>()

/**
 * A cached `Intl.DateTimeFormat`.
 *
 * @param locale - Locale, or undefined for the browser's.
 * @param timeZone - Zone, or undefined for the browser's.
 * @param kind - Cache discriminator for the option set.
 * @param options - Format options.
 * @returns The formatter.
 */
function cachedFormat(locale: string | undefined, timeZone: string | undefined, kind: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale ?? ''}|${timeZone ?? ''}|${kind}`
  let format = formatCache.get(key)
  if (!format) {
    format = new Intl.DateTimeFormat(locale, { ...options, timeZone })
    formatCache.set(key, format)
  }
  return format
}

/**
 * An instant's calendar day in a zone, as a sortable `yyyy-MM-dd` key.
 *
 * @param date - The instant.
 * @param timeZone - The zone.
 * @returns The day key.
 */
function dayKey(date: Date, timeZone: string | undefined): string {
  return cachedFormat('en-CA', timeZone, 'day', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

/**
 * The short zone name (`CDT`, `GMT+2`) of an instant in a zone.
 *
 * @param date - The instant.
 * @param timeZone - The zone.
 * @returns The name.
 */
function zoneName(date: Date, timeZone: string | undefined): string {
  return cachedFormat('en-US', timeZone, 'zone', { timeZoneName: 'short' }).formatToParts(date).find((part) => part.type === 'timeZoneName')?.value ?? ''
}

/**
 * Compact text for an instant: the time today, month and day with the time this year,
 * otherwise month, day and year.
 *
 * @param date - The instant.
 * @param now - Reference time.
 * @param timeZone - Zone to read both in.
 * @param locale - Locale.
 * @returns The text.
 */
function compactInstantText(date: Date, now: Date, timeZone: string | undefined, locale: string | undefined): string {
  const day = dayKey(date, timeZone)
  const today = dayKey(now, timeZone)
  if (day === today) return cachedFormat(locale, timeZone, 'time', { hour: 'numeric', minute: '2-digit' }).format(date)
  if (day.slice(0, 4) === today.slice(0, 4)) {
    return cachedFormat(locale, timeZone, 'monthDayTime', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
  }
  return cachedFormat(locale, timeZone, 'monthDayYear', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

/** A zone-less ISO date-time (`yyyy-MM-ddTHH:mm[:ss]`), read as wall-clock time in the browser's zone. */
const UNZONED_ISO = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/

/**
 * A backend display value zoned by a field behavior (QQQ `DateTimeDisplayValueBehavior`,
 * `yyyy-MM-dd hh:mm:ss a z`): the wall-clock parts and the zone name.
 */
const BACKEND_ZONED = /^(\d{4})-(\d{2})-(\d{2}) (\d{1,2}):(\d{2})(?::(\d{2}))? ([AP]M) (\S+)$/i

/**
 * Reads a DATE_TIME value: a zoned instant, a `Date`, or a zone-less ISO timestamp (local).
 *
 * @param value - The raw value.
 * @returns The instant, or null.
 */
function readDateTime(value: unknown): Date | null {
  const instant = parseInstant(value)
  if (instant) return instant
  if (typeof value !== 'string') return null
  const match = UNZONED_ISO.exec(value.trim())
  if (!match) return null
  const [, year, month, day, hour, minute, second] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second ?? 0))
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * The compact presentation of a DATE_TIME value, in the viewer's zone and locale:
 * `6:33 PM` today, `Jul 5, 6:33 PM` this year, `Jul 5, 2025` before; the full
 * `yyyy-MM-dd hh:mm:ss AM TZ` timestamp is the title.
 *
 * A backend display value zoned by a field behavior in a zone other than the viewer's keeps
 * that zone: its own wall-clock time is shortened the same way and the zone name appended
 * (`Jul 5, 6:33 PM PDT`). A display value that is not a timestamp at all is shown as sent.
 *
 * @param value - Raw value (ISO-8601 instant).
 * @param displayValue - Backend display value, if any.
 * @param options - Reference time, zone and locale.
 * @returns The presentation, or null for an empty value.
 */
export function compactDateTime(value: unknown, displayValue?: unknown, options: DateDisplayOptions = {}): DateDisplay | null {
  const now = options.now ?? new Date()
  const { timeZone, locale } = options
  const date = readDateTime(value)
  const display = typeof displayValue === 'string' && displayValue.trim() !== '' && displayValue !== value ? displayValue.trim() : undefined

  const zoned = display ? BACKEND_ZONED.exec(display) : null
  if (zoned && (!date || zoned[8] !== zoneName(date, timeZone))) {
    const [, year, month, day, hour12, minute, second, period, zone] = zoned
    const hour = (Number(hour12) % 12) + (period.toUpperCase() === 'PM' ? 12 : 0)
    // the zone's wall clock, formatted as if it were UTC so no further shift applies
    const wall = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), hour, Number(minute), Number(second ?? 0)))
    // the viewer's today, at noon on the same wall-clock footing, for the today / this-year choice
    const [nowYear, nowMonth, nowDay] = dayKey(now, timeZone).split('-').map(Number)
    const wallNow = new Date(Date.UTC(nowYear, nowMonth - 1, nowDay, 12))
    const viewer = date ? `\nYour time: ${formatInstant(date, timeZone)}` : ''
    const text = compactInstantText(wall, wallNow, 'UTC', locale)
    // the zone only qualifies a time; an older value shows its date alone
    const withZone = year === String(wallNow.getUTCFullYear()) ? `${text} ${zone}` : text
    return { text: withZone, title: `${display}${viewer}`, dateTime: date?.toISOString() }
  }

  if (date) return { text: compactInstantText(date, now, timeZone, locale), title: formatInstant(date, timeZone), dateTime: date.toISOString() }
  const fallback = display ?? (value === null || value === undefined ? '' : String(value).trim())
  return fallback ? { text: fallback, title: fallback } : null
}

/** A calendar date (`yyyy-MM-dd`, optionally followed by a time that is ignored). */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/

/**
 * The compact presentation of a DATE value: `Jul 5` this year, `Jul 5, 2025` otherwise, never
 * a time. A DATE is a calendar day, so no zone shifts it (`new Date('2024-06-15')` would read
 * UTC midnight and show the 14th west of Greenwich). The title is the long date.
 *
 * @param value - Raw value (`yyyy-MM-dd`).
 * @param displayValue - Backend display value, shown as sent when the raw value is not a date.
 * @param options - Reference time, zone (for "this year") and locale.
 * @returns The presentation, or null for an empty value.
 */
export function compactDate(value: unknown, displayValue?: unknown, options: DateDisplayOptions = {}): DateDisplay | null {
  const now = options.now ?? new Date()
  const match = typeof value === 'string' ? DATE_ONLY.exec(value.trim()) : null
  if (match) {
    const [, year, month, day] = match
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
    if (!Number.isNaN(date.getTime())) {
      const thisYear = dayKey(now, options.timeZone).slice(0, 4) === year
      const text = thisYear
        ? cachedFormat(options.locale, 'UTC', 'monthDay', { month: 'short', day: 'numeric' }).format(date)
        : cachedFormat(options.locale, 'UTC', 'monthDayYear', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
      const long = cachedFormat(options.locale, 'UTC', 'longDate', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(date)
      return { text, title: `${long} (${year}-${month}-${day})`, dateTime: `${year}-${month}-${day}` }
    }
  }
  const fallback = typeof displayValue === 'string' && displayValue.trim() !== '' ? displayValue.trim() : value === null || value === undefined ? '' : String(value).trim()
  return fallback ? { text: fallback, title: fallback } : null
}

/** Relative-time steps: below the limit (seconds), count in the unit of that many seconds. */
const RELATIVE_STEPS: Array<[limit: number, unit: Intl.RelativeTimeFormatUnit, seconds: number]> = [
  [3_600, 'minute', 60],
  [86_400, 'hour', 3_600],
  [7 * 86_400, 'day', 86_400],
]

/**
 * A recent instant as relative time (`just now`, `5m ago`, `3h ago`, `yesterday`, `4d ago`),
 * for activity lists; null for instants a week or more away, which read better as dates.
 *
 * @param value - Raw value (ISO-8601 instant).
 * @param options - Reference time and locale.
 * @returns The text, or null.
 */
export function relativeDateTime(value: unknown, options: DateDisplayOptions = {}): string | null {
  const date = readDateTime(value)
  if (!date) return null
  const seconds = ((options.now ?? new Date()).getTime() - date.getTime()) / 1000
  if (Math.abs(seconds) < 45) return 'just now'
  const step = RELATIVE_STEPS.find(([limit]) => Math.abs(seconds) < limit)
  if (!step) return null
  const [, unit, size] = step
  return new Intl.RelativeTimeFormat(options.locale, { style: 'narrow', numeric: 'auto' }).format(-Math.round(seconds / size), unit)
}
