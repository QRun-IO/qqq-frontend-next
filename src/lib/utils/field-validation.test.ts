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
import type { QFieldMetaData } from '@/types'
import {
  badInputMessage, blockedNumberKeys, lengthMeter, mapServerErrors, outOfRangeMessage, tooLongMessage, tooLongPolicy, truncateNote,
} from './field-validation'
import { zodFieldFromMetadata } from './zod-from-metadata'

function field(name: string, label: string, extra: Partial<QFieldMetaData> = {}): QFieldMetaData {
  return { name, label, type: 'STRING', isRequired: false, isEditable: true, isHeavy: false, isHidden: false, adornments: [], ...extra }
}

describe('tooLongPolicy', () => {
  it('reads ERROR and the trimming behaviors, and leaves everything else to the server', () => {
    expect(tooLongPolicy({ behaviors: ['ERROR'] })).toBe('error')
    expect(tooLongPolicy({ behaviors: ['TRUNCATE'] })).toBe('truncate')
    expect(tooLongPolicy({ behaviors: ['TRUNCATE_ELLIPSIS'] })).toBe('truncate')
    expect(tooLongPolicy({ behaviors: ['PASS_THROUGH'] })).toBe('soft')
    expect(tooLongPolicy({ behaviors: ['TO_UPPER_CASE'] })).toBe('soft')
    expect(tooLongPolicy({})).toBe('soft')
  })
})

describe('lengthMeter', () => {
  it('stays hidden below 80% of the limit', () => {
    expect(lengthMeter(0, 200)).toBeUndefined()
    expect(lengthMeter(159, 200)).toBeUndefined()
  })

  it('appears from 80% of the limit and flags a value past it', () => {
    expect(lengthMeter(160, 200)).toEqual({ text: '160 / 200', over: false })
    expect(lengthMeter(200, 200)).toEqual({ text: '200 / 200', over: false })
    expect(lengthMeter(214, 200)).toEqual({ text: '214 / 200', over: true })
  })

  it('shows nothing for a field without a usable limit', () => {
    expect(lengthMeter(50, undefined)).toBeUndefined()
    expect(lengthMeter(50, 0)).toBeUndefined()
  })
})

describe('truncateNote', () => {
  it('speaks only when a trimming field is over its limit', () => {
    expect(truncateNote('truncate', 11, 10)).toMatch(/trimmed/)
    expect(truncateNote('truncate', 10, 10)).toBeUndefined()
    expect(truncateNote('error', 11, 10)).toBeUndefined()
    expect(truncateNote('soft', 11, 10)).toBeUndefined()
  })
})

describe('field validators', () => {
  const messages = (schema: ReturnType<typeof zodFieldFromMetadata>, value: unknown) => {
    const result = schema.safeParse(value)
    return result.success ? [] : result.error.issues.map((issue) => issue.message)
  }

  it('requires a value with the standard "<Field> is required" sentence', () => {
    expect(messages(zodFieldFromMetadata(field('a', 'A', { isRequired: true })), '')).toEqual(['A is required'])
    expect(messages(zodFieldFromMetadata(field('a', 'A', { type: 'DATE', isRequired: true })), '')).toEqual(['A is required'])
    expect(messages(zodFieldFromMetadata(field('a', 'A', { type: 'INTEGER', isRequired: true })), '')).toEqual(['A is required'])
    expect(messages(zodFieldFromMetadata(field('a', 'A', { type: 'BOOLEAN', isRequired: true })), undefined)).toEqual(['A is required'])
  })

  it('says how long a refused value is, only for fields that refuse over-long values', () => {
    const refusing = zodFieldFromMetadata(field('a', 'A', { maxLength: 5, behaviors: ['ERROR'] }), { enforceMaxLength: false })
    expect(messages(refusing, 'abcdefgh')).toEqual(['The value for A is too long (max allowed length=5)'])
    expect(tooLongMessage('Notes', 200)).toBe('The value for Notes is too long (max allowed length=200)')
    expect(messages(refusing, 'abcde')).toEqual([])
    const trimmed = zodFieldFromMetadata(field('a', 'A', { maxLength: 5, behaviors: ['TRUNCATE'] }), { enforceMaxLength: false })
    expect(messages(trimmed, 'abcdefgh')).toEqual([])
    const undeclared = zodFieldFromMetadata(field('a', 'A', { maxLength: 5 }), { enforceMaxLength: false })
    expect(messages(undeclared, 'abcdefgh')).toEqual([])
  })

  it('names the field and asks for a whole number or a number in plain words, never a type name', () => {
    expect(messages(zodFieldFromMetadata(field('a', 'A', { type: 'INTEGER' })), '1.5')).toEqual(['A must be a whole number'])
    expect(messages(zodFieldFromMetadata(field('a', 'A', { type: 'INTEGER' })), 'abc')).toEqual(['A must be a whole number'])
    expect(messages(zodFieldFromMetadata(field('a', 'A', { type: 'DECIMAL' })), 'abc')).toEqual(['A must be a number'])
    expect(messages(zodFieldFromMetadata(field('a', 'A', { type: 'DECIMAL' })), '2.75')).toEqual([])
    expect(messages(zodFieldFromMetadata(field('a', 'A', { type: 'LONG' })), '1.5')).toEqual(['A must be a whole number'])
  })

  it('words a broken range exactly as the backend does', () => {
    const both = field('a', 'A', { type: 'INTEGER', minValue: 1, maxValue: 5 })
    expect(messages(zodFieldFromMetadata(both), '0')).toEqual(['The value for A is too small (minimum allowed value is 1)'])
    expect(messages(zodFieldFromMetadata(both), '6')).toEqual(['The value for A is too large (maximum allowed value is 5)'])
    expect(messages(zodFieldFromMetadata(field('a', 'A', { type: 'DECIMAL', minValue: 0 })), '-1')).toEqual(['The value for A is too small (minimum allowed value is 0)'])
    expect(messages(zodFieldFromMetadata(field('a', 'A', { type: 'INTEGER', maxValue: 9 })), '10')).toEqual(['The value for A is too large (maximum allowed value is 9)'])
    expect(outOfRangeMessage('Bounded Value', 'max', 100)).toBe('The value for Bounded Value is too large (maximum allowed value is 100)')
  })

  it('does not block on rules the metadata does not express', () => {
    expect(messages(zodFieldFromMetadata(field('a', 'A', { type: 'INTEGER' })), '999999999')).toEqual([])
    expect(messages(zodFieldFromMetadata(field('a', 'A')), 'anything at all')).toEqual([])
  })
})

describe('number keys and unreadable input', () => {
  it('refuses letters and signs, plus the decimal point for whole numbers', () => {
    expect(blockedNumberKeys(false)).toEqual(expect.arrayContaining(['e', 'E', '+']))
    expect(blockedNumberKeys(false)).not.toContain('.')
    expect(blockedNumberKeys(true)).toEqual(expect.arrayContaining(['.', ',']))
  })

  it('refuses a minus sign only when the minimum is not negative', () => {
    expect(blockedNumberKeys(true, 0)).toContain('-')
    expect(blockedNumberKeys(true, -5)).not.toContain('-')
    expect(blockedNumberKeys(true)).not.toContain('-')
  })

  it('explains an input the browser could not read', () => {
    const input = (type: string) => Object.assign(document.createElement('input'), { type })
    expect(badInputMessage({ type: 'INTEGER', label: 'Qty' }, input('number'))).toBe('Qty must be a whole number')
    expect(badInputMessage({ type: 'DECIMAL', label: 'Price' }, input('number'))).toBe('Price must be a number')
    expect(badInputMessage({ type: 'DATE', label: 'Day' }, input('date'))).toBe('Enter a valid date')
    expect(badInputMessage({ type: 'DATE_TIME', label: 'When' }, input('datetime-local'))).toBe('Enter a valid date and time')
    expect(badInputMessage({ type: 'TIME', label: 'At' }, input('time'))).toBe('Enter a valid time')
  })
})

describe('mapServerErrors', () => {
  const fields = [field('name', 'Name'), field('fullName', 'Full Name'), field('qty', 'Quantity', { type: 'INTEGER' }), field('code', 'Code')]

  it('reads the backend\'s required, too-long and range sentences', () => {
    const result = mapServerErrors([
      'Missing value in required field: Name',
      'The value for Code is too long (max allowed length=5)',
      'The value for Quantity is too small (minimum allowed value is 1)',
    ], fields)
    expect(result).toEqual({
      fieldErrors: {
        name: 'Name is required',
        code: 'The value for Code is too long (max allowed length=5)',
        qty: 'The value for Quantity is too small (minimum allowed value is 1)',
      },
      unmatched: [],
    })
  })

  it("keeps the backend's own range sentence, exclusive bounds included", () => {
    expect(mapServerErrors(['The value for Quantity is too small (minimum allowed value is greater than 0)'], fields).fieldErrors)
      .toEqual({ qty: 'The value for Quantity is too small (minimum allowed value is greater than 0)' })
    expect(mapServerErrors(['The value for Quantity is too large (maximum allowed value is 9)'], fields).fieldErrors)
      .toEqual({ qty: 'The value for Quantity is too large (maximum allowed value is 9)' })
  })

  it('matches any other message by the longest field label it mentions, as whole words', () => {
    expect(mapServerErrors(['Full Name is already taken'], fields).fieldErrors).toEqual({ fullName: 'Full Name is already taken' })
    expect(mapServerErrors(['Namespace clash'], fields).unmatched).toEqual(['Namespace clash'])
  })

  it('leaves messages that name no field, or an ambiguous one, as general errors', () => {
    const twins = [field('a', 'Title'), field('b', 'Title')]
    expect(mapServerErrors(['Title is invalid'], twins)).toEqual({ fieldErrors: {}, unmatched: ['Title is invalid'] })
    expect(mapServerErrors(['The record could not be saved'], fields)).toEqual({ fieldErrors: {}, unmatched: ['The record could not be saved'] })
  })

  it('keeps the first message for a field', () => {
    expect(mapServerErrors(['Missing value in required field: Name', 'Name is wrong'], fields).fieldErrors).toEqual({ name: 'Name is required' })
  })
})
