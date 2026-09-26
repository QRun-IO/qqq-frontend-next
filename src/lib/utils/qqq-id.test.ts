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

// The Material data-qqq-id contract (QRun-IO/qqq#731): expected values are what Material
// Dashboard's qqqIdUtils returns for the same input.

import React from 'react'
import { describe, expect, it } from 'vitest'
import {
  MATERIAL_BUTTON_VARIANTS,
  buttonQqqId,
  formFieldQqqId,
  inputQqqId,
  linkQqqId,
  menuItemQqqId,
  navItemQqqId,
  sanitizeQqqId,
  selectQqqId,
  switchQqqId,
  tabQqqId,
  tableHeaderQqqId,
  textOfChildren,
} from './qqq-id'

describe('sanitizeQqqId', () => {
  it('lowercases and turns every run of other characters into one dash', () => {
    expect(sanitizeQqqId('Bulk Edit')).toBe('bulk-edit')
    expect(sanitizeQqqId('Bulk Edit With File')).toBe('bulk-edit-with-file')
    expect(sanitizeQqqId('  People -- App!! ')).toBe('people-app')
    expect(sanitizeQqqId('person.bulkEdit')).toBe('person-bulkedit')
    expect(sanitizeQqqId('Über café #2')).toBe('ber-caf-2')
  })

  it('does not split camel case (Material behavior)', () => {
    expect(sanitizeQqqId('firstName')).toBe('firstname')
    expect(sanitizeQqqId('employmentInfo')).toBe('employmentinfo')
  })

  it('trims leading and trailing dashes and cuts to 50 characters', () => {
    expect(sanitizeQqqId('---x---')).toBe('x')
    const long = 'a'.repeat(60)
    expect(sanitizeQqqId(long)).toHaveLength(50)
    // cut after trimming, as Material does (a trailing dash can survive the cut)
    expect(sanitizeQqqId(`${'a'.repeat(49)} b`)).toBe(`${'a'.repeat(49)}-`)
  })

  it('returns an empty string for empty input', () => {
    expect(sanitizeQqqId('')).toBe('')
    expect(sanitizeQqqId(undefined)).toBe('')
    expect(sanitizeQqqId(null)).toBe('')
    expect(sanitizeQqqId('!!!')).toBe('')
  })
})

describe('textOfChildren', () => {
  it('reads strings, numbers, arrays and nested elements', () => {
    expect(textOfChildren('Save')).toBe('Save')
    expect(textOfChildren(3)).toBe('3')
    expect(textOfChildren(['Create', React.createElement('span', null, 'New')])).toBe('Create New')
    expect(textOfChildren(React.createElement('b', null, React.createElement('i', null, 'Deep')))).toBe('Deep')
    expect(textOfChildren(null)).toBe('')
  })
})

describe('type-prefixed builders', () => {
  it('buttons: explicit id, then text, then icon', () => {
    expect(buttonQqqId('Create New')).toBe('button-create-new')
    expect(buttonQqqId(undefined, 'Save')).toBe('button-save')
    expect(buttonQqqId(undefined, [React.createElement('svg', { key: 1 }), 'Log Out'])).toBe('button-log-out')
    expect(buttonQqqId(undefined, undefined, 'edit')).toBe('button-icon-edit')
    expect(buttonQqqId()).toBeUndefined()
  })

  it('inputs, selects and switches: explicit id, then field name, then label', () => {
    expect(inputQqqId(undefined, 'firstName', 'First Name')).toBe('input-firstname')
    expect(inputQqqId(undefined, undefined, 'First Name')).toBe('input-first-name')
    expect(inputQqqId('custom')).toBe('input-custom')
    expect(selectQqqId(undefined, 'homeStateId')).toBe('select-homestateid')
    expect(switchQqqId(undefined, 'isEmployed')).toBe('switch-isemployed')
    expect(inputQqqId()).toBeUndefined()
  })

  it('navigation items: explicit id, then name, then the last route segment', () => {
    expect(navItemQqqId(undefined, 'People App')).toBe('sidenav-people-app')
    expect(navItemQqqId(undefined, undefined, '/app/peopleApp/')).toBe('sidenav-peopleapp')
    expect(navItemQqqId()).toBeUndefined()
  })

  it('menu items and tabs: explicit id, then text, then index', () => {
    expect(menuItemQqqId(undefined, 'Developer Mode')).toBe('menu-item-developer-mode')
    expect(menuItemQqqId(undefined, undefined, 2)).toBe('menu-item-2')
    expect(tabQqqId(undefined, 'Related Records')).toBe('tab-related-records')
    expect(tabQqqId(undefined, undefined, 0)).toBe('tab-0')
  })

  it('table headers and links', () => {
    expect(tableHeaderQqqId(undefined, 'firstName', 'First Name')).toBe('table-header-firstname')
    expect(tableHeaderQqqId(undefined, undefined, 'First Name')).toBe('table-header-first-name')
    expect(linkQqqId(undefined, 'Back to People')).toBe('link-back-to-people')
    expect(linkQqqId(undefined, undefined, '/app/person/12')).toBe('link-12')
  })

  it('form fields: select for possible values, switch for booleans, input otherwise', () => {
    expect(formFieldQqqId({ name: 'homeStateId', type: 'INTEGER', possibleValueSourceName: 'state' })).toBe('select-homestateid')
    expect(formFieldQqqId({ name: 'isEmployed', type: 'BOOLEAN' })).toBe('switch-isemployed')
    expect(formFieldQqqId({ name: 'firstName', type: 'STRING' })).toBe('input-firstname')
  })

  it('maps Material default buttons to their MDButton variants', () => {
    expect(MATERIAL_BUTTON_VARIANTS.save).toBe('gradient')
    expect(MATERIAL_BUTTON_VARIANTS.cancel).toBe('outlined')
    expect(MATERIAL_BUTTON_VARIANTS.delete).toBe('contained')
    expect(MATERIAL_BUTTON_VARIANTS['create-new']).toBe('gradient')
  })
})
