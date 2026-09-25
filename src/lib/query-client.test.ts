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

// Tests for query key factory

import { describe, it, expect } from 'vitest'
import { queryKeys } from './query-client'

describe('queryKeys factory', () => {
  it('all() returns root key', () => {
    expect(queryKeys.all()).toEqual(['qqq'])
  })

  it('auth() is scoped under all', () => {
    expect(queryKeys.auth()).toEqual(['qqq', 'auth'])
  })

  it('authMeta() extends auth', () => {
    expect(queryKeys.authMeta()).toEqual(['qqq', 'auth', 'metadata'])
  })

  it('metadata() is scoped under all', () => {
    expect(queryKeys.metadata()).toEqual(['qqq', 'metadata'])
  })

  it('metadataAll() extends metadata', () => {
    expect(queryKeys.metadataAll()).toEqual(['qqq', 'metadata', 'all'])
  })

  it('tableMetadata(name) includes table name', () => {
    expect(queryKeys.tableMetadata('person')).toEqual(['qqq', 'metadata', 'table', 'person'])
  })

  it('processMetadata(name) includes process name', () => {
    expect(queryKeys.processMetadata('bulkImport')).toEqual(['qqq', 'metadata', 'process', 'bulkImport'])
  })

  it('records() is scoped under all', () => {
    expect(queryKeys.records()).toEqual(['qqq', 'records'])
  })

  it('tableRecords(name) includes table name', () => {
    expect(queryKeys.tableRecords('order')).toEqual(['qqq', 'records', 'order'])
  })

  it('tableRecord(name, id) includes id', () => {
    expect(queryKeys.tableRecord('order', 42)).toEqual(['qqq', 'records', 'order', '42'])
  })

  it('tableRecord uses one key for numeric and route (string) primary keys', () => {
    // a save invalidates with the saved numeric key; the record view keys by the route string
    expect(queryKeys.tableRecord('order', 42)).toEqual(queryKeys.tableRecord('order', '42'))
  })

  it('tableCount includes filter hash', () => {
    expect(queryKeys.tableCount('person', 'abc123')).toEqual(['qqq', 'records', 'person', 'count', 'abc123'])
  })

  it('processes() is scoped under all', () => {
    expect(queryKeys.processes()).toEqual(['qqq', 'processes'])
  })

  it('processStatus includes all identifiers', () => {
    expect(queryKeys.processStatus('myProc', 'uuid-1', 'job-1')).toEqual([
      'qqq', 'processes', 'myProc', 'uuid-1', 'status', 'job-1',
    ])
  })

  it('widgetData includes widget name and params', () => {
    const params = { date: '2025-01' }
    expect(queryKeys.widgetData('statsWidget', params)).toEqual(['qqq', 'widgets', 'statsWidget', params])
  })

  it('widgetData without params', () => {
    expect(queryKeys.widgetData('simpleWidget')).toEqual(['qqq', 'widgets', 'simpleWidget', undefined])
  })

  it('tablePossibleValues includes all parts', () => {
    expect(queryKeys.tablePossibleValues('order', 'status', 'act')).toEqual([
      'qqq', 'possibleValues', 'table', 'order', 'status', 'act',
    ])
  })

  it('audits extends tableRecord', () => {
    expect(queryKeys.audits('person', 1)).toEqual(['qqq', 'records', 'person', '1', 'audits'])
  })

  it('globalSearch includes search term', () => {
    expect(queryKeys.globalSearch('Alice')).toEqual(['qqq', 'search', 'Alice'])
  })

  it('keys are distinct across different entities', () => {
    const k1 = JSON.stringify(queryKeys.tableMetadata('person'))
    const k2 = JSON.stringify(queryKeys.tableMetadata('order'))
    expect(k1).not.toBe(k2)
  })
})
