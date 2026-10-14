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

// Tests for the record picker helpers

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { QFieldMetaData, QPossibleValuePicker } from '@/types'
import {
  DEFAULT_PICKER_PREFERENCES,
  pickerCriteria,
  pickerFilterKind,
  pickerPageRequest,
  pickerStorageKey,
  readPickerPreferences,
  writePickerPreferences,
} from './record-picker-query'
import { pickerPreviewUrl, pickerRecordPath, pickerSubtitle, pickerThumbnailUrl } from './record-picker'

const field = (name: string, type: QFieldMetaData['type'], extra: Partial<QFieldMetaData> = {}): QFieldMetaData =>
  ({ name, label: name, type, isRequired: false, isEditable: true, isHeavy: false, isHidden: false, adornments: [], ...extra })

const FIELDS: Record<string, QFieldMetaData> = {
  id: field('id', 'LONG'),
  mediaTypeId: field('mediaTypeId', 'LONG', { possibleValueSourceName: 'mediaType' }),
  isActive: field('isActive', 'BOOLEAN'),
  mimeType: field('mimeType', 'STRING'),
  width: field('width', 'INTEGER'),
  createDate: field('createDate', 'DATE_TIME'),
  takenOn: field('takenOn', 'DATE'),
}

const PICKER: QPossibleValuePicker = {
  thumbnailField: 'thumbnailUrl',
  previewField: 'galleryUrl',
  subtitleFields: ['mediaTypeId', 'width'],
  sorts: [{ label: 'Newest', fieldName: 'id', isAscending: false }, { label: 'Name', fieldName: 'name', isAscending: true }],
}

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('pickerFilterKind', () => {
  it('chooses a control by possible values, then type', () => {
    expect(pickerFilterKind(FIELDS.mediaTypeId)).toBe('choice')
    expect(pickerFilterKind(FIELDS.isActive)).toBe('boolean')
    expect(pickerFilterKind(FIELDS.mimeType)).toBe('text')
    expect(pickerFilterKind(FIELDS.width)).toBe('number')
    expect(pickerFilterKind(FIELDS.createDate)).toBe('date')
  })
})

describe('pickerCriteria', () => {
  it('builds equality, contains and inclusive range criteria, skipping empty filters', () => {
    const criteria = pickerCriteria({
      mediaTypeId: { value: '3' },
      isActive: { value: 'false' },
      mimeType: { value: ' png ' },
      width: { from: '800', to: 'x' },
      createDate: { from: '2026-01-01', to: '2026-01-31' },
      takenOn: { to: '2026-02-01' },
      unknown: { value: 'ignored' },
    }, FIELDS)
    expect(criteria).toEqual([
      { fieldName: 'mediaTypeId', operator: 'EQUALS', values: ['3'] },
      { fieldName: 'isActive', operator: 'EQUALS', values: [false] },
      { fieldName: 'mimeType', operator: 'CONTAINS', values: ['png'] },
      { fieldName: 'width', operator: 'GREATER_THAN_OR_EQUALS', values: [800] },
      { fieldName: 'createDate', operator: 'GREATER_THAN_OR_EQUALS', values: ['2026-01-01T00:00:00Z'] },
      { fieldName: 'createDate', operator: 'LESS_THAN_OR_EQUALS', values: ['2026-01-31T23:59:59Z'] },
      { fieldName: 'takenOn', operator: 'LESS_THAN_OR_EQUALS', values: ['2026-02-01'] },
    ])
    expect(pickerCriteria({ mimeType: { value: '  ' }, mediaTypeId: { value: '' } }, FIELDS)).toEqual([])
  })
})

describe('pickerPageRequest', () => {
  const options = [{ id: 9, label: 'a' }, { id: 7, label: 'b' }]

  it('pages a primary-key ordering by keyset, after the last id', () => {
    const first = pickerPageRequest(PICKER, DEFAULT_PICKER_PREFERENCES, FIELDS, 'id', [])
    expect(first).toEqual({ filter: { criteria: [], booleanOperator: 'AND', orderBys: [{ fieldName: 'id', isAscending: false }] } })
    expect(pickerPageRequest(PICKER, DEFAULT_PICKER_PREFERENCES, FIELDS, 'id', options).afterId).toBe(7)
  })

  it('pages other orderings by offset', () => {
    const request = pickerPageRequest(PICKER, { ...DEFAULT_PICKER_PREFERENCES, sortIndex: 1 }, FIELDS, 'id', options)
    expect(request.filter?.orderBys).toEqual([{ fieldName: 'name', isAscending: true }])
    expect(request.skip).toBe(2)
    expect(request.afterId).toBeUndefined()
  })

  it('falls back to the first ordering for a stale remembered index', () => {
    expect(pickerPageRequest(PICKER, { ...DEFAULT_PICKER_PREFERENCES, sortIndex: 7 }, FIELDS, 'id', []).filter?.orderBys?.[0].fieldName).toBe('id')
  })
})

describe('option display', () => {
  const option = {
    id: 1,
    label: 'Harbor',
    values: { thumbnailUrl: '/t/harbor.jpg', galleryUrl: 'javascript:alert(1)', mediaTypeId: 3, width: 1200 },
    displayValues: { mediaTypeId: 'Photo', width: '1,200' },
  }

  it('uses safe thumbnail URLs and falls back from an unsafe preview URL', () => {
    expect(pickerThumbnailUrl(option, PICKER)).toBe('/t/harbor.jpg')
    expect(pickerPreviewUrl(option, PICKER)).toBe('/t/harbor.jpg')
    expect(pickerThumbnailUrl({ id: 2, label: 'x', values: { thumbnailUrl: 'javascript:alert(1)' } }, PICKER)).toBeUndefined()
    expect(pickerThumbnailUrl(option, undefined)).toBeUndefined()
  })

  it('joins formatted subtitle values', () => {
    expect(pickerSubtitle(option, PICKER)).toBe('Photo · 1,200')
    expect(pickerSubtitle({ id: 3, label: 'y' }, PICKER)).toBe('')
  })

  it('links to the record view', () => {
    expect(pickerRecordPath('media', 'a/b')).toBe('/app/media/a%2Fb')
  })
})

describe('preferences', () => {
  it('round-trips through local storage per table and field', () => {
    const key = pickerStorageKey('media', 'featuredMediaId')
    expect(readPickerPreferences(key)).toEqual(DEFAULT_PICKER_PREFERENCES)
    writePickerPreferences(key, { filters: { isActive: { value: 'true' } }, sortIndex: 1, view: 'list' })
    expect(readPickerPreferences(key)).toEqual({ filters: { isActive: { value: 'true' } }, sortIndex: 1, view: 'list' })
    expect(readPickerPreferences(pickerStorageKey('media', 'otherField'))).toEqual(DEFAULT_PICKER_PREFERENCES)
  })

  it('survives corrupt entries and unavailable storage', () => {
    localStorage.setItem('k', '{not json')
    expect(readPickerPreferences('k')).toEqual(DEFAULT_PICKER_PREFERENCES)
    localStorage.setItem('k', JSON.stringify({ filters: 'x', sortIndex: 'y', view: 'z' }))
    expect(readPickerPreferences('k')).toEqual(DEFAULT_PICKER_PREFERENCES)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(() => writePickerPreferences('k', DEFAULT_PICKER_PREFERENCES)).not.toThrow()
  })
})
