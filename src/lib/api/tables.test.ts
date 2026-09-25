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

// Tests for table data API functions

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    setUnauthorizedCallback: vi.fn(),
    getInstance: () => ({ defaults: { baseURL: 'https://sample.invalid/context/qqq/v1' } }),
  },
}))

describe('Tables API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('queryRecords', () => {
    it('posts to /table/{name}/query with filter', async () => {
      const { default: apiClient } = await import('./client')
      const mockResponse = { records: [{ tableName: 'person', values: { id: 1 }, recordLabel: 'Alice', displayValues: {} }] }
      vi.mocked(apiClient.post).mockResolvedValue(mockResponse)

      const { queryRecords } = await import('./tables')
      const request = { filter: { criteria: [], orderBys: [], booleanOperator: 'AND' as const, skip: 0, limit: 25 } }
      const result = await queryRecords('person', request)

      expect(apiClient.post).toHaveBeenCalledWith('/table/person/query', request)
      expect(result).toEqual(mockResponse)
    })

    it('URL-encodes the table name', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.post).mockResolvedValue({ records: [] })

      const { queryRecords } = await import('./tables')
      await queryRecords('my table', { filter: {} })

      expect(vi.mocked(apiClient.post).mock.calls[0][0]).toBe('/table/my%20table/query')
    })
  })

  describe('countRecords', () => {
    it('posts to /table/{name}/count', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.post).mockResolvedValue({ count: 42, distinctCount: 42 })

      const { countRecords } = await import('./tables')
      const result = await countRecords('person', { filter: {} })

      expect(apiClient.post).toHaveBeenCalledWith(
        '/table/person/count',
        { filter: {} },
        { params: { includeDistinct: false } }
      )
      expect(result).toEqual({ count: 42, distinctCount: 42 })
    })

    it('passes includeDistinct flag', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.post).mockResolvedValue({ count: 10, distinctCount: 8 })

      const { countRecords } = await import('./tables')
      await countRecords('person', { filter: {} }, true)

      expect(vi.mocked(apiClient.post).mock.calls[0][2]).toEqual({ params: { includeDistinct: true } })
    })
  })

  describe('getRecord', () => {
    it('gets a single record by primary key', async () => {
      const { default: apiClient } = await import('./client')
      const mockRecord = { tableName: 'person', values: { id: 1, name: 'Alice' }, recordLabel: 'Alice', displayValues: {} }
      vi.mocked(apiClient.get).mockResolvedValue({ record: mockRecord })

      const { getRecord } = await import('./tables')
      const result = await getRecord('person', 1)

      expect(apiClient.get).toHaveBeenCalledWith('/table/person/1', { params: undefined })
      expect(result).toEqual(mockRecord)
    })

    it.each(['<html><body>Admin</body></html>', {}, { record: { tableName: 'person' } }, { record: { tableName: 'person', values: [] } },
      { tableName: 'person', values: {} }])('rejects a successful non-record response: %j', async (response) => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.get).mockResolvedValue(response)
      const { getRecord } = await import('./tables')
      await expect(getRecord('person', 1)).rejects.toThrow('Invalid record response')
    })

    it('encodes the primary key as one v1 path segment', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.get).mockResolvedValue({ record: { tableName: 'person', values: { id: 'one/two?' }, recordLabel: 'Key' } })
      const { getRecord } = await import('./tables')
      await getRecord('my table', 'one/two?')
      expect(vi.mocked(apiClient.get).mock.calls[0][0]).toBe('/table/my%20table/one%2Ftwo%3F')
    })

    it('passes options as query params', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.get).mockResolvedValue({ record: { tableName: 'person', values: { id: 1 }, recordLabel: 'Person 1' } })

      const { getRecord } = await import('./tables')
      await getRecord('person', 1, { includeAssociations: true, tableVariant: 'v1' })

      expect(vi.mocked(apiClient.get).mock.calls[0][1]).toEqual({
        params: { includeAssociations: true, tableVariant: 'v1' },
      })
    })
  })

  describe.each(['insert', 'update'] as const)('%sRecord', (operation) => {
    it('uses the v1 route and unwraps the returned record', async () => {
      const { default: apiClient } = await import('./client')
      const { insertRecord, updateRecord } = await import('./tables')
      const saved = { tableName: 'my table', values: { id: 'one/two?', name: 'Saved' } }
      const request = operation === 'insert' ? apiClient.post : apiClient.patch
      vi.mocked(request).mockResolvedValue({ record: saved, warnings: [] })
      const values = { name: 'Saved' }
      const result = operation === 'insert'
        ? await insertRecord('my table', values)
        : await updateRecord('my table', 'one/two?', values)
      const [url, body, config] = vi.mocked(request).mock.calls[0]
      expect(url).toBe(operation === 'insert' ? '/table/my%20table' : '/table/my%20table/one%2Ftwo%3F')
      expect(body).toBeInstanceOf(FormData)
      expect((body as FormData).get('name')).toBe('Saved')
      expect(config).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } })
      expect(result).toEqual(saved)
    })

    it('preserves explicit clearing, omitted fields, false, zero, files and arrays', async () => {
      const { default: apiClient } = await import('./client')
      const { insertRecord, updateRecord } = await import('./tables')
      const request = operation === 'insert' ? apiClient.post : apiClient.patch
      vi.mocked(request).mockResolvedValue({ record: { tableName: 'person', values: { id: 1 } } })
      const file = new File(['data'], 'test.txt')
      const values = { clear: null, omitted: undefined, text: 'null', flag: false, zero: 0, file, tags: ['a', 'b'] }
      if (operation === 'insert') await insertRecord('person', values)
      else await updateRecord('person', 1, values)
      const form = vi.mocked(request).mock.calls[0][1] as FormData
      expect(form.get('clear')).toBe('')
      expect(form.has('omitted')).toBe(false)
      expect(form.get('text')).toBe('null')
      expect(form.get('flag')).toBe('false')
      expect(form.get('zero')).toBe('0')
      expect(form.get('file')).toBe(file)
      expect(form.get('tags')).toBe('["a","b"]')
    })

    it('normalizes native status messages and retains valid associated records', async () => {
      const { default: apiClient } = await import('./client')
      const { insertRecord, updateRecord } = await import('./tables')
      const saved = { tableName: 'person', values: { id: 1 }, warnings: [{ message: 'Review value' }],
        associatedRecords: { pets: [{ tableName: 'pet', values: { id: 2 } }] } }
      vi.mocked(operation === 'insert' ? apiClient.post : apiClient.patch).mockResolvedValue({ record: saved })
      const result = await (operation === 'insert' ? insertRecord('person', {}) : updateRecord('person', 1, {}))
      expect(result).toEqual({ ...saved, warnings: ['Review value'] })
    })

    it('rejects object field values before sending a corrupt string', async () => {
      const { default: apiClient } = await import('./client')
      const { insertRecord, updateRecord } = await import('./tables')
      const values = { address: { city: 'Example' } }
      await expect(operation === 'insert' ? insertRecord('person', values) : updateRecord('person', 1, values)).rejects.toThrow()
      expect(operation === 'insert' ? apiClient.post : apiClient.patch).not.toHaveBeenCalled()
    })

    it.each([
      '<html>Dashboard</html>', {}, { record: null }, { record: { values: [] } },
      { records: [{ tableName: 'person', values: {} }] },
      { record: { tableName: 'anotherTable', values: {} } },
      { record: { tableName: 'person', values: {}, errors: ['Rejected'] } },
      { record: { tableName: 'person', values: {}, errors: [{ message: 'Rejected' }] } },
      { record: { tableName: 'person', values: {}, associatedRecords: {
        pets: [{ tableName: 'pet', values: { id: 2 }, associatedRecords: {
          tags: [{ tableName: 'tag', values: {}, errors: ['Child failed'] }],
        } }],
      } } },
    ])('rejects an invalid successful write response: %j', async (response) => {
      const { default: apiClient } = await import('./client')
      const { insertRecord, updateRecord } = await import('./tables')
      vi.mocked(operation === 'insert' ? apiClient.post : apiClient.patch).mockResolvedValue(response)
      const write = operation === 'insert' ? insertRecord('person', {}) : updateRecord('person', 1, {})
      await expect(write).rejects.toThrow()
    })

    it('retains HTTP failures without reporting a saved record', async () => {
      const { default: apiClient } = await import('./client')
      const { insertRecord, updateRecord } = await import('./tables')
      const failure = new Error('Permission denied')
      vi.mocked(operation === 'insert' ? apiClient.post : apiClient.patch).mockRejectedValue(failure)
      const write = operation === 'insert' ? insertRecord('person', {}) : updateRecord('person', 1, {})
      await expect(write).rejects.toBe(failure)
    })
  })

  describe('deleteRecord', () => {
    it('uses the encoded v1 path and validates the deleted count', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.delete).mockResolvedValue({ deletedRecordCount: 1 })
      const { deleteRecord } = await import('./tables')
      expect(await deleteRecord('my table', 'one/two?')).toEqual({ deletedCount: 1 })
      expect(apiClient.delete).toHaveBeenCalledWith('/table/my%20table/one%2Ftwo%3F')
    })

    it('reports the backend reasons when nothing was deleted', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.delete).mockResolvedValue({ deletedRecordCount: 0, errors: ['Denied', 'Locked'] })
      const { deleteRecord } = await import('./tables')
      await expect(deleteRecord('person', 1)).rejects.toThrow('Denied; Locked')
    })

    it.each(['<html>Dashboard</html>', {}, { deletedRecordCount: 0 }, { deletedRecordCount: 2 },
      { deletedRecordCount: 1, errors: ['Denied'] }])('rejects an unsuccessful delete: %j', async (response) => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.delete).mockResolvedValue(response)
      const { deleteRecord } = await import('./tables')
      await expect(deleteRecord('person', 1)).rejects.toThrow()
    })
  })

  describe('exportRecords', () => {
    it('posts the v1 export body and reads the file as a blob', async () => {
      const { default: apiClient } = await import('./client')
      const file = new Blob(['id\n1'])
      vi.mocked(apiClient.post).mockResolvedValue(file)
      const { exportRecords } = await import('./tables')
      const filter = { criteria: [] }
      expect(await exportRecords('my table', 'My Export.csv', ['id', 'owner.name'], filter, { type: 'tenant', id: 2 })).toBe(file)
      const [url, body, config] = vi.mocked(apiClient.post).mock.calls[0]
      expect(url).toBe('/table/my%20table/export')
      expect(body).toEqual({ filename: 'My Export.csv', format: 'csv', fieldNames: ['id', 'owner.name'], filter, tableVariant: { type: 'tenant', id: '2' } })
      expect(config).toMatchObject({ responseType: 'blob' })
    })
  })

  describe('globalSearch', () => {
    it('posts to /search endpoint', async () => {
      const { default: apiClient } = await import('./client')
      const mockResults = [{ tableName: 'person', tableLabel: 'People', recordId: '1', recordLabel: 'Alice' }]
      vi.mocked(apiClient.post).mockResolvedValue(mockResults)

      const { globalSearch } = await import('./tables')
      const result = await globalSearch('Alice', ['person'])

      expect(apiClient.post).toHaveBeenCalledWith('/search', { searchTerm: 'Alice', tableNames: ['person'] })
      expect(result).toEqual(mockResults)
    })

    it('returns empty array on 404', async () => {
      const { default: apiClient } = await import('./client')
      // Simulate an Axios 404 — isAxiosError checks for the isAxiosError property
      const notFound = Object.assign(new Error('Not Found'), {
        isAxiosError: true,
        response: { status: 404 },
      })
      vi.mocked(apiClient.post).mockRejectedValue(notFound)

      const { globalSearch } = await import('./tables')
      const result = await globalSearch('test')

      expect(result).toEqual([])
    })

    it('re-throws non-404 errors', async () => {
      const { default: apiClient } = await import('./client')
      const serverError = Object.assign(new Error('Server Error'), {
        isAxiosError: true,
        response: { status: 500 },
      })
      vi.mocked(apiClient.post).mockRejectedValue(serverError)

      const { globalSearch } = await import('./tables')
      await expect(globalSearch('test')).rejects.toThrow('Server Error')
    })
  })

})


describe('Recursive insert transport', () => {
  it('sends exact named records and binary tags with the explicit header and deployment prefix', async () => {
    const { default: apiClient } = await import('./client')
    vi.mocked(apiClient.post).mockResolvedValue({ record: { tableName: 'parent / a', values: { id: 7 }, associatedRecords: { 'named / group': [{ tableName: 'child', values: { id: 9 } }] } } })
    const { insertRecord } = await import('./tables')
    const groups = { 'named / group': [{ values: { blob: new File([new Uint8Array([0, 128, 255])], 'bytes.bin'), clear: null, flag: false, zero: 0 }, associatedRecords: { empty: [] } }] }
    await insertRecord('parent / a', { name: 'Copy' }, groups)
    const call = vi.mocked(apiClient.post).mock.calls.at(-1)!
    expect(call[0]).toBe('/table/parent%20%2F%20a')
    expect(call[2]).toEqual({ headers: { 'Content-Type': 'multipart/form-data', 'X-QQQ-Association-Format': 'record-v1' } })
    expect(JSON.parse((call[1] as FormData).get('associations') as string)).toEqual({ 'named / group': [{ values: { blob: { base64: 'AID/' }, clear: null, flag: false, zero: 0 }, associatedRecords: { empty: [] } }] })
    expect(groups['named / group'][0].values.blob).toBeInstanceOf(File)
  })
})


describe('Recursive transport boundaries', () => {
  it('allows 64 actual levels with a known empty group, but rejects a 65th record before HTTP', async () => {
    const { default: apiClient } = await import('./client'); const { insertRecord } = await import('./tables')
    vi.mocked(apiClient.post).mockClear().mockResolvedValue({ record: { tableName: 'parent', values: { id: 1 } } })
    type Child = { values: Record<string, unknown>; associatedRecords: Record<string, Child[]> }
    const root: Record<string, Child[]> = {}; let cursor = root
    for (let i = 0; i < 64; i++) { const node: Child = { values: { name: 'value' }, associatedRecords: {} }; cursor.children = [node]; cursor = node.associatedRecords }
    cursor.children = []
    await insertRecord('parent', {}, root)
    expect(apiClient.post).toHaveBeenCalledTimes(1)
    cursor.children.push({ values: { name: 'too deep' }, associatedRecords: {} })
    await expect(insertRecord('parent', {}, root)).rejects.toThrow(/64/)
    expect(apiClient.post).toHaveBeenCalledTimes(1)
  })
})
