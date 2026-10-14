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

// Tests for record-search helpers: searchable tables, term length, result paths

import { describe, it, expect } from 'vitest'

import type { QInstance, QTableMetaData } from '@/types'
import { isRecordSearchTerm, recordSearchResultPath, searchableTables } from './record-search'

function table(name: string, extra: Partial<QTableMetaData>): QTableMetaData {
  return { name, label: name.toUpperCase(), isHidden: false, readPermission: true, ...extra } as QTableMetaData
}

describe('searchableTables', () => {
  it('lists readable, visible tables that declare search fields, in metadata order', () => {
    const metaData = {
      tables: {
        person: table('person', { searchFields: ['firstName'] }),
        pet: table('pet', { searchFields: ['name'], readPermission: false }),
        note: table('note', {}),
        hidden: table('hidden', { searchFields: ['x'], isHidden: true }),
        empty: table('empty', { searchFields: [] }),
        order: table('order', { searchFields: ['orderNo'] }),
      },
    } as unknown as QInstance
    expect(searchableTables(metaData)).toEqual([{ name: 'person', label: 'PERSON' }, { name: 'order', label: 'ORDER' }])
  })

  it('carries the table icon for result groups', () => {
    const metaData = { tables: { person: table('person', { searchFields: ['firstName'], icon: { name: 'person' } }) } } as unknown as QInstance
    expect(searchableTables(metaData)).toEqual([{ name: 'person', label: 'PERSON', icon: { name: 'person' } }])
  })

  it('is empty without metadata or without any declaration (no record search capability)', () => {
    expect(searchableTables(undefined)).toEqual([])
    expect(searchableTables({ tables: { person: table('person', {}) } } as unknown as QInstance)).toEqual([])
  })
})

describe('isRecordSearchTerm / recordSearchResultPath', () => {
  it('needs two characters after trimming', () => {
    expect(isRecordSearchTerm(' a ')).toBe(false)
    expect(isRecordSearchTerm(' ab ')).toBe(true)
  })

  it('links to the record view, encoding both segments', () => {
    expect(recordSearchResultPath({ tableName: 'person', recordId: '1', recordLabel: 'x' })).toBe('/app/person/1')
    expect(recordSearchResultPath({ tableName: 'file', recordId: 'a/b c', recordLabel: 'x' })).toBe('/app/file/a%2Fb%20c')
  })
})
