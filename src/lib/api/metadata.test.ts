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

// Tests for metadata API functions

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./client', () => ({
  default: {
    get: vi.fn(),
    setUnauthorizedCallback: vi.fn(),
  },
}))

describe('Metadata API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('loadMetaData', () => {
    it('gets /metaData with frontend params', async () => {
      const { default: apiClient } = await import('./client')
      const mockInstance = { apps: {}, tables: {}, processes: {}, appTree: [], reports: {}, widgets: {}, branding: {}, helpContents: {}, environmentValues: {} }
      vi.mocked(apiClient.get).mockResolvedValue(mockInstance)

      const { loadMetaData } = await import('./metadata')
      const result = await loadMetaData()

      expect(apiClient.get).toHaveBeenCalledWith('/metaData', {
        params: expect.objectContaining({ frontendName: 'qqq-frontend-next' }),
      })
      expect(result).toEqual(mockInstance)
    })
  })

  describe('loadTableMetaData', () => {
    it('gets table metadata by name', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.get).mockResolvedValue({ name: 'person', fields: {}, sections: [] })

      const { loadTableMetaData } = await import('./metadata')
      await loadTableMetaData('person')

      expect(apiClient.get).toHaveBeenCalledWith('/metaData/table/person')
    })

    it('URL-encodes the table name', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.get).mockResolvedValue({})

      const { loadTableMetaData } = await import('./metadata')
      await loadTableMetaData('my table')

      expect(apiClient.get).toHaveBeenCalledWith('/metaData/table/my%20table')
    })
  })

  describe('loadProcessMetaData', () => {
    it('gets process metadata by name', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.get).mockResolvedValue({ name: 'bulkImport', frontendSteps: [] })

      const { loadProcessMetaData } = await import('./metadata')
      await loadProcessMetaData('bulkImport')

      expect(apiClient.get).toHaveBeenCalledWith('/metaData/process/bulkImport')
    })
  })
})
