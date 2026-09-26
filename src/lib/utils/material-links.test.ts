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

// Material Dashboard link compatibility (QRun-IO/qqq#714)

import { describe, expect, it } from 'vitest'

import type { QInstance, QTableMetaData } from '@/types'
import {
  formPresetsFromHash, lockedPresetValues, parseHashParams, processRunHref, withTrailingSlash, recordHashAction, tableProcessForSegment, tableReportForSegment,
} from './material-links'

// The exact shape AbstractHTMLWidgetRenderer.linkTableCreateChild builds.
const CREATE_CHILD = `#/createChild=pet/defaultValues=${encodeURIComponent('{"ownerId":7,"name":"a/b"}')}/disabledFields=${encodeURIComponent('{"ownerId":1}')}`

const instance = {
  processes: {
    'person.bulkEdit': { name: 'person.bulkEdit', label: 'Bulk Edit', tableName: 'person' },
    runRecordScript: { name: 'runRecordScript', label: 'Run Record Script' },
    'pet.bulkEdit': { name: 'pet.bulkEdit', label: 'Bulk Edit', tableName: 'pet' },
  },
  reports: {
    personReport: { name: 'personReport', label: 'Person Report', tableName: 'person' },
  },
} as unknown as QInstance

describe('parseHashParams', () => {
  it('reads slash-separated name=value parts with or without the leading slash', () => {
    expect(parseHashParams('#/launchProcess=person.bulkEdit')).toEqual({ launchProcess: 'person.bulkEdit' })
    expect(parseHashParams('#defaultValues=%7B%22a%22%3A1%7D')).toEqual({ defaultValues: '{"a":1}' })
    expect(parseHashParams('#audit')).toEqual({})
    expect(parseHashParams('')).toEqual({})
  })
})

describe('recordHashAction', () => {
  it('recognizes audit, launchProcess, createChild and section anchors', () => {
    expect(recordHashAction('#audit')).toEqual({ type: 'audit' })
    expect(recordHashAction('#/launchProcess=pet.bulkInsert')).toEqual({ type: 'launchProcess', processName: 'pet.bulkInsert' })
    expect(recordHashAction(CREATE_CHILD)).toEqual({ type: 'createChild', tableName: 'pet', defaultValues: { ownerId: 7, name: 'a/b' }, disabledFields: ['ownerId'] })
    expect(recordHashAction('#employment')).toEqual({ type: 'section', name: 'employment' })
    expect(recordHashAction('')).toBeNull()
    expect(recordHashAction('#/unknown=1')).toBeNull()
  })
})

describe('formPresetsFromHash', () => {
  it('accepts disabledFields as an object or a list and ignores malformed JSON', () => {
    expect(formPresetsFromHash(`#/defaultValues=${encodeURIComponent('{"a":1,"b":"x"}')}/disabledFields=${encodeURIComponent('["b"]')}`))
      .toEqual({ defaultValues: { a: 1, b: 'x' }, disabledFields: ['b'] })
    expect(formPresetsFromHash('#/defaultValues=not-json/disabledFields={')).toEqual({ defaultValues: {}, disabledFields: [] })
    expect(formPresetsFromHash('')).toEqual({ defaultValues: {}, disabledFields: [] })
  })

  it('submits only locked scalar values of declared fields', () => {
    const table = { fields: { ownerId: { name: 'ownerId' }, name: { name: 'name' } } } as unknown as QTableMetaData
    expect(lockedPresetValues(table, { defaultValues: { ownerId: 7, name: 'x', ghost: 1 }, disabledFields: ['ownerId', 'ghost'] })).toEqual({ ownerId: 7 })
  })
})

describe('table-scoped paths', () => {
  it('resolves the table’s processes, instance-wide processes and suffixes only after a record id', () => {
    expect(tableProcessForSegment(instance, 'person', 'person.bulkEdit')).toBe('person.bulkEdit')
    expect(tableProcessForSegment(instance, 'person', 'runRecordScript')).toBe('runRecordScript')
    expect(tableProcessForSegment(instance, 'person', 'bulkEdit')).toBeNull()
    expect(tableProcessForSegment(instance, 'person', 'bulkEdit', true)).toBe('person.bulkEdit')
    expect(tableProcessForSegment(instance, 'person', '42')).toBeNull()
    expect(tableReportForSegment(instance, 'person', 'personReport')).toBe('personReport')
    expect(tableReportForSegment(instance, 'pet', 'personReport')).toBeNull()
  })

  it('builds the process URL with the record, the original selection and the way back', () => {
    expect(processRunHref('person.bulkEdit', { recordId: 3, returnTo: '/app/person/3' }))
      .toBe('/app/person.bulkEdit/?recordsParam=recordIds&recordIds=3&returnTo=%2Fapp%2Fperson%2F3')
    expect(processRunHref('person.bulkEdit', { search: '?recordsParam=recordIds&recordIds=1,2', returnTo: '/app/person' }))
      .toBe('/app/person.bulkEdit/?recordsParam=recordIds&recordIds=1%2C2&returnTo=%2Fapp%2Fperson')
  })
})

describe('withTrailingSlash', () => {
  it('adds the slash a dotted last segment would otherwise lose, keeping the query and hash', () => {
    expect(withTrailingSlash('/app/person.bulkEdit?recordIds=1%2C2&returnTo=%2Fapp%2Fperson')).toBe('/app/person.bulkEdit/?recordIds=1%2C2&returnTo=%2Fapp%2Fperson')
    expect(withTrailingSlash('/app/person.bulkEdit#step')).toBe('/app/person.bulkEdit/#step')
    expect(withTrailingSlash('/app/person')).toBe('/app/person/')
  })

  it('leaves an href that already ends its path with a slash unchanged', () => {
    expect(withTrailingSlash('/app/person/?page=2')).toBe('/app/person/?page=2')
    expect(withTrailingSlash('/app/')).toBe('/app/')
  })
})
