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

  it('resolves missing widget permissions from actual metadata and retains explicit denial', async () => {
    const { default: apiClient } = await import('./client')
    const { loadMetaData } = await import('./metadata')
    const light = { apps: {}, tables: {}, processes: {}, appTree: [], widgets: { allowed: { name: 'allowed', type: 'statistics' } } }
    const widgets = { allowed: { name: 'allowed', hasPermission: true, gridColumns: 4 }, denied: { name: 'denied', hasPermission: false } }
    vi.mocked(apiClient.get).mockResolvedValueOnce(light).mockResolvedValueOnce({ widgets })
    expect(await loadMetaData()).toEqual({ ...light, widgets, reports: {} })
    expect(apiClient.get).toHaveBeenLastCalledWith('/metaData', expect.objectContaining({ baseURL: 'https://example.invalid/prefix' }))
    vi.mocked(apiClient.get).mockClear().mockResolvedValue({ ...light, widgets })
    expect(await loadMetaData()).toEqual({ ...light, widgets })
    expect(apiClient.get).toHaveBeenCalledTimes(1)
  })

  it('resolves reports the app tree links to from the full metadata (v1 omits reports)', async () => {
    const { default: apiClient } = await import('./client')
    const { loadMetaData } = await import('./metadata')
    const appTree = [{ name: 'app', label: 'App', type: 'APP', children: [{ name: 'rpt', label: 'Rpt', type: 'REPORT' }] }]
    const light = { apps: {}, tables: {}, processes: {}, appTree, widgets: {} }
    const reports = { rpt: { name: 'rpt', label: 'Rpt', isHidden: false, hasPermission: true } }
    vi.mocked(apiClient.get).mockResolvedValueOnce(light).mockResolvedValueOnce({ reports })
    expect(await loadMetaData()).toEqual({ ...light, reports })
    // An app tree without report nodes needs no second request
    vi.mocked(apiClient.get).mockClear().mockResolvedValue({ ...light, appTree: [] })
    await loadMetaData()
    expect(apiClient.get).toHaveBeenCalledTimes(1)
  })

  it('rejects an invalid reports map when the app tree links to reports', async () => {
    const { default: apiClient } = await import('./client')
    const { loadMetaData } = await import('./metadata')
    const appTree = [{ name: 'rpt', label: 'Rpt', type: 'REPORT' }]
    const light = { apps: {}, tables: {}, processes: {}, appTree, widgets: {} }
    vi.mocked(apiClient.get).mockResolvedValueOnce(light).mockResolvedValueOnce({ reports: [] })
    await expect(loadMetaData()).rejects.toThrow('Invalid report metadata response')
  })

  it('takes reports (absent from V1) from the full metadata route', async () => {
    const { default: apiClient } = await import('./client')
    const { loadMetaData } = await import('./metadata')
    const light = { apps: {}, tables: {}, processes: {}, appTree: [], widgets: { w: { name: 'w' } } }
    const reports = { people: { name: 'people', label: 'People', processName: 'reports.basic', hasPermission: true } }
    vi.mocked(apiClient.get).mockResolvedValueOnce(light).mockResolvedValueOnce({ widgets: { w: { name: 'w', hasPermission: true } }, reports })
    expect((await loadMetaData()).reports).toEqual(reports)
  })

  it('does not infer permission when full widget metadata fails', async () => {
    const { default: apiClient } = await import('./client')
    const { loadMetaData } = await import('./metadata')
    const light = { apps: {}, tables: {}, processes: {}, appTree: [], widgets: { hidden: { name: 'hidden' } } }
    vi.mocked(apiClient.get).mockResolvedValueOnce(light).mockRejectedValueOnce(new Error('Permission denied'))
    await expect(loadMetaData()).rejects.toThrow('Permission denied')
    vi.mocked(apiClient.get).mockResolvedValueOnce(light).mockResolvedValueOnce('<html>SPA</html>')
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
    it('gets process metadata by name from the registered route and unwraps it', async () => {
      const { default: apiClient } = await import('./client')
      const process = { name: 'bulkImport', minInputRecords: 1, frontendSteps: [] }
      vi.mocked(apiClient.get).mockResolvedValue({ process })

      const { loadProcessMetaData } = await import('./metadata')
      await expect(loadProcessMetaData('bulk Import')).resolves.toEqual(process)

      expect(apiClient.get).toHaveBeenCalledWith('/metaData/process/bulk%20Import', { baseURL: 'https://example.invalid/prefix' })
    })

    it('rejects a response without a process', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.get).mockResolvedValue({ error: 'nope' })

      const { loadProcessMetaData } = await import('./metadata')
      await expect(loadProcessMetaData('bulkImport')).rejects.toThrow('Invalid process metadata response')
    })
  })
})
