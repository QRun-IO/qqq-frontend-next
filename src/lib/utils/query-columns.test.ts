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

// Default grid column order follows Material: sections first, then unsectioned fields (QRun-IO/qqq#714)

import { describe, expect, it } from 'vitest'

import type { QTableMetaData } from '@/types'
import { defaultColumnVisibility, fieldsInSectionOrder, getQueryColumns, withReadableExposedJoins } from './query-columns'

const table = {
  name: 'thing',
  label: 'Thing',
  primaryKeyField: 'id',
  fields: {
    zeta: { name: 'zeta', label: 'Zeta', type: 'STRING' },
    notes: { name: 'notes', label: 'Notes', type: 'TEXT', isHeavy: true },
    id: { name: 'id', label: 'Id', type: 'INTEGER' },
    alpha: { name: 'alpha', label: 'Alpha', type: 'STRING' },
    secret: { name: 'secret', label: 'Secret', type: 'STRING', isHidden: true },
    loose: { name: 'loose', label: 'Loose', type: 'STRING' },
  },
  sections: [
    { name: 'identity', label: 'Identity', tier: 'T1', fieldNames: ['id', 'alpha'] },
    { name: 'more', label: 'More', tier: 'T2', fieldNames: ['zeta', 'alpha', 'ghost', 'notes', 'secret'] },
  ],
} as unknown as QTableMetaData

describe('fieldsInSectionOrder', () => {
  it('lists section fields in section order once, then the fields no section names', () => {
    expect(fieldsInSectionOrder(table).map((field) => field.name)).toEqual(['id', 'alpha', 'zeta', 'notes', 'secret', 'loose'])
  })

  it('keeps metadata order for a table without sections', () => {
    expect(fieldsInSectionOrder({ fields: table.fields }).map((field) => field.name)).toEqual(['zeta', 'notes', 'id', 'alpha', 'secret', 'loose'])
  })
})

describe('getQueryColumns', () => {
  it('uses the section order and drops hidden and heavy fields', () => {
    expect(getQueryColumns(table).map((column) => column.name)).toEqual(['id', 'alpha', 'zeta', 'loose'])
  })
})

describe('withReadableExposedJoins', () => {
  it('hides columns behind an unreadable path table while keeping readable joins', () => {
    const base = { ...table, readPermission: true }
    const target = { ...table, name: 'target', label: 'Target', readPermission: true }
    const bridge = { ...table, name: 'bridge', label: 'Bridge', readPermission: false }
    const joined = {
      ...base,
      exposedJoins: [
        { label: 'Blocked', isMany: false, joinTable: target, joinPath: [{ name: 'throughBridge', type: 'MANY_TO_ONE', leftTable: 'thing', rightTable: 'bridge' }] },
        { label: 'Allowed', isMany: false, joinTable: target, joinPath: [{ name: 'direct', type: 'MANY_TO_ONE', leftTable: 'thing', rightTable: 'target' }] },
      ],
    } as QTableMetaData
    const allTables = { thing: base, target, bridge }
    const filtered = withReadableExposedJoins(joined, allTables)
    expect(filtered.exposedJoins.map((join) => join.label)).toEqual(['Allowed'])
    expect(getQueryColumns(filtered).some((column) => column.label.startsWith('Blocked:'))).toBe(false)
    expect(joined.exposedJoins).toHaveLength(2)
  })
})


it('exposes collaboration tags as a selectable virtual column', () => {
  const columns = getQueryColumns({ ...table, virtualFields: { collaborationTags: { ...table.fields.alpha, name: 'collaborationTags', label: 'Tags', possibleValueSourceName: 'collaboration_tag', isQueryCriteria: true, isQuerySelectable: true } } })
  expect(columns.find((column) => column.name === 'collaborationTags')).toMatchObject({ label: 'Tags', isVirtual: true, isQueryCriteria: true, field: { possibleValueSourceName: 'collaboration_tag' } })
})

describe('defaultColumnVisibility', () => {
  const visible = (metadata: QTableMetaData) => Object.entries(defaultColumnVisibility(metadata)).filter(([, shown]) => shown).map(([name]) => name)

  it('selects the primary key, then T1 and T2 in section order, with every other field false', () => {
    const metadata = { ...table, sections: [table.sections[1], table.sections[0]] }
    expect(visible(metadata)).toEqual(['id', 'alpha', 'zeta'])
    expect(defaultColumnVisibility(metadata)).toEqual({ id: true, alpha: true, zeta: true, notes: false, secret: false, loose: false })
  })

  it('uses field order without sections, putting the primary key first', () => {
    expect(visible({ ...table, sections: [] })).toEqual(['id', 'zeta', 'alpha', 'loose'])
  })

  it('caps the heuristic at six including the primary key', () => {
    const fields = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`field${i}`, { ...table.fields.alpha, name: `field${i}` }]))
    expect(visible({ ...table, fields: { ...fields, id: table.fields.id }, sections: [] })).toEqual(['id', 'field0', 'field1', 'field2', 'field3', 'field4'])
  })

  it('excludes heavy fields, long types and large editor adornments', () => {
    const fields = Object.fromEntries(['TEXT', 'HTML', 'BLOB', 'JSON', 'JSONB'].map((type) => [type, { ...table.fields.alpha, name: type, type }]))
    const metadata = { ...table, sections: [], fields: {
      ...fields, id: table.fields.id,
      heavy: { ...table.fields.alpha, name: 'heavy', isHeavy: true },
      code: { ...table.fields.alpha, name: 'code', adornments: [{ type: 'CODE_EDITOR' }] },
      html: { ...table.fields.alpha, name: 'html', adornments: [{ type: 'RENDER_HTML' }] },
    } } as QTableMetaData
    expect(visible(metadata)).toEqual(['id'])
    expect(Object.values(defaultColumnVisibility(metadata)).filter((shown) => !shown)).toHaveLength(8)
  })

  it.each(['supplementalMetaData', 'supplementalTableMetaData'] as const)('honours %s.nextUi.defaultColumns, ignoring unavailable fields', (key) => {
    expect(visible({ ...table, [key]: { nextUi: { defaultColumns: ['loose', 'zeta', 'secret', 'missing'] } } })).toEqual(['loose', 'zeta'])
    expect(visible({ ...table, [key]: { nextUi: { defaultColumns: [] } } })).toEqual([])
  })

  it('allows explicit hints to select long text and more than six fields', () => {
    const fields = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`field${i}`, { ...table.fields.alpha, name: `field${i}`, type: 'TEXT' as const }]))
    const metadata = { ...table, fields, supplementalMetaData: { nextUi: { defaultColumns: Object.keys(fields) } } }
    expect(visible(metadata)).toEqual(Object.keys(fields))
  })

  it('falls back to field order when the T1/T2 sections hold no usable field', () => {
    const metadata = { ...table, sections: [{ name: 'notes', label: 'Notes', tier: 'T3', fieldNames: ['alpha'] }] } as QTableMetaData
    expect(visible(metadata)[0]).toBe('id')
    expect(visible(metadata).length).toBeGreaterThan(1)
  })

  it('falls back for malformed hints and explicitly hides virtual columns', () => {
    const metadata = { ...table, supplementalMetaData: { nextUi: { defaultColumns: 'alpha' } }, virtualFields: {
      computed: { ...table.fields.alpha, name: 'computed', isQuerySelectable: true, isQueryCriteria: false },
    } }
    expect(visible(metadata)).toEqual(['id', 'alpha', 'zeta'])
    expect(defaultColumnVisibility(metadata).computed).toBe(false)
  })
})
