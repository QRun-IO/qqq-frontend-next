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
 * Tests for the Zod API boundary schemas in schemas.ts.
 *
 * Verifies that valid data passes all schemas and that common invalid shapes
 * (missing required fields, wrong types) produce parse failures — not
 * thrown errors, since all consumers use `safeParse`.
 */

import { describe, it, expect } from 'vitest'
import {
  QRecordSchema,
  QueryRecordsResponseSchema,
  CountRecordsResponseSchema,
  RecordSearchResultSchema,
  RecordSearchResponseSchema,
  QInstanceMinimalSchema,
} from './schemas'

// ---------------------------------------------------------------------------
// QRecordSchema
// ---------------------------------------------------------------------------

describe('QRecordSchema', () => {
  it('accepts a record with required fields', () => {
    const result = QRecordSchema.safeParse({
      tableName: 'person',
      recordLabel: 'Alice',
      values: { id: 1, name: 'Alice' },
    })
    expect(result.success).toBe(true)
  })

  it('accepts a record with both values and displayValues', () => {
    const result = QRecordSchema.safeParse({
      tableName: 'order',
      recordLabel: 'Order #1',
      values: { id: 1, amount: 9.99 },
      displayValues: { amount: '$9.99' },
    })
    expect(result.success).toBe(true)
  })

  it('accepts a record with an empty values map', () => {
    const result = QRecordSchema.safeParse({
      tableName: 'person',
      recordLabel: '',
      values: {},
    })
    expect(result.success).toBe(true)
  })

  it('accepts legacy writes without a label and normalizes native status messages', () => {
    expect(QRecordSchema.parse({ tableName: 'person', values: { id: 1 },
      errors: [{ message: 'Invalid value' }], warnings: ['Review'],
    })).toEqual({ tableName: 'person', values: { id: 1 }, errors: ['Invalid value'], warnings: ['Review'] })
  })

  it('fails when values is missing', () => {
    const result = QRecordSchema.safeParse({ displayValues: { name: 'Alice' } })
    expect(result.success).toBe(false)
  })

  it('fails when values is not an object', () => {
    const result = QRecordSchema.safeParse({ values: 'not-an-object' })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// QueryRecordsResponseSchema
// ---------------------------------------------------------------------------

describe('QueryRecordsResponseSchema', () => {
  it('accepts a valid response with an array of records', () => {
    const result = QueryRecordsResponseSchema.safeParse({
      records: [
        { tableName: 'person', recordLabel: 'Alice', values: { id: 1, name: 'Alice' }, displayValues: { name: 'Alice' } },
        { tableName: 'person', recordLabel: 'Bob', values: { id: 2, name: 'Bob' } },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('accepts a response with an empty records array', () => {
    const result = QueryRecordsResponseSchema.safeParse({ records: [] })
    expect(result.success).toBe(true)
  })

  it('fails when records array is missing', () => {
    const result = QueryRecordsResponseSchema.safeParse({ total: 0 })
    expect(result.success).toBe(false)
  })

  it('fails when records is not an array', () => {
    const result = QueryRecordsResponseSchema.safeParse({ records: 'none' })
    expect(result.success).toBe(false)
  })

  it('fails when a record in the array is missing values', () => {
    const result = QueryRecordsResponseSchema.safeParse({
      records: [{ displayValues: { name: 'Alice' } }],
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// CountRecordsResponseSchema
// ---------------------------------------------------------------------------

describe('CountRecordsResponseSchema', () => {
  it('accepts a response with count only', () => {
    const result = CountRecordsResponseSchema.safeParse({ count: 42 })
    expect(result.success).toBe(true)
  })

  it('accepts a response with both count and distinctCount', () => {
    const result = CountRecordsResponseSchema.safeParse({ count: 42, distinctCount: 38 })
    expect(result.success).toBe(true)
  })

  it('accepts count of zero', () => {
    const result = CountRecordsResponseSchema.safeParse({ count: 0 })
    expect(result.success).toBe(true)
  })

  it('fails when count is missing', () => {
    const result = CountRecordsResponseSchema.safeParse({ distinctCount: 10 })
    expect(result.success).toBe(false)
  })

  it('fails when count is not a number', () => {
    const result = CountRecordsResponseSchema.safeParse({ count: '42' })
    expect(result.success).toBe(false)
  })

  it('fails when distinctCount is not a number', () => {
    const result = CountRecordsResponseSchema.safeParse({ count: 42, distinctCount: 'many' })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// RecordSearchResultSchema
// ---------------------------------------------------------------------------

describe('RecordSearchResultSchema', () => {
  it('accepts a full search result entry', () => {
    const result = RecordSearchResultSchema.safeParse({
      tableName: 'person',
      tableLabel: 'People',
      recordId: '123',
      recordLabel: 'Alice Smith',
    })
    expect(result.success).toBe(true)
  })

  it('accepts an entry without optional tableLabel', () => {
    const result = RecordSearchResultSchema.safeParse({
      tableName: 'person',
      recordId: '123',
      recordLabel: 'Alice Smith',
    })
    expect(result.success).toBe(true)
  })

  it('fails when tableName is missing', () => {
    const result = RecordSearchResultSchema.safeParse({
      tableLabel: 'People',
      recordId: '123',
      recordLabel: 'Alice Smith',
    })
    expect(result.success).toBe(false)
  })

  it('fails when recordId is missing', () => {
    const result = RecordSearchResultSchema.safeParse({
      tableName: 'person',
      recordLabel: 'Alice Smith',
    })
    expect(result.success).toBe(false)
  })

  it('fails when recordLabel is missing', () => {
    const result = RecordSearchResultSchema.safeParse({
      tableName: 'person',
      recordId: '123',
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// RecordSearchResponseSchema ({ results: [...] })
// ---------------------------------------------------------------------------

describe('RecordSearchResponseSchema', () => {
  it('accepts a list of valid search results', () => {
    const result = RecordSearchResponseSchema.safeParse({ results: [
      { tableName: 'person', recordId: '1', recordLabel: 'Alice' },
      { tableName: 'order', tableLabel: 'Orders', recordId: '42', recordLabel: 'Order #42' },
    ] })
    expect(result.success).toBe(true)
  })

  it('accepts an empty list', () => {
    expect(RecordSearchResponseSchema.safeParse({ results: [] }).success).toBe(true)
  })

  it('fails for a bare array or a missing list', () => {
    expect(RecordSearchResponseSchema.safeParse([]).success).toBe(false)
    expect(RecordSearchResponseSchema.safeParse({}).success).toBe(false)
  })

  it('fails when a result is missing required fields', () => {
    const result = RecordSearchResponseSchema.safeParse({ results: [
      { tableName: 'person' }, // missing recordId and recordLabel
    ] })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// QInstanceMinimalSchema
// ---------------------------------------------------------------------------

describe('QInstanceMinimalSchema', () => {
  const validInstance = {
    apps: { myApp: { name: 'myApp', label: 'My App' } },
    appTree: [{ name: 'myApp', label: 'My App', type: 'APP' }],
    tables: { person: { name: 'person', label: 'People' } },
    processes: { importPeople: { name: 'importPeople', label: 'Import People' } },
    branding: {
      companyName: 'Acme Corp',
      companyUrl: 'https://acme.example.com',
      appName: 'Acme Admin',
    },
  }

  it('accepts a valid minimal QInstance', () => {
    const result = QInstanceMinimalSchema.safeParse(validInstance)
    expect(result.success).toBe(true)
  })

  it('accepts a QInstance with additional fields beyond the schema', () => {
    const result = QInstanceMinimalSchema.safeParse({
      ...validInstance,
      reports: {},
      widgets: {},
      helpContents: {},
      environmentValues: {},
    })
    expect(result.success).toBe(true)
  })

  it('fails when apps is missing', () => {
    const { apps: _apps, ...rest } = validInstance
    const result = QInstanceMinimalSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('fails when appTree is missing', () => {
    const { appTree: _appTree, ...rest } = validInstance
    const result = QInstanceMinimalSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('fails when tables is missing', () => {
    const { tables: _tables, ...rest } = validInstance
    const result = QInstanceMinimalSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('fails when processes is missing', () => {
    const { processes: _processes, ...rest } = validInstance
    const result = QInstanceMinimalSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('accepts instances without branding (branding is optional in QQQ)', () => {
    const { branding: _branding, ...rest } = validInstance
    const result = QInstanceMinimalSchema.safeParse(rest)
    expect(result.success).toBe(true)
  })

  it('accepts the sample branding shape (appName, logo, icon; no company fields)', () => {
    const result = QInstanceMinimalSchema.safeParse({
      ...validInstance,
      branding: { appName: 'QQQ Sample', logo: '/samples-logo.png', icon: '/kr-icon.png' },
    })
    expect(result.success).toBe(true)
  })

  it('fails when a branding name is not a string', () => {
    const result = QInstanceMinimalSchema.safeParse({
      ...validInstance,
      branding: { appName: 42 },
    })
    expect(result.success).toBe(false)
  })
})
