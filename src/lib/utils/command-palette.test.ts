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

// Tests for the command palette's Material filter, ranking and table actions

import { describe, expect, it } from 'vitest'

import type { QInstance, QProcessMetaData, QTableMetaData } from '@/types'
import { buildTableActions, commandMatches, compareCommandLabels, tableScreenFor } from './command-palette'

const person = {
  name: 'person', label: 'Person', primaryKeyField: 'id', capabilities: ['TABLE_INSERT', 'TABLE_UPDATE', 'TABLE_DELETE'],
  readPermission: true, insertPermission: true, editPermission: true, deletePermission: true,
} as unknown as QTableMetaData

function process(overrides: Partial<QProcessMetaData>): QProcessMetaData {
  return { name: 'p', label: 'P', tableName: 'person', isHidden: false, hasPermission: true, iconName: '', ...overrides } as QProcessMetaData
}

function instance(overrides: Partial<QInstance> = {}): QInstance {
  return {
    apps: {}, appTree: [], reports: {}, widgets: {}, helpContents: {}, environmentValues: {}, branding: { companyName: '', companyUrl: '', appName: '' },
    tables: { person },
    processes: {
      clonePeople: process({ name: 'clonePeople', label: 'Clone People', icon: { name: 'content_copy' } }),
      bulkOnly: process({ name: 'bulkOnly', label: 'Bulk Only', maxInputRecords: 0 }),
      hiddenOne: process({ name: 'hiddenOne', label: 'Hidden One', isHidden: true }),
      denied: process({ name: 'denied', label: 'Denied', hasPermission: false }),
      alpha: process({ name: 'alpha', label: 'Alpha Step' }),
      other: process({ name: 'other', label: 'Other', tableName: 'pet' }),
    },
    ...overrides,
  } as QInstance
}

describe('commandMatches (Material doFilter)', () => {
  it('matches one word anywhere in the value', () => {
    expect(commandMatches('Pet Species Miscellaneous', 'spec')).toBe(true)
    expect(commandMatches('Pet Species', 'SPEC')).toBe(true)
    expect(commandMatches('Pet Species', 'dog')).toBe(false)
  })

  it('matches several words against the value words in order', () => {
    expect(commandMatches('Pet Species Miscellaneous', 'pet spe')).toBe(true)
    expect(commandMatches('Pet Species Miscellaneous', 'spe pet')).toBe(false)
    expect(commandMatches('Pet People App', 'pet species')).toBe(false)
    // a later word may match the same value word
    expect(commandMatches('Greetings', 'gre ting')).toBe(false)
    expect(commandMatches('Greetings App', 'gre ting')).toBe(true)
    // more search words than value words never match
    expect(commandMatches('Order', 'order c')).toBe(false)
  })
})

describe('compareCommandLabels (Material comparator)', () => {
  it('puts labels that start with the search first, then the first word, then alphabetical', () => {
    const labels = ['Nav Deep Item', 'Deep Report', 'Another Deep', 'Deep Item']
    expect([...labels].sort((a, b) => compareCommandLabels(a, b, 'deep'))).toEqual(['Deep Item', 'Deep Report', 'Another Deep', 'Nav Deep Item'])
    expect([...labels].sort((a, b) => compareCommandLabels(a, b, 'deep it'))).toEqual(['Deep Item', 'Deep Report', 'Another Deep', 'Nav Deep Item'])
    expect(compareCommandLabels('B', 'A', '')).toBe(0)
  })
})

describe('tableScreenFor', () => {
  const metaData = instance()
  it('finds the query screen, saved views and record views of a table', () => {
    expect(tableScreenFor('/app/person', '', metaData)).toEqual({ table: person })
    expect(tableScreenFor('/app/person/savedView/3', '', metaData)).toEqual({ table: person })
    expect(tableScreenFor('/app/person/7', '', metaData)).toEqual({ table: person, recordId: '7' })
  })

  it('offers no table actions on create, edit, copy, developer and key screens, other pages, or with the audit open', () => {
    for (const path of ['/app/person/create', '/app/person/7/edit', '/app/person/7/copy', '/app/person/dev', '/app/person/key', '/app/clonePeople', '/app', '/app/unknown']) {
      expect(tableScreenFor(path, '', metaData)).toBeNull()
    }
    expect(tableScreenFor('/app/person/7', '#audit', metaData)).toBeNull()
  })
})

describe('buildTableActions', () => {
  it('lists New and the table processes on the query screen, returning to the table', () => {
    const actions = buildTableActions({ table: person }, instance())
    expect(actions.map((action) => action.label)).toEqual(['New', 'Alpha Step', 'Bulk Only', 'Clone People'])
    expect(actions[0].path).toBe('/app/person/create')
    expect(actions[3]).toMatchObject({ icon: { name: 'content_copy' }, path: '/app/clonePeople/?returnTo=%2Fapp%2Fperson' })
    expect(actions[1].icon).toEqual({ name: 'play_arrow' })
  })

  it('lists New, Copy, Edit, Audit and single-record processes on a record view, for that record', () => {
    const withAudit = instance({ tables: { person, audit: { name: 'audit', label: 'Audit', readPermission: true } as unknown as QTableMetaData } })
    const actions = buildTableActions({ table: person, recordId: '7' }, withAudit)
    expect(actions.map((action) => action.label)).toEqual(['New', 'Copy', 'Edit', 'Audit', 'Alpha Step', 'Clone People'])
    expect(actions.find((action) => action.key === 'copy')?.path).toBe('/app/person/7/copy')
    expect(actions.find((action) => action.key === 'edit')?.path).toBe('/app/person/7/edit')
    expect(actions.find((action) => action.key === 'audit')?.path).toBeUndefined()
    expect(actions.find((action) => action.key === 'process-clonePeople')?.path)
      .toBe('/app/clonePeople/?recordsParam=recordIds&recordIds=7&returnTo=%2Fapp%2Fperson%2F7')
  })

  it('gates New and Copy on insert, Edit on update, and Audit on readable audits', () => {
    const readOnly = { ...person, insertPermission: false, capabilities: ['TABLE_UPDATE'], editPermission: false } as unknown as QTableMetaData
    const actions = buildTableActions({ table: readOnly, recordId: '7' }, instance())
    expect(actions.map((action) => action.key)).toEqual(['process-alpha', 'process-clonePeople'])
  })
})
