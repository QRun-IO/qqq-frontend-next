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

// Tests for the saved bulk load profile diff and ownership helpers and the Add Fields groups (#726)

import { describe, it, expect } from 'vitest'

import type { QFieldMetaData } from '@/types'
import { ADD_MANY_FIELD_TOOLTIP, ADD_SINGLE_FIELD_TOOLTIP, ALREADY_ADDED_FIELD_TOOLTIP, addFieldGroups } from './BulkLoadAddFieldsMenu'
import { BulkLoadMapping, FileDescription, type BulkLoadProfile, type BulkLoadTableStructure } from './bulk-load-models'
import { diffBulkLoadMappings, isProfileOwner, splitProfilesByOwner } from './saved-bulk-load-profile-utils'

/**
 * Minimal field metadata.
 * @param name - Field name.
 * @param label - Label.
 * @param isRequired - Required flag.
 * @returns The field.
 */
function field(name: string, label: string, isRequired = false): QFieldMetaData {
  return { name, label, type: 'STRING', isRequired, isEditable: true, isHeavy: false, isHidden: false, adornments: [] }
}

const person: BulkLoadTableStructure = {
  isMain: true, isMany: false, tableName: 'person', label: 'Person', associationPath: null,
  fields: [field('firstName', 'First Name', true), field('email', 'Email', true), field('isEmployed', 'Is Employed'), field('city', 'City')],
  associations: null, isBulkEdit: false, possibleKeyFields: null,
}
const file = new FileDescription(['First Name', 'Email', 'Is Employed', 'City'], ['A', 'B', 'C', 'D'], [[], [], [], []])
const saved: BulkLoadProfile = {
  version: 'v1', hasHeaderRow: true, layout: 'FLAT', isBulkEdit: false, keyFields: null,
  fieldList: [
    { fieldName: 'firstName', columnIndex: 0, headerName: 'First Name' },
    { fieldName: 'email', columnIndex: 1, headerName: 'Email' },
    { fieldName: 'isEmployed', columnIndex: 2, headerName: 'Is Employed', doValueMapping: true, valueMappings: { Yes: true, No: false } },
  ],
}

describe('diffBulkLoadMappings', () => {
  it('finds no changes between a profile and its own mapping', () => {
    expect(diffBulkLoadMappings(file, BulkLoadMapping.fromProfile(person, saved), BulkLoadMapping.fromProfile(person, saved))).toEqual([])
  })

  it('lists header, field set, column, value source, default value, value-mapping flag and value changes in screen order', () => {
    const base = BulkLoadMapping.fromProfile(person, saved)
    const active = BulkLoadMapping.fromProfile(person, saved)
    active.hasHeaderRow = false
    active.addField(active.unusedFields.find((f) => f.getQualifiedName() === 'city')!)
    active.removeField(active.additionalFields.find((f) => f.getQualifiedName() === 'isEmployed')!)
    active.requiredFields[0].columnIndex = 3
    active.requiredFields[1].valueType = 'defaultValue'
    active.requiredFields[1].defaultValue = 'all@example.invalid'
    expect(diffBulkLoadMappings(file, base, active)).toEqual([
      'Changed does the file have a header row? from Yes to No',
      'Added mapping for 1 field: City',
      'Removed mapping for 1 field: Is Employed',
      'Changed First Name file column from (Column A) to (Column D)',
      'Changed Email from using a file column (Column B) to using a default value (all@example.invalid)',
    ])

    const values = BulkLoadMapping.fromProfile(person, saved)
    values.additionalFields[0].doValueMapping = false
    values.valueMappings.isEmployed = { Yes: false, Maybe: true }
    values.layout = null
    expect(diffBulkLoadMappings(file, base, values)).toEqual([
      'Changed layout from Flat to --',
      'Changed Is Employed to not map values',
      'Updated value mapping for Is Employed: Added value for: Maybe; Removed value for: No; Changed value for: Yes',
    ])
  })

  it('compares columns by header name when the file has a header row', () => {
    const base = BulkLoadMapping.fromProfile(person, saved)
    const active = BulkLoadMapping.fromProfile(person, saved)
    active.requiredFields[0].headerName = 'City'
    active.requiredFields[0].columnIndex = 3
    expect(diffBulkLoadMappings(file, base, active)).toEqual(['Changed First Name file column from (First Name) to (City)'])
  })
})

describe('profile ownership', () => {
  const alice = { id: 1, label: 'Mine', tableName: 'person', userId: 'sample:alice', mappingJson: '{}' }
  const bob = { id: 2, label: 'Shared', tableName: 'person', userId: 'sample:bob', mappingJson: '{}' }

  it('splits your profiles from those shared with you', () => {
    expect(splitProfilesByOwner([alice, bob], 'sample:alice')).toEqual({ yours: [alice], shared: [bob] })
    expect(splitProfilesByOwner([alice, bob], undefined)).toEqual({ yours: [], shared: [alice, bob] })
  })

  it('lets only the owner change a profile', () => {
    expect(isProfileOwner(alice, 'sample:alice')).toBe(true)
    expect(isProfileOwner(bob, 'sample:alice')).toBe(false)
    expect(isProfileOwner(alice, undefined)).toBe(false)
  })
})

describe('addFieldGroups', () => {
  const pet: BulkLoadTableStructure = {
    isMain: true, isMany: false, tableName: 'pet', label: 'Pet', associationPath: null, fields: [field('name', 'Name', true), field('birthDate', 'Birth Date')],
    isBulkEdit: false, possibleKeyFields: null,
    associations: [{ isMain: false, isMany: true, tableName: 'petNote', label: 'Pet Note', associationPath: 'notes', fields: [field('note', 'Note', true)], associations: null, isBulkEdit: false, possibleKeyFields: null }],
  }

  it('groups every field by table, disables mapped ones and repeats child fields in a WIDE layout', () => {
    const mapping = new BulkLoadMapping(pet)
    mapping.switchLayout('FLAT')
    expect(addFieldGroups(mapping).map((group) => group.label)).toEqual(['Pet'])
    mapping.switchLayout('TALL')
    const tall = addFieldGroups(mapping)
    expect(tall.map((group) => [group.label, group.path])).toEqual([['Pet', ''], ['Pet Note', 'notes']])
    expect(tall[0].options).toEqual([
      { name: 'name', label: 'Name', disabled: true, tooltip: ALREADY_ADDED_FIELD_TOOLTIP },
      { name: 'birthDate', label: 'Birth Date', disabled: false, tooltip: ADD_SINGLE_FIELD_TOOLTIP },
    ])
    mapping.addField(mapping.unusedFields.find((f) => f.getQualifiedName() === 'notes.note')!)
    expect(addFieldGroups(mapping)[1].options[0]).toMatchObject({ name: 'notes.note', disabled: true })
    mapping.switchLayout('WIDE')
    expect(addFieldGroups(mapping)[1].options[0]).toEqual({ name: 'notes.note', label: 'Note', disabled: false, tooltip: ADD_MANY_FIELD_TOOLTIP })
  })
})
