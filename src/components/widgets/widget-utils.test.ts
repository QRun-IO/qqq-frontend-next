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

// Tests for widget export, dropdown storage and sizing helpers

import { describe, it, expect, beforeEach } from 'vitest'

import type { QWidgetMetaData } from '@/types'
import {
  dropdownParamName, dropdownStorageKey, plainText, readStoredSelection, storedDropdownParams, widgetColumnClasses,
  widgetCsvToString, widgetExportFileName, writeStoredSelection,
} from './widget-utils'

describe('widgetCsvToString', () => {
  it('quotes text and zero like the Material dashboard and leaves other numbers bare', () => {
    expect(widgetCsvToString([['Label', 'Value'], ['A,"B"', 7], ['Beta', 0], [null, undefined]]))
      .toBe('"Label","Value"\n"A,""B""",7\n"Beta","0"\n"",""\n')
  })
})

describe('widgetExportFileName', () => {
  it('uses the label and a local date-time stamp', () => {
    expect(widgetExportFileName('Owned Export', new Date(2026, 0, 5, 7, 3))).toBe('Owned Export 2026-01-05 0703.csv')
  })
})

describe('dropdown selections', () => {
  beforeEach(() => localStorage.clear())

  it('sends PVS dropdowns under the source name and date pickers under their name', () => {
    expect(dropdownParamName({ name: 'x', label: 'Choice', possibleValueSourceName: 'accChoice' })).toBe('accChoice')
    expect(dropdownParamName({ name: 'accDate', label: 'Day', type: 'DATE_PICKER' })).toBe('accDate')
  })

  it('persists, reads and clears selections under the Material storage key', () => {
    const key = dropdownStorageKey('accControls', 'accChoice')
    expect(key).toBe('qqq.widgets.dropdownData.accControls.accChoice')
    writeStoredSelection(key, { id: 'beta', label: 'Beta' })
    expect(readStoredSelection(key)).toEqual({ id: 'beta', label: 'Beta' })
    writeStoredSelection(key, null)
    expect(readStoredSelection(key)).toBeNull()
    localStorage.setItem(key, 'not json')
    expect(readStoredSelection(key)).toBeNull()
  })

  it('reads stored params only for widgets (or parents) that store selections', () => {
    const parent: QWidgetMetaData = {
      name: 'accControls', label: 'Controls', hasPermission: true, storeDropdownSelections: true,
      dropdowns: [{ name: 'c', label: 'Choice', possibleValueSourceName: 'accChoice' }, { name: 'accDate', label: 'Day', type: 'DATE_PICKER' }],
    }
    writeStoredSelection(dropdownStorageKey('accControls', 'accChoice'), { id: 'beta' })
    writeStoredSelection(dropdownStorageKey('accControls', 'accDate'), { id: '2026-01-15' })
    expect(storedDropdownParams(parent)).toEqual({ accChoice: 'beta', accDate: '2026-01-15' })
    const child: QWidgetMetaData = { name: 'accControlValues', label: 'Values', hasPermission: true }
    expect(storedDropdownParams(child, parent)).toEqual({ accChoice: 'beta', accDate: '2026-01-15' })
    expect(storedDropdownParams({ ...parent, storeDropdownSelections: false })).toEqual({})
  })
})

describe('widgetColumnClasses', () => {
  it('maps gridColumns (twelfths) to spans, defaulting to full width', () => {
    expect(widgetColumnClasses(4)).toBe('col-span-12 lg:col-span-4')
    expect(widgetColumnClasses(12)).toBe('col-span-12 lg:col-span-12')
    expect(widgetColumnClasses(undefined)).toBe('col-span-12 lg:col-span-12')
    expect(widgetColumnClasses(40)).toBe('col-span-12 lg:col-span-12')
  })
})

describe('plainText', () => {
  it('strips tags and common entities', () => {
    expect(plainText('<b>Tom</b> &amp; Jerry&nbsp;')).toBe('Tom & Jerry')
    expect(plainText(null)).toBe('')
  })
})
