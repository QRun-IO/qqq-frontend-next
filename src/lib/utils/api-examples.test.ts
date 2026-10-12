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

// Tests for the record developer view's API operations and snippets

import { describe, expect, it } from 'vitest'

import type { QProcessMetaData, QRecord, QTableMetaData } from '@/types'
import { buildSnippet, exampleWriteValues, specOperations, v1Operations } from './api-examples'

const table = {
  name: 'person',
  label: 'Person',
  primaryKeyField: 'id',
  fields: {
    id: { name: 'id', label: 'Id', type: 'INTEGER', isEditable: false, isHidden: false },
    name: { name: 'name', label: 'Name', type: 'STRING', isEditable: true, isHidden: false },
    note: { name: 'note', label: 'Note', type: 'TEXT', isEditable: true, isHidden: false },
    secret: { name: 'secret', label: 'Secret', type: 'STRING', isEditable: true, isHidden: true },
    photo: { name: 'photo', label: 'Photo', type: 'BLOB', isEditable: true, isHidden: false },
    createDate: { name: 'createDate', label: 'Created', type: 'DATE_TIME', isEditable: false, isHidden: false },
  },
  capabilities: [],
  readPermission: true,
  insertPermission: true,
  editPermission: true,
  deletePermission: false,
} as unknown as QTableMetaData

const record: QRecord = { tableName: 'person', values: { id: 7, name: "O'Neil", note: null, secret: 'x', photo: 'blob', createDate: '2026-10-12T10:00:00Z' } }

describe('exampleWriteValues', () => {
  it('uses editable, visible, non-key, non-blob fields with their current values', () => {
    expect(exampleWriteValues(table, record)).toEqual({ name: "O'Neil", note: null })
  })
})

describe('v1Operations', () => {
  it('lists the permitted record operations and process init for the record', () => {
    const processes = [{ name: 'greet', label: 'Greet', tableName: 'person' }] as QProcessMetaData[]
    const operations = v1Operations({ baseUrl: 'https://app.example.com/qqq/v1', table, record, processes })
    expect(operations.map((operation) => operation.id)).toEqual(['get', 'query', 'count', 'insert', 'update', 'process-greet'])
    expect(operations[0].url).toBe('https://app.example.com/qqq/v1/table/person/7')
    expect(operations.find((operation) => operation.id === 'update')).toMatchObject({ method: 'PATCH', body: { kind: 'json', value: { name: "O'Neil", note: null } } })
    expect(operations.at(-1)).toMatchObject({ url: 'https://app.example.com/qqq/v1/processes/greet/init', body: { kind: 'form', fields: { recordsParam: 'recordIds', recordIds: '7' } } })
  })

  it('lists nothing the user may not do', () => {
    const readOnly = { ...table, insertPermission: false, editPermission: false, deletePermission: false, readPermission: false }
    expect(v1Operations({ baseUrl: 'https://x/qqq/v1', table: readOnly, record, processes: [] })).toEqual([])
  })

  it('respects the table capabilities', () => {
    const getOnly = { ...table, capabilities: ['TABLE_GET'] } as unknown as QTableMetaData
    expect(v1Operations({ baseUrl: 'https://x/qqq/v1', table: getOnly, record, processes: [] }).map((operation) => operation.id)).toEqual(['get'])
  })
})

describe('specOperations', () => {
  const spec = {
    servers: [{ url: '/api/v1' }],
    components: { securitySchemes: { apiKey: { type: 'apiKey', in: 'header', name: 'x-api-key' } } },
    paths: {
      '/person/': { post: { summary: 'Insert a person', requestBody: {} } },
      '/person/query': { get: { summary: 'Query persons' } },
      '/person/bulk': { post: { summary: 'Bulk insert', requestBody: {} }, patch: { summary: 'Bulk update', requestBody: {} }, delete: { summary: 'Bulk delete' } },
      '/person/{id}': { get: { summary: 'Get a person', description: 'Gets one.\nMore.' }, patch: { summary: 'Update a person', requestBody: {} }, delete: { summary: 'Delete a person' } },
      '/person/greet': { post: { summary: 'Greet people' } },
    },
  }

  it('fills the record key, applies table permissions, keeps processes and reads the auth', () => {
    const result = specOperations({ spec, origin: 'https://site.example.com', table, record })!
    expect(result.serverUrl).toBe('https://site.example.com/api/v1')
    expect(result.auth).toBe('apiKey')
    const ids = result.operations.map((operation) => operation.id)
    expect(ids).toEqual(['POST /person/', 'GET /person/query', 'POST /person/bulk', 'PATCH /person/bulk', 'GET /person/{id}', 'PATCH /person/{id}', 'POST /person/greet'])
    const get = result.operations.find((operation) => operation.id === 'GET /person/{id}')!
    expect(get).toMatchObject({ url: 'https://site.example.com/api/v1/person/7', label: 'Get a person', description: 'Gets one.' })
    expect(result.operations.find((operation) => operation.id === 'GET /person/query')!.url).toBe('https://site.example.com/api/v1/person/query?id=7&pageSize=10')
    expect(result.operations.find((operation) => operation.id === 'PATCH /person/bulk')!.body).toEqual({ kind: 'json', value: [{ id: 7, name: "O'Neil", note: null }] })
  })

  it('returns null for a document without paths', () => {
    expect(specOperations({ spec: { openapi: '3.0' }, origin: 'https://x', table, record })).toBeNull()
  })
})

describe('buildSnippet', () => {
  const update = { id: 'update', label: 'Update', method: 'PATCH' as const, url: 'https://x/qqq/v1/table/person/7', body: { kind: 'json' as const, value: { name: "O'Neil" } } }
  const init = { id: 'p', label: 'Run', method: 'POST' as const, url: 'https://x/qqq/v1/processes/greet/init', body: { kind: 'form' as const, fields: { recordsParam: 'recordIds', recordIds: '7' } } }

  it('builds curl with shell-safe quoting and placeholder credentials', () => {
    const curl = buildSnippet(update, 'bearer', 'curl')
    expect(curl).toContain(`curl -X PATCH 'https://x/qqq/v1/table/person/7'`)
    expect(curl).toContain('-H "Authorization: Bearer $QQQ_API_TOKEN"')
    expect(curl).toContain(`"name": "O'\\''Neil"`)
    expect(buildSnippet(init, 'session', 'curl')).toContain(`-b 'sessionUUID=<your-session-uuid>'`)
    expect(buildSnippet(init, 'session', 'curl')).toContain(`-F 'recordIds=7'`)
  })

  it('builds fetch with credentials or headers and a body', () => {
    const fetchSession = buildSnippet(update, 'session', 'fetch')
    expect(fetchSession).toContain(`credentials: 'include'`)
    expect(fetchSession).toContain(`method: 'PATCH'`)
    expect(fetchSession).toContain('body: JSON.stringify(')
    expect(buildSnippet(init, 'apiKey', 'fetch')).toContain(`body.append("recordIds", "7")`)
    expect(buildSnippet(init, 'apiKey', 'fetch')).toContain(`'x-api-key': process.env.QQQ_API_KEY`)
  })

  it('builds Java with java.net.http and environment-variable credentials', () => {
    const java = buildSnippet(update, 'bearer', 'java')
    expect(java).toContain('HttpRequest.newBuilder(URI.create("https://x/qqq/v1/table/person/7"))')
    expect(java).toContain('System.getenv("QQQ_API_TOKEN")')
    expect(java).toContain('.method("PATCH", HttpRequest.BodyPublishers.ofString("""')
    expect(buildSnippet(init, 'session', 'java')).toContain('multipart/form-data; boundary=')
    expect(buildSnippet({ ...update, method: 'DELETE', body: undefined }, 'apiKey', 'java')).toContain('BodyPublishers.noBody()')
  })
})
