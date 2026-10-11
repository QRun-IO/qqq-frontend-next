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

import { describe, expect, it } from 'vitest'

import { columnKind, estimateColumnWidth, pickCompactColumns, rankColumns } from './compact-columns'
import type { CompactColumn, CompactColumnContext } from './compact-columns'

/**
 * A column candidate.
 *
 * @param name - Field name.
 * @param type - Field type.
 * @param extra - Extra field metadata.
 * @returns The column.
 */
function column(name: string, type = 'STRING', extra: Partial<CompactColumn['field']> = {}): CompactColumn {
  return { name, label: name.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()), field: { name, type, ...extra } }
}

const fieldNotes = 'Notes from the work of building systems, making decisions and understanding what changes along the way.'

// a blog list shaped like the CMS screenshot that prompted this: every column crammed into a panel
const blogColumns = [
  column('id', 'INTEGER'),
  column('name', 'STRING', { maxLength: 255 }),
  column('shortName', 'STRING', { maxLength: 100 }),
  column('slug', 'STRING', { maxLength: 100 }),
  column('blogTypeId', 'INTEGER', { possibleValueSourceName: 'blogType' }),
  column('description', 'STRING', { maxLength: 1000 }),
  column('metaTitle', 'STRING', { maxLength: 255 }),
  column('metaDescription', 'STRING', { maxLength: 1000 }),
  column('metaKeywords', 'STRING', { maxLength: 1000 }),
  column('createDate', 'DATE_TIME'),
  column('modifyDate', 'DATE_TIME'),
]

const blogValues: Record<string, string[]> = {
  id: ['1', '2'],
  name: ['Field Notes', 'Ideas Into Systems'],
  shortName: ['Field Notes', 'Ideas Into Systems'],
  slug: ['quick-bits', 'ideas-into-systems'],
  blogTypeId: ['Site Blog', 'Site Blog'],
  description: [fieldNotes, fieldNotes],
  metaTitle: ['Field Notes - Engineering & Leadership', 'Ideas Into Systems - A CTO\'s Perspective'],
  metaDescription: [fieldNotes, fieldNotes],
  metaKeywords: ['engineering, leadership, observations, systems', 'technology, architecture, leadership, engineering, systems'],
  createDate: ['2026-07-05T23:33:29Z', '2026-07-05T23:33:29Z'],
  modifyDate: ['2026-10-10T11:01:39Z', '2026-10-11T07:36:21Z'],
}

const blogContext: CompactColumnContext = {
  primaryKeyField: 'id',
  t1FieldNames: ['id', 'name', 'shortName', 'slug', 'blogTypeId'],
  samples: (name) => blogValues[name] ?? [],
}

describe('columnKind', () => {
  it('classifies keys, statuses, booleans, dates, numbers and long text from metadata', () => {
    expect(columnKind(column('id', 'INTEGER'), { primaryKeyField: 'id' })).toBe('key')
    expect(columnKind(column('status', 'STRING', { adornments: [{ type: 'CHIP' }] }))).toBe('status')
    expect(columnKind(column('typeId', 'INTEGER', { possibleValueSourceName: 'type' }))).toBe('status')
    expect(columnKind(column('isPrimary', 'BOOLEAN'))).toBe('boolean')
    expect(columnKind(column('day', 'DATE'))).toBe('date')
    expect(columnKind(column('at', 'DATE_TIME'))).toBe('dateTime')
    expect(columnKind(column('total', 'DECIMAL'))).toBe('number')
    expect(columnKind(column('body', 'TEXT'))).toBe('longText')
    expect(columnKind(column('page', 'HTML'))).toBe('longText')
    expect(columnKind(column('blob', 'STRING', { isHeavy: true }))).toBe('longText')
  })

  it('decides long text from the rows shown, and from the declared length without rows', () => {
    expect(columnKind(column('description', 'STRING', { maxLength: 500 }), { samples: () => ['Primary base domain', 'Naked domain, redirect to www'] })).toBe('text')
    expect(columnKind(column('description', 'STRING', { maxLength: 100 }), { samples: () => [fieldNotes] })).toBe('longText')
    expect(columnKind(column('description', 'STRING', { maxLength: 500 }))).toBe('longText')
    expect(columnKind(column('name', 'STRING', { maxLength: 100 }))).toBe('text')
  })
})

describe('estimateColumnWidth', () => {
  it('sizes dates to their compact form and text to its content within bounds', () => {
    expect(estimateColumnWidth(column('createDate', 'DATE_TIME'), 'dateTime')).toBe(150)
    expect(estimateColumnWidth(column('day', 'DATE'), 'date')).toBe(130)
    expect(estimateColumnWidth(column('name'), 'text', ['ab'])).toBe(90)
    expect(estimateColumnWidth(column('name'), 'text', ['x'.repeat(200)])).toBe(260)
    expect(estimateColumnWidth(column('body'), 'longText')).toBe(280)
  })
})

describe('rankColumns', () => {
  it('puts the name first, then status, then the most recently changed date, and long text last', () => {
    const ranked = rankColumns(blogColumns, blogContext)
    const order = [...ranked].sort((a, b) => b.priority - a.priority).map(({ column: { name } }) => name)
    expect(order[0]).toBe('name')
    expect(order[1]).toBe('blogTypeId')
    // modifyDate holds the latest values, so it is the date that stays
    expect(order.indexOf('modifyDate')).toBeLessThan(order.indexOf('createDate'))
    // the key ranks below even long text while a name column identifies the row
    expect(order.slice(-4).sort()).toEqual(['description', 'id', 'metaDescription', 'metaKeywords'])
    expect(ranked.find(({ column: { name } }) => name === 'id')?.kind).toBe('key')
  })

  it('keeps the key as the row name when no text column names the row', () => {
    const ranked = rankColumns([column('id', 'INTEGER'), column('qty', 'INTEGER'), column('at', 'DATE_TIME')], { primaryKeyField: 'id' })
    expect([...ranked].sort((a, b) => b.priority - a.priority)[0].column.name).toBe('id')
  })

  it('follows the application order of onlyIncludeFieldNames', () => {
    const ranked = rankColumns(blogColumns, { ...blogContext, explicitOrder: ['metaDescription', 'slug'] })
    const order = [...ranked].sort((a, b) => b.priority - a.priority).map(({ column: { name } }) => name)
    expect(order.slice(0, 2)).toEqual(['metaDescription', 'slug'])
  })
})

describe('pickCompactColumns', () => {
  it('shows every column when the width is unknown', () => {
    expect(pickCompactColumns(blogColumns, 0, blogContext)).toEqual({ shown: blogColumns, hidden: [] })
  })

  it('keeps the identity, status and one date in a half-width panel, in metadata order', () => {
    const { shown, hidden } = pickCompactColumns(blogColumns, 560, blogContext)
    expect(shown.map(({ name }) => name)).toEqual(['name', 'shortName', 'blogTypeId', 'modifyDate'])
    expect(hidden.map(({ name }) => name)).toContain('metaDescription')
    expect(hidden.map(({ name }) => name)).toContain('id')
  })

  it('adds columns as the panel widens and shows long text only with room to spare', () => {
    const medium = pickCompactColumns(blogColumns, 1000, blogContext).shown.map(({ name }) => name)
    expect(medium).toEqual(expect.arrayContaining(['name', 'shortName', 'slug', 'blogTypeId', 'modifyDate']))
    expect(medium).not.toContain('metaDescription')
    // the key is left out while a name column identifies the row
    expect(pickCompactColumns(blogColumns, 4000, blogContext).hidden.map(({ name }) => name)).toEqual(['id'])
  })

  it('always shows at least the most important column', () => {
    expect(pickCompactColumns(blogColumns, 40, blogContext).shown.map(({ name }) => name)).toEqual(['name'])
  })
})
