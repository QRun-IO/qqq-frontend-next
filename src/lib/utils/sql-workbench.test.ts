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

// Tests for the SQL Workbench helpers

import { describe, expect, it, vi } from 'vitest'

import type { SqlColumn, SqlPlanNode, SqlSchema } from '@/types'
import {
  coerceParameterValue,
  editorDialectName,
  editorSchema,
  extractSqlParameters,
  formatDuration,
  formatSqlValue,
  formatterLanguage,
  isBinaryValue,
  newCellKey,
  numericColumnIndexes,
  planMax,
  prettyJson,
  qqqNameCompletions,
  rowsToTsv,
  toChartRows,
} from './sql-workbench'

const column = (label: string, kind: SqlColumn['kind']): SqlColumn => ({
  name: label,
  label,
  typeName: kind,
  jdbcType: 0,
  kind,
})

describe('formatSqlValue', () => {
  it('renders nulls, binaries, arrays and scalars', () => {
    expect(formatSqlValue(null)).toBe('NULL')
    expect(formatSqlValue(undefined)).toBe('NULL')
    expect(formatSqlValue({ $binary: true, length: 4, hexPreview: 'cafebabe' })).toBe(
      '<binary 4 bytes>'
    )
    expect(formatSqlValue(['a', 1])).toBe('["a",1]')
    expect(formatSqlValue(true)).toBe('true')
    expect(formatSqlValue(1.5)).toBe('1.5')
    expect(isBinaryValue({ $binary: true })).toBe(true)
    expect(isBinaryValue([])).toBe(false)
    expect(isBinaryValue(null)).toBe(false)
  })

  it('pretty-prints JSON and leaves other text alone', () => {
    expect(prettyJson('{"a":1}')).toBe('{\n  "a": 1\n}')
    expect(prettyJson('not json')).toBe('not json')
  })

  it('builds tab-separated text', () => {
    expect(
      rowsToTsv(
        [column('a', 'string'), column('b', 'number')],
        [
          ['x\ty', null],
          ['z', 2],
        ]
      )
    ).toBe('a\tb\nx y\t\nz\t2')
  })
})

describe('extractSqlParameters', () => {
  it('finds parameters outside literals, comments and casts', () => {
    const sql = `SELECT id::text, ':skip', "x:y", \`a:b\` FROM t /* :c */ WHERE a = :a AND b = :b_2 OR a = :a -- :d
      AND e = $$ :e $$ AND f = $tag$ :f $tag$ AND g = :g`
    expect(extractSqlParameters(sql)).toEqual(['a', 'b_2', 'g'])
  })

  it('handles escapes and unterminated text', () => {
    expect(extractSqlParameters("SELECT 'it''s :x', :y")).toEqual(['y'])
    expect(extractSqlParameters('SELECT 1 /* :open')).toEqual([])
    expect(extractSqlParameters('SELECT $$ :open')).toEqual([])
    expect(extractSqlParameters('SELECT :1, a:=:b')).toEqual(['b'])
    expect(extractSqlParameters('')).toEqual([])
  })
})

describe('coerceParameterValue', () => {
  it('converts by declared type', () => {
    expect(coerceParameterValue('', 'STRING')).toBeNull()
    expect(coerceParameterValue(null)).toBeNull()
    expect(coerceParameterValue('12', 'INTEGER')).toBe(12)
    expect(coerceParameterValue('1.5', 'DECIMAL')).toBe(1.5)
    expect(coerceParameterValue('abc', 'INTEGER')).toBe('abc')
    expect(coerceParameterValue('yes', 'BOOLEAN')).toBe(true)
    expect(coerceParameterValue('no', 'BOOLEAN')).toBe(false)
    expect(coerceParameterValue('007')).toBe('007')
  })
})

describe('dialects', () => {
  it('maps backend dialects to editor and formatter dialects', () => {
    expect(editorDialectName('postgresql')).toBe('PostgreSQL')
    expect(editorDialectName('mysql')).toBe('MySQL')
    expect(editorDialectName('sqlite')).toBe('SQLite')
    expect(editorDialectName('h2')).toBe('StandardSQL')
    expect(editorDialectName(undefined)).toBe('StandardSQL')
    expect(formatterLanguage('postgresql')).toBe('postgresql')
    expect(formatterLanguage('mysql')).toBe('mysql')
    expect(formatterLanguage('sqlite')).toBe('sqlite')
    expect(formatterLanguage('h2')).toBe('sql')
  })
})

describe('autocomplete sources', () => {
  const schema: SqlSchema = {
    backendName: 'pg',
    dialect: 'postgresql',
    schemas: [
      {
        name: 'public',
        tables: [
          {
            name: 'person',
            type: 'TABLE',
            columns: [{ name: 'id', typeName: 'int4', nullable: false }],
          },
        ],
      },
      {
        name: 'audit',
        tables: [
          {
            name: 'person',
            type: 'TABLE',
            columns: [{ name: 'x', typeName: 'int4', nullable: true }],
          },
        ],
      },
    ],
    truncated: false,
    keywords: [],
    functions: [],
    qqqTables: [
      {
        name: 'person',
        label: 'Person',
        sqlName: 'person',
        fields: [{ name: 'firstName', label: 'First Name', sqlName: 'first_name', type: 'STRING' }],
      },
    ],
    cachedAt: '',
  }

  it('maps tables to columns, bare and qualified', () => {
    expect(editorSchema(schema)).toEqual({
      'public.person': ['id'],
      person: ['id'],
      'audit.person': ['x'],
    })
    expect(editorSchema(undefined)).toEqual({})
  })

  it('offers QQQ names that insert SQL names', () => {
    expect(qqqNameCompletions(schema)).toEqual([
      { label: 'person', apply: 'person', detail: 'QQQ table → person', type: 'class' },
      {
        label: 'person.firstName',
        apply: 'person.first_name',
        detail: 'QQQ field → first_name',
        type: 'property',
      },
    ])
    expect(qqqNameCompletions(undefined)).toEqual([])
  })
})

describe('charts', () => {
  const columns = [
    column('month', 'string'),
    column('n', 'number'),
    column('s', 'string'),
    column('t', 'string'),
  ]
  const rows = [
    ['jan', 1, '2.5', 'a'],
    ['feb', null, '3', 'b'],
  ]

  it('finds numeric columns, including numeric text', () => {
    expect(numericColumnIndexes(columns, rows)).toEqual([1, 2])
    expect(numericColumnIndexes(columns, [])).toEqual([1])
  })

  it('builds chart rows', () => {
    expect(toChartRows(columns, rows, 0, [1, 2])).toEqual([
      { x: 'jan', n: 1, s: 2.5 },
      { x: 'feb', n: 0, s: 3 },
    ])
  })
})

describe('plans and misc', () => {
  const node = (
    cost: number | null,
    time: number | null,
    children: SqlPlanNode[] = []
  ): SqlPlanNode => ({
    label: 'n',
    detail: null,
    startupCost: null,
    totalCost: cost,
    planRows: null,
    actualTimeMs: time,
    actualRows: null,
    loops: null,
    extra: {},
    children,
  })

  it('finds the largest cost or time', () => {
    const plan = node(10, 1, [node(25, 0.5), node(null, 3)])
    expect(planMax(plan, false)).toBe(25)
    expect(planMax(plan, true)).toBe(3)
  })

  it('makes cell keys and durations', () => {
    expect(newCellKey()).toMatch(/[0-9a-f-]{36}/)
    vi.stubGlobal('crypto', undefined)
    expect(newCellKey()).toMatch(/^cell-/)
    vi.unstubAllGlobals()
    expect(formatDuration(38)).toBe('38 ms')
    expect(formatDuration(1234)).toBe('1.2 s')
    expect(formatDuration(null)).toBe('')
  })
})
