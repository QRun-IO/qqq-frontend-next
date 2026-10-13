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
 * @file field-validation — the plain-language rules behind quiet record-form validation: how a
 * field's too-long policy and range read from metadata, when a length counter is worth showing,
 * the messages users see, and how the server's record errors are matched back to fields.
 *
 * Everything here mirrors what the metadata states; the backend stays the authority, so a rule
 * the metadata does not express is never enforced on the client.
 */

import type { QFieldMetaData } from '@/types'

/** What the backend does with a value over `maxLength`: refuse it, trim it, or leave it be. */
export type TooLongPolicy = 'error' | 'truncate' | 'soft'

/** The share of `maxLength` after which a length counter appears (the last 20%). */
export const COUNTER_THRESHOLD = 0.8

/**
 * Reads the field's too-long policy from its `ValueTooLongBehavior` (sent as a behavior name).
 *
 * @param field - Field metadata.
 * @returns `error` (typing is capped), `truncate` (the server trims), or `soft` when the
 *   field declares no refusal or no policy: nothing is enforced on the client.
 */
export function tooLongPolicy(field: Pick<QFieldMetaData, 'behaviors'>): TooLongPolicy {
  const behaviors = field.behaviors ?? []
  if (behaviors.includes('ERROR')) return 'error'
  if (behaviors.includes('TRUNCATE') || behaviors.includes('TRUNCATE_ELLIPSIS')) return 'truncate'
  return 'soft'
}

/** How a length counter should look at the current length. */
export interface LengthMeter {
  /** The counter text, such as `120 / 200`. */
  text: string
  /** True once the value is past the limit. */
  over: boolean
}

/**
 * The length counter for a value, or `undefined` while the value is comfortably short: a
 * counter shows only within the last 20% of the limit, or past it.
 *
 * @param length - Current number of characters.
 * @param max - The field's `maxLength`.
 * @returns The counter, or `undefined` when none is useful.
 */
export function lengthMeter(length: number, max: number | undefined): LengthMeter | undefined {
  if (!max || max <= 0 || length < max * COUNTER_THRESHOLD) return undefined
  return { text: `${length} / ${max}`, over: length > max }
}

/**
 * The note shown with the counter when the value is over a limit the server will trim.
 *
 * @param policy - The field's too-long policy.
 * @param length - Current number of characters.
 * @param max - The field's `maxLength`.
 * @returns The note, or `undefined` when there is none to give.
 */
export function truncateNote(policy: TooLongPolicy, length: number, max: number | undefined): string | undefined {
  return policy === 'truncate' && max && length > max ? 'Extra characters will be trimmed when you save.' : undefined
}

/**
 * The message for a missing required value: the standard "<Field> is required" sentence.
 *
 * @param label - The field's label.
 * @returns The message for a missing required value.
 */
export function requiredMessage(label: string): string {
  return `${label} is required`
}

/**
 * The message for a value that is too long, with how long it is now.
 *
 * @param max - The field's `maxLength`.
 * @param length - Current number of characters.
 * @returns The message for a value that is too long.
 */
export function tooLongMessage(max: number, length: number): string {
  return `Must be ${max} characters or fewer (currently ${length})`
}

/**
 * The message for text that is not a number.
 *
 * @param label - The field's label.
 * @param isInteger - Whether the field takes whole numbers only.
 * @returns The message for text that is not a number.
 */
export function notANumberMessage(label: string, isInteger: boolean): string {
  return isInteger ? `${label} must be a whole number` : `${label} must be a number`
}

/**
 * The message for a number outside the metadata's range, worded exactly as the backend words the
 * same refusal, so a user sees one text whether the form or the server stops the value.
 *
 * @param label - The field's label.
 * @param side - Which bound was broken.
 * @param bound - The field's `minValue` or `maxValue`.
 * @returns The message, such as `The value for Age is too large (maximum allowed value is 100)`.
 */
export function outOfRangeMessage(label: string, side: 'min' | 'max', bound: number | string | null | undefined): string {
  return side === 'min'
    ? `The value for ${label} is too small (minimum allowed value is ${bound})`
    : `The value for ${label} is too large (maximum allowed value is ${bound})`
}

/** Messages for native inputs whose browsers keep unreadable text out of the value (`validity.badInput`). */
const BAD_INPUT_MESSAGES: Record<string, string> = {
  date: 'Enter a valid date',
  time: 'Enter a valid time',
  'datetime-local': 'Enter a valid date and time',
}

/**
 * The message for an input the browser could not read (a half-typed date, text in a number).
 *
 * @param field - Field metadata, when known.
 * @param input - The input whose `validity.badInput` is set.
 * @returns The message to show.
 */
export function badInputMessage(field: Pick<QFieldMetaData, 'type' | 'label'> | undefined, input: HTMLInputElement): string {
  if (input.type === 'number') return notANumberMessage(field?.label ?? 'This field', field?.type === 'INTEGER' || field?.type === 'LONG')
  return BAD_INPUT_MESSAGES[input.type] ?? 'Enter a valid value'
}

/**
 * Keys a number input refuses, so non-numeric text never lands in it.
 *
 * @param isInteger - Whether the field takes whole numbers only.
 * @param minValue - The field's `minValue`, if any (a non-negative minimum refuses `-`).
 * @returns The characters to prevent.
 */
export function blockedNumberKeys(isInteger: boolean, minValue?: number | string | null): string[] {
  const keys = ['e', 'E', '+']
  if (isInteger) keys.push('.', ',')
  if (minValue !== undefined && minValue !== null && Number(minValue) >= 0) keys.push('-')
  return keys
}

/** Server messages sorted into those that name a field and those that do not. */
export interface MappedServerErrors {
  /** Plain message per field name. */
  fieldErrors: Record<string, string>
  /** Messages that name no known field; these stay on the form as a general error. */
  unmatched: string[]
}

const REQUIRED_PATTERN = /^Missing value in required field:\s*(.+?)\s*$/
const TOO_LONG_PATTERN = /^The value for (.+) is too long \(max allowed length=(\d+)\)/
const TOO_SMALL_PATTERN = /^The value for (.+) is too small \(minimum allowed value is (greater than )?(.+?)\)/
const TOO_LARGE_PATTERN = /^The value for (.+) is too large \(maximum allowed value is (less than )?(.+?)\)/

/**
 * Escapes text for use inside a regular expression.
 *
 * @param text - Plain text.
 * @returns The text with regex characters escaped.
 */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Matches the backend's per-record error messages to the form's fields. The record write
 * reports plain sentences that name a field by label, so the known sentences are read exactly
 * and any other message is matched by the longest field label it mentions.
 *
 * @param messages - The record's error messages.
 * @param fields - The form's editable fields.
 * @returns Field messages, and what could not be matched.
 */
export function mapServerErrors(messages: readonly string[], fields: readonly QFieldMetaData[]): MappedServerErrors {
  const byLabel = new Map<string, QFieldMetaData[]>()
  for (const field of fields) {
    const label = (field.label || field.name).trim()
    byLabel.set(label, [...(byLabel.get(label) ?? []), field])
  }
  const exact = (label: string) => {
    const matches = byLabel.get(label.trim())
    return matches?.length === 1 ? matches[0] : undefined
  }
  const mentioned = (message: string) => {
    let best: QFieldMetaData[] | undefined
    let bestLength = 0
    for (const [label, matches] of byLabel) {
      if (label.length < bestLength) continue
      if (!new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(label)}($|[^\\p{L}\\p{N}])`, 'u').test(message)) continue
      best = label.length === bestLength ? [...(best ?? []), ...matches] : matches
      bestLength = label.length
    }
    return best?.length === 1 ? best[0] : undefined
  }

  const fieldErrors: Record<string, string> = {}
  const unmatched: string[] = []
  for (const message of messages) {
    let field: QFieldMetaData | undefined
    let text = message
    let match: RegExpExecArray | null
    if ((match = REQUIRED_PATTERN.exec(message))) {
      field = exact(match[1])
      text = requiredMessage(field?.label ?? match[1])
    } else if ((match = TOO_LONG_PATTERN.exec(message))) {
      field = exact(match[1])
      text = `Must be ${match[2]} characters or fewer`
    } else if ((match = TOO_SMALL_PATTERN.exec(message))) {
      field = exact(match[1])
      text = match[0]
    } else if ((match = TOO_LARGE_PATTERN.exec(message))) {
      field = exact(match[1])
      text = match[0]
    }
    field ??= mentioned(message)
    if (!field) {
      unmatched.push(message)
    } else if (!(field.name in fieldErrors)) {
      fieldErrors[field.name] = text
    }
  }
  return { fieldErrors, unmatched }
}
