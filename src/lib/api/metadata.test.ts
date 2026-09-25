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
    getInstance: () => ({ defaults: { baseURL: 'https://example.invalid/prefix/qqq/v1' } }),
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

  it('uses the v1 widget metadata, including explicit denial, without a second request', async () => {
    const { default: apiClient } = await import('./client')
    const { loadMetaData } = await import('./metadata')
    const widgets = { allowed: { name: 'allowed', hasPermission: true, gridColumns: 4 }, denied: { name: 'denied', hasPermission: false } }
    const instance = { apps: {}, tables: {}, processes: {}, appTree: [], widgets, reports: {} }
    vi.mocked(apiClient.get).mockResolvedValue(instance)
    expect(await loadMetaData()).toEqual(instance)
    expect(apiClient.get).toHaveBeenCalledTimes(1)
  })

  it('takes reports from the v1 metadata and defaults them to none', async () => {
    const { default: apiClient } = await import('./client')
    const { loadMetaData } = await import('./metadata')
    const appTree = [{ name: 'app', label: 'App', type: 'APP', children: [{ name: 'rpt', label: 'Rpt', type: 'REPORT' }] }]
    const reports = { rpt: { name: 'rpt', label: 'Rpt', processName: 'reports.basic', hasPermission: true } }
    vi.mocked(apiClient.get).mockResolvedValueOnce({ apps: {}, tables: {}, processes: {}, appTree, widgets: {}, reports })
    expect((await loadMetaData()).reports).toEqual(reports)
    vi.mocked(apiClient.get).mockResolvedValueOnce({ apps: {}, tables: {}, processes: {}, appTree: [], widgets: {} })
    expect((await loadMetaData()).reports).toEqual({})
    expect(apiClient.get).toHaveBeenCalledTimes(2)
  })

  it('rejects an invalid reports map', async () => {
    const { default: apiClient } = await import('./client')
    const { loadMetaData } = await import('./metadata')
    vi.mocked(apiClient.get).mockResolvedValueOnce({ apps: {}, tables: {}, processes: {}, appTree: [], widgets: {}, reports: [] })
    await expect(loadMetaData()).rejects.toThrow('Invalid report metadata response')
  })

  it('does not infer permission for a widget without one', async () => {
    const { default: apiClient } = await import('./client')
    const { loadMetaData } = await import('./metadata')
    vi.mocked(apiClient.get).mockResolvedValueOnce({ apps: {}, tables: {}, processes: {}, appTree: [], widgets: { hidden: { name: 'hidden' } } })
    await expect(loadMetaData()).rejects.toThrow('Invalid widget metadata response')
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
    it('gets process metadata by name from the v1 route', async () => {
      const { default: apiClient } = await import('./client')
      const process = { name: 'bulkImport', minInputRecords: 1, frontendSteps: [{ name: 'upload' }] }
      vi.mocked(apiClient.get).mockResolvedValue(process)

      const { loadProcessMetaData } = await import('./metadata')
      await expect(loadProcessMetaData('bulk Import')).resolves.toEqual(process)

      expect(apiClient.get).toHaveBeenCalledWith('/metaData/process/bulk%20Import')
    })

    it('treats the step list v1 omits for a process without screens as empty', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.get).mockResolvedValue({ name: 'backendOnly' })
      const { loadProcessMetaData } = await import('./metadata')
      await expect(loadProcessMetaData('backendOnly')).resolves.toEqual({ name: 'backendOnly', frontendSteps: [] })
    })

    it('rejects a response without a process', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.get).mockResolvedValue({ error: 'nope' })

      const { loadProcessMetaData } = await import('./metadata')
      await expect(loadProcessMetaData('bulkImport')).rejects.toThrow('Invalid process metadata response')
    })
  })
})
