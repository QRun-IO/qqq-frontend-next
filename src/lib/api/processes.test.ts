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

// Tests for the process lifecycle API (registered process routes)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'

vi.mock('./client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    setUnauthorizedCallback: vi.fn(),
    getInstance: () => ({ defaults: { baseURL: 'https://sample.invalid/context/qqq/v1' } }),
  },
  apiUrl: (path: string) => `https://sample.invalid/context/qqq/v1${path}`,
}))

const LEGACY = 'https://sample.invalid/context'

/** The process values a v1 init/step body carries in its `values` JSON field. */
function valuesOf(body: unknown): Record<string, string> {
  return JSON.parse((body as FormData).get('values') as string)
}

/**
 * Build an Axios error with a response.
 * @param status - HTTP status.
 * @param data - Response body.
 * @returns The error.
 */
function httpError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError('failed', 'ERR_BAD_REQUEST', config, {}, { status, statusText: '', data, headers: {}, config })
}

describe('Processes API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('normalizeProcessResponse', () => {
    it('normalizes the registered-route shapes', async () => {
      const { normalizeProcessResponse } = await import('./processes')
      expect(normalizeProcessResponse({ processUUID: 'p', jobUUID: 'j' })).toEqual({ type: 'JOB_STARTED', processUUID: 'p', jobUUID: 'j' })
      expect(normalizeProcessResponse({ processUUID: 'p', values: { a: 1 }, nextStep: 'review', backStep: 'upload' })).toEqual({
        type: 'COMPLETE', processUUID: 'p', values: { a: 1 }, nextStep: 'review', backStep: 'upload', processMetaDataAdjustment: undefined,
      })
      expect(normalizeProcessResponse({ processUUID: 'p', jobStatus: { state: 'RUNNING', message: 'Item 2', current: 2, total: 4 } })).toEqual({
        type: 'RUNNING', processUUID: 'p', message: 'Item 2', current: 2, total: 4,
      })
      expect(normalizeProcessResponse({ processUUID: 'p', error: 'Error message: boom' })).toEqual({ type: 'ERROR', processUUID: 'p', error: 'Error message: boom', userFacingError: undefined })
      expect(normalizeProcessResponse({ processUUID: 'p', error: 'Nope', userFacingError: 'Nope' })).toMatchObject({ type: 'ERROR', userFacingError: 'Nope' })
      expect(normalizeProcessResponse('x')).toEqual({ type: 'ERROR', error: 'Unexpected server response.' })
    })

    it('treats a completed status (values plus job status) as complete and keeps step list adjustments', async () => {
      const { normalizeProcessResponse } = await import('./processes')
      const steps = [{ name: 'confirm', label: 'Confirm', components: [] }]
      expect(normalizeProcessResponse({ processUUID: 'p', jobStatus: { state: 'COMPLETE' }, values: {}, nextStep: 'confirm', processMetaDataAdjustment: { updatedFrontendStepList: steps } }))
        .toMatchObject({ type: 'COMPLETE', nextStep: 'confirm', processMetaDataAdjustment: { updatedFrontendStepList: steps } })
      expect(normalizeProcessResponse({ processUUID: 'p', values: {}, updatedFrontendStepList: steps }))
        .toMatchObject({ processMetaDataAdjustment: { updatedFrontendStepList: steps } })
    })

    it('normalizes the versioned route shapes as well', async () => {
      const { normalizeProcessResponse } = await import('./processes')
      expect(normalizeProcessResponse({ type: 'RUNNING', processUUID: 'p' })).toEqual({ type: 'RUNNING', processUUID: 'p', message: undefined, current: undefined, total: undefined })
      expect(normalizeProcessResponse({ type: 'COMPLETE', processUUID: 'p' })).toMatchObject({ type: 'COMPLETE', values: {} })
    })
  })

  describe('processInit', () => {
    it('posts the values as one v1 values field, with the selection fields and files', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.post).mockResolvedValue({ processUUID: 'p', values: {}, nextStep: 'setup' })
      const { processInit } = await import('./processes')
      const file = new File(['a,b'], 'people.csv')

      const result = await processInit('my process', {
        recordsParam: 'recordIds', recordIds: '1,3', tableName: 'person',
        values: { greeting: 'Hi', count: 3, flag: true, nested: { a: 1 }, cleared: null, skipped: undefined },
        files: { theFile: file },
      })

      const [url, body, config] = vi.mocked(apiClient.post).mock.calls[0]
      expect(url).toBe('/processes/my%20process/init')
      expect(config).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } })
      const form = body as FormData
      expect(form.get('recordsParam')).toBe('recordIds')
      expect(form.get('recordIds')).toBe('1,3')
      expect(valuesOf(form)).toEqual({ recordsParam: 'recordIds', recordIds: '1,3', tableName: 'person', greeting: 'Hi', count: '3', flag: 'true', nested: '{"a":1}', cleared: '' })
      expect(form.has('greeting')).toBe(false)
      expect((form.get('theFile') as File).name).toBe('people.csv')
      expect(result).toEqual({ type: 'COMPLETE', processUUID: 'p', values: {}, nextStep: 'setup', backStep: undefined, processMetaDataAdjustment: undefined })
    })

    it('sends a filter selection', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.post).mockResolvedValue({ processUUID: 'p', values: {} })
      const { processInit } = await import('./processes')
      await processInit('proc', { recordsParam: 'filterJSON', filterJSON: '{"criteria":[]}' })
      const form = vi.mocked(apiClient.post).mock.calls[0][1] as FormData
      expect(form.get('recordsParam')).toBe('filterJSON')
      expect(form.get('filterJSON')).toBe('{"criteria":[]}')
    })

    it('turns a 403 refusal into a permission error', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.post).mockRejectedValue(httpError(403, { processUUID: 'p' }))
      const { processInit } = await import('./processes')
      await expect(processInit('proc')).resolves.toEqual({
        type: 'ERROR', processUUID: 'p', status: 403, error: 'Permission denied.', userFacingError: 'You do not have permission to run this process.',
      })
    })

    it('turns a 400 with an error body into that error', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.post).mockRejectedValue(httpError(400, { processUUID: 'p', error: 'Bad filename' }))
      const { processInit } = await import('./processes')
      await expect(processInit('proc')).resolves.toMatchObject({ type: 'ERROR', error: 'Bad filename', status: 400 })
    })

    it('rethrows 401 so the session handler can redirect', async () => {
      const { default: apiClient } = await import('./client')
      const unauthorized = httpError(401, {})
      vi.mocked(apiClient.post).mockRejectedValue(unauthorized)
      const { processInit } = await import('./processes')
      await expect(processInit('proc')).rejects.toBe(unauthorized)
    })
  })

  describe('processStep', () => {
    it('posts the screen values to the step route', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.post).mockResolvedValue({ processUUID: 'uuid', nextStep: 'results', values: {} })
      const { processStep } = await import('./processes')
      await processStep('greet', 'uuid', 'setup', { values: { greetingPrefix: 'Hi' } })
      const [url, body, config] = vi.mocked(apiClient.post).mock.calls[0]
      expect(url).toBe('/processes/greet/uuid/step/setup')
      expect(valuesOf(body)).toEqual({ greetingPrefix: 'Hi' })
      expect(config).toEqual({ headers: { 'Content-Type': 'multipart/form-data' }, params: undefined })
    })

    it('steps back with isStepBack at the back step', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.post).mockResolvedValue({ processUUID: 'uuid', nextStep: 'fileMapping', values: {} })
      const { processStep } = await import('./processes')
      await processStep('bulk', 'uuid', 'prepareFileMapping', { isStepBack: true })
      const [url, , config] = vi.mocked(apiClient.post).mock.calls[0]
      expect(url).toBe('/processes/bulk/uuid/step/prepareFileMapping')
      expect(config?.params).toEqual({ isStepBack: 'true' })
    })
  })

  describe('processStatus', () => {
    it('reads the v1 status route and normalizes progress', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.get).mockResolvedValue({ processUUID: 'p', jobStatus: { message: 'Processing', current: 5, total: 10 } })
      const { processStatus } = await import('./processes')
      await expect(processStatus('bulk', 'p', 'j')).resolves.toEqual({ type: 'RUNNING', processUUID: 'p', message: 'Processing', current: 5, total: 10 })
      expect(apiClient.get).toHaveBeenCalledWith('/processes/bulk/p/status/j')
    })

    it('sends the run\'s table variant, which the backend requires to serve its state', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.get).mockResolvedValue({ processUUID: 'p', values: {} })
      const { processStatus } = await import('./processes')
      await processStatus('bulk', 'p', 'j', '{"type":"store","id":2}')
      expect(apiClient.get).toHaveBeenCalledWith('/processes/bulk/p/status/j', { params: { tableVariant: '{"type":"store","id":2}' } })
    })
  })

  describe('processRecords', () => {
    it('gets records with skip/limit params', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.get).mockResolvedValue({ totalRecords: 100, records: [] })
      const { processRecords } = await import('./processes')
      const result = await processRecords('bulkImport', 'proc-uuid', 10, 25)
      expect(apiClient.get).toHaveBeenCalledWith('/processes/bulkImport/proc-uuid/records', { params: { skip: 10, limit: 25 } })
      expect(result.totalRecords).toBe(100)
    })

    it('reads a run with no records, whose empty list the backend omits, as an empty page', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.get).mockResolvedValue({ totalRecords: 0 })
      const { processRecords } = await import('./processes')
      await expect(processRecords('p', 'u')).resolves.toEqual({ totalRecords: 0, records: [] })
    })

    it('rejects a non-object body, a non-number total or a non-array records value', async () => {
      const { default: apiClient } = await import('./client')
      const { processRecords } = await import('./processes')
      for (const body of ['<html>', null, { totalRecords: '0', records: [] }, { records: [] }, { totalRecords: 1, records: {} }]) {
        vi.mocked(apiClient.get).mockResolvedValue(body)
        await expect(processRecords('p', 'u')).rejects.toThrow('Invalid process records response')
      }
    })

    it('rejects a malformed records response', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.get).mockResolvedValue({ error: 'Could not find process results.' })
      const { processRecords } = await import('./processes')
      await expect(processRecords('p', 'u')).rejects.toThrow('Invalid process records response')
      vi.mocked(apiClient.get).mockResolvedValue({ totalRecords: 1, records: 'x' })
      await expect(processRecords('p', 'u')).rejects.toThrow('Invalid process records response')
    })
  })

  describe('processCancel', () => {
    it('posts to the v1 cancel route', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.post).mockResolvedValue({})
      const { processCancel } = await import('./processes')
      await expect(processCancel('bulkImport', 'proc-uuid')).resolves.toBe(true)
      expect(apiClient.post).toHaveBeenCalledWith('/processes/bulkImport/proc-uuid/cancel')
    })

    it('sends the run\'s table variant with the cancel', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.post).mockResolvedValue({})
      const { processCancel } = await import('./processes')
      await processCancel('bulkImport', 'proc-uuid', '{"type":"store","id":2}')
      expect(apiClient.post).toHaveBeenCalledWith('/processes/bulkImport/proc-uuid/cancel', undefined, { params: { tableVariant: '{"type":"store","id":2}' } })
    })
  })

  describe('saved bulk load profiles', () => {
    it('queries profiles through the query process and reads the record values', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.post).mockResolvedValue({
        processUUID: 'p', values: { savedBulkLoadProfileList: [{ tableName: 'savedBulkLoadProfile', values: { id: 3, label: 'CSV', tableName: 'person', mappingJson: '{}' } }] },
      })
      const { querySavedBulkLoadProfiles } = await import('./processes')
      await expect(querySavedBulkLoadProfiles('person', false)).resolves.toEqual([{ id: 3, label: 'CSV', tableName: 'person', mappingJson: '{}' }])
      const [url, body] = vi.mocked(apiClient.post).mock.calls[0]
      expect(url).toBe('/processes/querySavedBulkLoadProfile/init')
      expect(valuesOf(body)).toEqual({ tableName: 'person', isBulkEdit: 'false' })
      expect((body as FormData).get('stepTimeoutMillis')).toBe('60000')
    })

    it('stores and deletes profiles and surfaces the backend refusal', async () => {
      const { default: apiClient } = await import('./client')
      const { storeSavedBulkLoadProfile, deleteSavedBulkLoadProfile } = await import('./processes')
      vi.mocked(apiClient.post).mockResolvedValueOnce({ processUUID: 'p', values: { savedBulkLoadProfileList: [{ values: { id: 9, label: 'New', tableName: 'person', mappingJson: '{"version":"v1"}' } }] } })
      await expect(storeSavedBulkLoadProfile({ label: 'New', tableName: 'person', isBulkEdit: false, mappingJson: '{"version":"v1"}' })).resolves.toMatchObject({ id: 9 })
      expect(valuesOf(vi.mocked(apiClient.post).mock.calls[0][1]).mappingJson).toBe('{"version":"v1"}')
      vi.mocked(apiClient.post).mockResolvedValueOnce({ processUUID: 'p', error: 'dup', userFacingError: 'You already have a saved Bulk Load Profile on this table with this name.' })
      await expect(storeSavedBulkLoadProfile({ label: 'New', tableName: 'person', isBulkEdit: false, mappingJson: '{}' })).rejects.toThrow('You already have a saved Bulk Load Profile on this table with this name.')
      vi.mocked(apiClient.post).mockResolvedValueOnce({ processUUID: 'p', values: {} })
      await deleteSavedBulkLoadProfile(9)
      expect(vi.mocked(apiClient.post).mock.calls[2][0]).toBe('/processes/deleteSavedBulkLoadProfile/init')
      expect(valuesOf(vi.mocked(apiClient.post).mock.calls[2][1]).id).toBe('9')
    })
  })

  describe('processDownloadUrl', () => {
    it('builds server-file and storage download links', async () => {
      const { processDownloadUrl } = await import('./processes')
      expect(processDownloadUrl({ downloadFileName: 'lab a.txt', serverFilePath: '/tmp/x y.txt' }))
        .toBe(`${LEGACY}/qqq/v1/download/lab%20a.txt?filePath=%2Ftmp%2Fx+y.txt`)
      expect(processDownloadUrl({ downloadFileName: 'r.csv', storageTableName: 'store', storageReference: 'a/b' }))
        .toBe(`${LEGACY}/qqq/v1/download/r.csv?storageTableName=store&storageReference=a%2Fb`)
      expect(processDownloadUrl({ downloadFileName: 'r.csv' })).toBeNull()
      expect(processDownloadUrl({ serverFilePath: '/tmp/x' })).toBeNull()
    })
  })
})

describe('v1 widget-block process values', () => {
  it('reads v1 WidgetBlock values in the block-data shape', async () => {
    const { blockDataFromV1 } = await import('./processes')
    expect(blockDataFromV1({ blockType: 'COMPOSITE', blockTypeName: 'COMPOSITE', subBlocks: [{ blockType: 'TEXT', values: { text: 'Hi' } }] }))
      .toEqual({ blockType: 'COMPOSITE', blockTypeName: 'COMPOSITE', type: 'composite', blocks: [{ blockType: 'TEXT', blockTypeName: 'TEXT', type: 'block', values: { text: 'Hi' } }] })
    const record = { tableName: 'person', values: { blockType: 'x' } }
    expect(blockDataFromV1(record)).toBe(record)
    expect(blockDataFromV1('text')).toBe('text')
  })
})
