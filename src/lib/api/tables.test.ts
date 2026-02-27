// Tests for table data API functions

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    setUnauthorizedCallback: vi.fn(),
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
      vi.mocked(apiClient.get).mockResolvedValue(mockRecord)

      const { getRecord } = await import('./tables')
      const result = await getRecord('person', 1)

      expect(apiClient.get).toHaveBeenCalledWith('/table/person/1', { params: undefined })
      expect(result).toEqual(mockRecord)
    })

    it('passes options as query params', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.get).mockResolvedValue({})

      const { getRecord } = await import('./tables')
      await getRecord('person', 1, { includeAssociations: true, tableVariant: 'v1' })

      expect(vi.mocked(apiClient.get).mock.calls[0][1]).toEqual({
        params: { includeAssociations: true, tableVariant: 'v1' },
      })
    })
  })

  describe('insertRecord', () => {
    it('posts FormData to /table/{name}', async () => {
      const { default: apiClient } = await import('./client')
      const mockRecord = { tableName: 'person', values: { id: 26, firstName: 'Bob' }, recordLabel: 'Bob', displayValues: {} }
      vi.mocked(apiClient.post).mockResolvedValue(mockRecord)

      const { insertRecord } = await import('./tables')
      const result = await insertRecord('person', { firstName: 'Bob', age: 30 })

      expect(apiClient.post).toHaveBeenCalled()
      const [url, body, config] = vi.mocked(apiClient.post).mock.calls[0]
      expect(url).toBe('/table/person')
      expect(body).toBeInstanceOf(FormData)
      expect((body as FormData).get('firstName')).toBe('Bob')
      expect(config).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } })
      expect(result).toEqual(mockRecord)
    })

    it('handles File values correctly', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.post).mockResolvedValue({})

      const { insertRecord } = await import('./tables')
      const file = new File(['data'], 'test.txt')
      await insertRecord('person', { photo: file })

      const formData = vi.mocked(apiClient.post).mock.calls[0][1] as FormData
      expect(formData.get('photo')).toBe(file)
    })

    it('handles Array values as JSON', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.post).mockResolvedValue({})

      const { insertRecord } = await import('./tables')
      await insertRecord('person', { tags: ['a', 'b'] })

      const formData = vi.mocked(apiClient.post).mock.calls[0][1] as FormData
      expect(formData.get('tags')).toBe('["a","b"]')
    })

    it('skips null and undefined values', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.post).mockResolvedValue({})

      const { insertRecord } = await import('./tables')
      await insertRecord('person', { name: 'Alice', missing: null, undef: undefined })

      const formData = vi.mocked(apiClient.post).mock.calls[0][1] as FormData
      expect(formData.get('name')).toBe('Alice')
      expect(formData.get('missing')).toBeNull()
      expect(formData.get('undef')).toBeNull()
    })
  })

  describe('updateRecord', () => {
    it('puts FormData to /table/{name}/{id}', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.put).mockResolvedValue({})

      const { updateRecord } = await import('./tables')
      await updateRecord('person', 1, { firstName: 'Updated' })

      const [url, body] = vi.mocked(apiClient.put).mock.calls[0]
      expect(url).toBe('/table/person/1')
      expect(body).toBeInstanceOf(FormData)
      expect((body as FormData).get('firstName')).toBe('Updated')
    })
  })

  describe('deleteRecord', () => {
    it('sends DELETE to /table/{name}/{id}', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.delete).mockResolvedValue({ deletedCount: 1 })

      const { deleteRecord } = await import('./tables')
      const result = await deleteRecord('person', 1)

      expect(apiClient.delete).toHaveBeenCalledWith('/table/person/1')
      expect(result).toEqual({ deletedCount: 1 })
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

  describe('getAuditRecords', () => {
    it('gets audit records for a table record', async () => {
      const { default: apiClient } = await import('./client')
      const mockAudits = [{ message: 'Created', timestamp: '2025-01-01', username: 'admin', fieldChanges: [] }]
      vi.mocked(apiClient.get).mockResolvedValue({ records: mockAudits })

      const { getAuditRecords } = await import('./tables')
      const result = await getAuditRecords('person', 1)

      expect(apiClient.get).toHaveBeenCalledWith('/table/person/1/audits')
      expect(result).toEqual(mockAudits)
    })
  })
})
