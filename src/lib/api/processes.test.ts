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

// Tests for process lifecycle API functions

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    setUnauthorizedCallback: vi.fn(),
  },
}))

describe('Processes API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('processInit', () => {
    it('posts FormData to /processes/{name}/init', async () => {
      const { default: apiClient } = await import('./client')
      const mockResponse = { nextStep: 'step1', values: {} }
      vi.mocked(apiClient.post).mockResolvedValue(mockResponse)

      const { processInit } = await import('./processes')
      const result = await processInit('bulkImport', {})

      expect(apiClient.post).toHaveBeenCalled()
      const [url, body, config] = vi.mocked(apiClient.post).mock.calls[0]
      expect(url).toBe('/processes/bulkImport/init')
      expect(body).toBeInstanceOf(FormData)
      expect(config).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } })
      expect(result).toEqual(mockResponse)
    })

    it('includes values as JSON when provided', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.post).mockResolvedValue({})

      const { processInit } = await import('./processes')
      await processInit('myProc', { values: { key: 'value' } })

      const formData = vi.mocked(apiClient.post).mock.calls[0][1] as FormData
      expect(formData.get('values')).toBe('{"key":"value"}')
    })

    it('includes recordsParam when provided', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.post).mockResolvedValue({})

      const { processInit } = await import('./processes')
      await processInit('myProc', { recordsParam: 'recordIds', recordIds: '1,2,3' })

      const formData = vi.mocked(apiClient.post).mock.calls[0][1] as FormData
      expect(formData.get('recordsParam')).toBe('recordIds')
      expect(formData.get('recordIds')).toBe('1,2,3')
    })

    it('includes file when provided', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.post).mockResolvedValue({})

      const { processInit } = await import('./processes')
      const file = new File(['data'], 'upload.csv')
      await processInit('myProc', { file })

      const formData = vi.mocked(apiClient.post).mock.calls[0][1] as FormData
      expect(formData.get('file')).toBe(file)
    })

    it('URL-encodes process name', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.post).mockResolvedValue({})

      const { processInit } = await import('./processes')
      await processInit('my process', {})

      expect(vi.mocked(apiClient.post).mock.calls[0][0]).toBe('/processes/my%20process/init')
    })

    it('includes stepTimeoutMillis when provided', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.post).mockResolvedValue({})

      const { processInit } = await import('./processes')
      await processInit('myProc', { stepTimeoutMillis: 5000 })

      const formData = vi.mocked(apiClient.post).mock.calls[0][1] as FormData
      expect(formData.get('stepTimeoutMillis')).toBe('5000')
    })

    it('includes filterJSON when provided', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.post).mockResolvedValue({})

      const { processInit } = await import('./processes')
      await processInit('myProc', { filterJSON: '{"criteria":[]}' })

      const formData = vi.mocked(apiClient.post).mock.calls[0][1] as FormData
      expect(formData.get('filterJSON')).toBe('{"criteria":[]}')
    })
  })

  describe('processStep', () => {
    it('posts to /processes/{name}/{uuid}/step/{step}', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.post).mockResolvedValue({ nextStep: 'step2', values: {} })

      const { processStep } = await import('./processes')
      await processStep('bulkImport', 'proc-uuid', 'step1', { values: { name: 'test' } })

      const [url] = vi.mocked(apiClient.post).mock.calls[0]
      expect(url).toBe('/processes/bulkImport/proc-uuid/step/step1')
    })

    it('includes file in FormData', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.post).mockResolvedValue({})

      const { processStep } = await import('./processes')
      const file = new File(['csv'], 'data.csv')
      await processStep('proc', 'uuid1', 'upload', { file })

      const formData = vi.mocked(apiClient.post).mock.calls[0][1] as FormData
      expect(formData.get('file')).toBe(file)
    })
  })

  describe('processStatus', () => {
    it('gets status from /processes/{name}/{uuid}/status/{jobUUID}', async () => {
      const { default: apiClient } = await import('./client')
      const mockStatus = { message: 'Processing...', current: 5, total: 10 }
      vi.mocked(apiClient.get).mockResolvedValue(mockStatus)

      const { processStatus } = await import('./processes')
      const result = await processStatus('bulkImport', 'proc-uuid', 'job-uuid')

      expect(apiClient.get).toHaveBeenCalledWith('/processes/bulkImport/proc-uuid/status/job-uuid')
      expect(result).toEqual(mockStatus)
    })
  })

  describe('processRecords', () => {
    it('gets records with skip/limit params', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.get).mockResolvedValue({ totalRecords: 100, records: [] })

      const { processRecords } = await import('./processes')
      const result = await processRecords('bulkImport', 'proc-uuid', 10, 25)

      expect(apiClient.get).toHaveBeenCalledWith(
        '/processes/bulkImport/proc-uuid/records',
        { params: { skip: 10, limit: 25 } }
      )
      expect(result.totalRecords).toBe(100)
    })

    it('uses default skip=0 and limit=50', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.get).mockResolvedValue({ totalRecords: 0, records: [] })

      const { processRecords } = await import('./processes')
      await processRecords('proc', 'uuid')

      expect(vi.mocked(apiClient.get).mock.calls[0][1]).toEqual({ params: { skip: 0, limit: 50 } })
    })
  })

  describe('processCancel', () => {
    it('calls cancel endpoint', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.get).mockResolvedValue(true)

      const { processCancel } = await import('./processes')
      const result = await processCancel('bulkImport', 'proc-uuid')

      expect(apiClient.get).toHaveBeenCalledWith('/processes/bulkImport/proc-uuid/cancel')
      expect(result).toBe(true)
    })
  })
})
