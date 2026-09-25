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
 * and what a person reads or types in their own time zone.
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
  if (!date) return null
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
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
 * @returns `yyyy-MM-ddTHH:mm:ssZ`, `''` for an empty value, or the input unchanged when it is
 *   already a zoned timestamp.
 */
export function fromLocalDateTimeInput(value: string): string {
  const text = value.trim()
  if (!text) return ''
  if (ZONED_ISO.test(text)) return text
  const match = LOCAL_INPUT.exec(text)
  if (!match) return text
  const [, year, month, day, hour, minute, second] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second ?? 0))
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}
