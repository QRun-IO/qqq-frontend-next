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
 * @file filter-paste-utils — splitting pasted text into filter values for the "Bulk Add Filter
 * Values" dialog (Material's `FilterCriteriaPaster`): separator detection, splitting, counts and
 * the messages for values that cannot be added.
 */

/** The separators the dialog offers, in Material's order. */
export const PASTE_SEPARATORS = ['Detect Automatically', 'Comma', 'Newline', 'Pipe', 'Space', 'Tab', 'Custom'] as const

/** A separator choice. */
export type PasteSeparator = (typeof PASTE_SEPARATORS)[number]

/** A separator that can be detected. */
export type DetectedSeparator = 'Comma' | 'Newline' | 'Pipe' | 'Space' | 'Tab'

/** Split patterns; every separator also splits lines, as in Material. */
const SPLIT_PATTERNS: Record<DetectedSeparator, RegExp> = {
  Comma: /[,\n\r]/,
  Newline: /[\n\r]/,
  Pipe: /[|\n\r]/,
  Space: /[ \n\r]/,
  Tab: /[\t\n\r]/,
}

/**
 * Picks the separator that occurs most often (ties go to the earlier one in Material's order);
 * commas when there is none.
 *
 * @param text - The pasted text.
 * @returns The detected separator.
 */
export function detectSeparator(text: string): DetectedSeparator {
  const counts: Record<DetectedSeparator, number> = { Comma: 0, Newline: 0, Pipe: 0, Space: 0, Tab: 0 }
  for (const char of text) {
    if (char === '\t') counts.Tab++
    else if (char === '\n' || char === '\r') counts.Newline++
    else if (char === '|') counts.Pipe++
    else if (char === ' ') counts.Space++
    else if (char === ',') counts.Comma++
  }
  let best: DetectedSeparator = 'Comma'
  let highest = 0
  for (const separator of ['Comma', 'Newline', 'Pipe', 'Space', 'Tab'] as const) {
    if (counts[separator] > highest) {
      best = separator
      highest = counts[separator]
    }
  }
  return best
}

/**
 * Escapes a character for use inside a regular-expression character class.
 *
 * @param value - The character.
 * @returns The escaped text.
 */
function escapeForClass(value: string): string {
  return value.replace(/[\\\]^-]/g, '\\$&')
}

/**
 * Splits pasted text into trimmed, non-empty values.
 *
 * @param text - The pasted text.
 * @param separator - The chosen separator ("Detect Automatically" detects one).
 * @param custom - The custom separator character, for "Custom".
 * @returns The values, in pasted order (duplicates kept).
 */
export function splitPastedValues(text: string, separator: PasteSeparator, custom = ''): string[] {
  let pattern: RegExp
  if (separator === 'Custom') pattern = new RegExp(`[${escapeForClass(custom)}\\n\\r]`)
  else if (separator === 'Detect Automatically') pattern = SPLIT_PATTERNS[detectSeparator(text)]
  else pattern = SPLIT_PATTERNS[separator]
  return text.split(pattern).map((part) => part.trim()).filter((part) => part !== '')
}

/**
 * The count line: "N values (M unique)".
 *
 * @param values - The split values.
 * @returns The text, or an empty string for no values.
 */
export function pastedValuesSummary(values: readonly string[]): string {
  if (values.length === 0) return ''
  return `${values.length.toLocaleString()} ${values.length === 1 ? 'value' : 'values'} (${new Set(values).size.toLocaleString()} unique)`
}

/**
 * The message for values that will not be added (Material's wording).
 *
 * @param invalidCount - How many values are invalid.
 * @param kind - `number` (not numeric) or `pvs` (not a known option).
 * @returns The message, or an empty string when none are invalid.
 */
export function invalidPastedValuesMessage(invalidCount: number, kind: 'number' | 'pvs'): string {
  if (invalidCount <= 0) return ''
  if (kind === 'number') return `${invalidCount} ${invalidCount === 1 ? 'value is not a number' : 'values are not numbers'} and will not be added to the filter`
  return `${invalidCount} ${invalidCount === 1 ? 'value was' : 'values were'} not found and will not be added to the filter`
}
