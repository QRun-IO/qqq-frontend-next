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

// Tests for the bulk load mapping model (#660)

import { describe, it, expect } from 'vitest'

import type { QFieldMetaData } from '@/types'
import { BulkLoadMapping, FileDescription, profileSubmitValues, type BulkLoadTableStructure } from './bulk-load-models'

/**
 * Minimal field metadata.
 * @param name - Field name.
 * @param isRequired - Required flag.
 * @returns The field.
 */
function field(name: string, isRequired = false): QFieldMetaData {
  return { name, label: name[0].toUpperCase() + name.slice(1), type: 'STRING', isRequired, isEditable: true, isHeavy: false, isHidden: false, adornments: [] }
}

const person: BulkLoadTableStructure = {
  isMain: true, isMany: false, tableName: 'person', label: 'Person', associationPath: null,
  fields: [field('firstName', true), field('email', true), field('isEmployed')],
  associations: null, isBulkEdit: false, possibleKeyFields: null,
}

describe('BulkLoadMapping', () => {
  it('puts required fields first and defaults to a flat layout without associations', () => {
    const mapping = new BulkLoadMapping(person)
    expect(mapping.requiredFields.map((f) => f.getQualifiedName())).toEqual(['firstName', 'email'])
    expect(mapping.unusedFields.map((f) => f.getQualifiedName())).toEqual(['isEmployed'])
    expect(mapping.layout).toBe('FLAT')
  })

  it('builds from the suggested profile and converts back to the backend profile', () => {
    const mapping = BulkLoadMapping.fromProfile(person, {
      version: 'v1', hasHeaderRow: true, layout: 'FLAT', isBulkEdit: false, keyFields: null,
      fieldList: [
        { fieldName: 'firstName', columnIndex: 0, headerName: 'First Name' },
        { fieldName: 'email', columnIndex: 2, headerName: 'Email' },
        { fieldName: 'isEmployed', columnIndex: 3, headerName: 'Is Employed', doValueMapping: true, valueMappings: { Yes: true } },
      ],
    })
    expect(mapping.additionalFields.map((f) => f.getQualifiedName())).toEqual(['isEmployed'])
    expect(mapping.unusedFields).toEqual([])
    const { haveErrors, profile } = mapping.toProfile()
    expect(haveErrors).toBe(false)
    expect(profile.fieldList).toEqual([
      { fieldName: 'firstName', columnIndex: 0, headerName: 'First Name', doValueMapping: false, clearIfEmpty: false },
      { fieldName: 'email', columnIndex: 2, headerName: 'Email', doValueMapping: false, clearIfEmpty: false },
      { fieldName: 'isEmployed', columnIndex: 3, headerName: 'Is Employed', doValueMapping: true, clearIfEmpty: false, valueMappings: { Yes: true } },
    ])
    expect(profileSubmitValues(mapping, profile)).toEqual({
      version: 'v1', fieldListJSON: JSON.stringify(profile.fieldList), layout: 'FLAT', hasHeaderRow: 'true', isBulkEdit: 'false',
    })
  })

  it('marks unmapped columns and empty default values as errors', () => {
    const mapping = new BulkLoadMapping(person)
    mapping.requiredFields[1].valueType = 'defaultValue'
    const { haveErrors, profile } = mapping.toProfile()
    expect(haveErrors).toBe(true)
    expect(mapping.requiredFields.map((f) => f.error)).toEqual(['You must select a column.', 'A value is required.'])
    expect(profile.fieldList).toEqual([])
    mapping.requiredFields[1].defaultValue = 'all@example.invalid'
    mapping.requiredFields[0].columnIndex = 0
    expect(mapping.toProfile().profile.fieldList).toEqual([
      { fieldName: 'firstName', columnIndex: 0, headerName: null, doValueMapping: false, clearIfEmpty: false },
      { fieldName: 'email', defaultValue: 'all@example.invalid' },
    ])
  })

  it('adds and removes additional fields, and uses key fields for bulk edit', () => {
    const mapping = new BulkLoadMapping(person)
    const added = mapping.addField(mapping.unusedFields[0])
    expect(mapping.additionalFields).toEqual([added])
    mapping.removeField(added)
    expect(mapping.additionalFields).toEqual([])
    expect(mapping.unusedFields.map((f) => f.getQualifiedName())).toEqual(['isEmployed'])

    const edit = BulkLoadMapping.fromProfile({ ...person, isBulkEdit: true, possibleKeyFields: ['email'] }, {
      version: 'v1', hasHeaderRow: true, layout: null, isBulkEdit: true, keyFields: null, fieldList: [{ fieldName: 'email', columnIndex: 0 }],
    })
    expect(edit.keyFields).toBe('email')
  })
})

describe('FileDescription', () => {
  it('names columns by header or letter and previews values', () => {
    const file = new FileDescription(['First', 'First'], ['A', 'B'], [['x', 'y'], [{ string: 'z' }, null]])
    expect(file.columnNames(true)).toEqual(['First', 'First'])
    expect(file.columnNames(false)).toEqual(['Column A', 'Column B'])
    expect(file.duplicateHeaderIndexes).toEqual([false, true])
    expect(file.previewValues(1, true)).toEqual(['z', ''])
    expect(file.previewValues(0, false)).toEqual(['First', 'x', 'y'])
    expect(file.previewValues(null, true)).toEqual([])
  })
})
