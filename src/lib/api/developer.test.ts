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

// Tests for the developer API (API catalog, record developer routes, script processes)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'

vi.mock('./client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    setUnauthorizedCallback: vi.fn(),
    getInstance: () => ({ defaults: { baseURL: 'https://sample.invalid/context/qqq/v1' } }),
  },
}))

vi.mock('./processes', () => ({
  processInit: vi.fn(),
  processStatus: vi.fn(),
}))

vi.mock('./tables', () => ({
  queryRecords: vi.fn(),
}))

/** The API middleware's base URL (the configured base without `/qqq/v1`). */
const API_MIDDLEWARE = 'https://sample.invalid/context'

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

describe('Developer API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getTableApis', () => {
    it('reads /apis.json beside /qqq/v1 with the table name and keeps well-formed APIs', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.get).mockResolvedValue({
        apis: [
          { name: 'person-api', path: '/person-api/', label: 'Person API' },
          { name: 'unlabelled', path: '/other/' },
          { name: 'broken' },
        ],
      })
      const { getTableApis } = await import('./developer')

      expect(await getTableApis('person')).toEqual([
        { name: 'person-api', path: '/person-api/', label: 'Person API' },
        { name: 'unlabelled', path: '/other/', label: 'unlabelled' },
      ])
      expect(apiClient.get).toHaveBeenCalledWith('/apis.json', { baseURL: API_MIDDLEWARE, params: { tableName: 'person' } })
    })

    it('treats a 404, a non-JSON body and a body without apis as no APIs', async () => {
      const { default: apiClient } = await import('./client')
      const { getTableApis } = await import('./developer')

      vi.mocked(apiClient.get).mockRejectedValueOnce(httpError(404, '<html>Not found</html>'))
      expect(await getTableApis('person')).toEqual([])

      vi.mocked(apiClient.get).mockResolvedValueOnce('<!DOCTYPE html><html></html>')
      expect(await getTableApis('person')).toEqual([])

      vi.mocked(apiClient.get).mockResolvedValueOnce({})
      expect(await getTableApis('person')).toEqual([])
    })

    it('rethrows other failures', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.get).mockRejectedValueOnce(httpError(500, { error: 'boom' }))
      const { getTableApis } = await import('./developer')

      await expect(getTableApis('person')).rejects.toThrow('failed')
    })
  })

  describe('getApiVersions and apiTableSpecUrl', () => {
    it('reads versions.json under the API path', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.get).mockResolvedValue({ supportedVersions: ['2026.Q1', '2026.Q2', 3], currentVersion: '2026.Q2' })
      const { getApiVersions } = await import('./developer')

      expect(await getApiVersions('/person-api/')).toEqual({ supportedVersions: ['2026.Q1', '2026.Q2'], currentVersion: '2026.Q2' })
      expect(apiClient.get).toHaveBeenCalledWith('/person-api/versions.json', { baseURL: API_MIDDLEWARE })
    })

    it('rejects a body without supported versions', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.get).mockResolvedValue({ currentVersion: 'v1' })
      const { getApiVersions } = await import('./developer')

      await expect(getApiVersions('/person-api/')).rejects.toThrow('Invalid API versions response')
    })

    it('builds the per-table OpenAPI spec URL under the backend root', async () => {
      const { apiTableSpecUrl } = await import('./developer')
      expect(apiTableSpecUrl({ name: 'person-api', path: '/person-api/', label: 'Person API' }, '2026.Q2', 'person'))
        .toBe(`${API_MIDDLEWARE}/person-api/2026.Q2/person/openapi.json`)
    })
  })

  describe('record developer routes', () => {
    it('loads the developer data and shapes each associated script', async () => {
      const { default: apiClient } = await import('./client')
      const record = { tableName: 'scriptLab', values: { id: 1, greetingScriptId: 101 } }
      vi.mocked(apiClient.get).mockResolvedValue({
        record,
        associatedScripts: [
          {
            associatedScript: { fieldName: 'greetingScriptId', scriptTypeId: 101, scriptTester: { name: 'Tester' } },
            scriptType: { tableName: 'scriptType', values: { id: 101, fileMode: 1 } },
            script: { tableName: 'script', values: { id: 101 } },
            scriptRevisions: [{ tableName: 'scriptRevision', values: { id: 102 } }, 'junk'],
            testInputFields: [{ name: 'name', label: 'Greeting Name' }],
            testOutputFields: [{ name: 'greeting', label: 'Greeting' }],
          },
          { notAnAssociatedScript: true },
        ],
      })
      const { getRecordDeveloperData } = await import('./developer')

      const data = await getRecordDeveloperData('script lab', 1)

      expect(apiClient.get).toHaveBeenCalledWith('/table/script%20lab/1/developer')
      expect(data.record).toEqual(record)
      expect(data.associatedScripts).toEqual([{
        associatedScript: { fieldName: 'greetingScriptId', scriptTypeId: 101 },
        scriptType: { tableName: 'scriptType', values: { id: 101, fileMode: 1 } },
        script: { tableName: 'script', values: { id: 101 } },
        scriptRevisions: [{ tableName: 'scriptRevision', values: { id: 102 } }],
        testInputFields: [{ name: 'name', label: 'Greeting Name' }],
        testOutputFields: [{ name: 'greeting', label: 'Greeting' }],
      }])
    })

    it('rejects a developer response without a record', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.get).mockResolvedValue({ associatedScripts: [] })
      const { getRecordDeveloperData } = await import('./developer')

      await expect(getRecordDeveloperData('scriptLab', 1)).rejects.toThrow('Invalid record developer response')
    })

    it('creates an associated script through the v1 route with a JSON body', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.post).mockResolvedValue({ scriptId: 7, scriptName: 'Beta Greeting', scriptRevisionId: 8, scriptRevisionSequenceNo: 1 })
      const { storeRecordAssociatedScript } = await import('./developer')

      const result = await storeRecordAssociatedScript('scriptLab', 2, 'greetingScriptId', '// code', 'Initial version')

      expect(result).toEqual({ scriptId: 7, scriptName: 'Beta Greeting', scriptRevisionId: 8, scriptRevisionSequenceNo: 1 })
      const call = vi.mocked(apiClient.post).mock.calls[0]
      expect(call).toEqual(['/table/scriptLab/2/developer/associatedScript/greetingScriptId', { contents: '// code', commitMessage: 'Initial version' }])
    })

    it('loads the logs of one revision', async () => {
      const { default: apiClient } = await import('./client')
      const log = { tableName: 'scriptLog', values: { id: 5, scriptLogLine: [{ tableName: 'scriptLogLine', values: { text: 'hi' } }] } }
      vi.mocked(apiClient.get).mockResolvedValue({ scriptLogRecords: [log] })
      const { getAssociatedScriptLogs } = await import('./developer')

      expect(await getAssociatedScriptLogs('scriptLab', 1, 'greetingScriptId', 102)).toEqual([log])
      expect(apiClient.get).toHaveBeenCalledWith('/table/scriptLab/1/developer/associatedScript/greetingScriptId/102/logs')
    })
  })

  describe('script processes', () => {
    it('stores a revision through storeScriptRevision with one value per file', async () => {
      const { processInit } = await import('./processes')
      vi.mocked(processInit).mockResolvedValue({
        type: 'COMPLETE', processUUID: 'p',
        values: { scriptId: 101, scriptName: 'Alpha Greeting', scriptRevisionId: 103, scriptRevisionSequenceNo: 3 },
      })
      const { storeScriptRevision } = await import('./developer')

      const result = await storeScriptRevision({ scriptId: 101, commitMessage: 'Louder', files: { 'Script.js': 'return 1;', 'Other.js': 'x' } })

      expect(result).toEqual({ scriptId: 101, scriptName: 'Alpha Greeting', scriptRevisionId: 103, scriptRevisionSequenceNo: 3 })
      expect(processInit).toHaveBeenCalledWith('storeScriptRevision', {
        values: {
          scriptId: 101,
          fileNames: 'Script.js,Other.js',
          'fileContents:Script.js': 'return 1;',
          'fileContents:Other.js': 'x',
          commitMessage: 'Louder',
        },
        stepTimeoutMillis: 60000,
      })
    })

    it('throws the user-facing message of a refused or failed process', async () => {
      const { processInit } = await import('./processes')
      vi.mocked(processInit).mockResolvedValue({
        type: 'ERROR', status: 403, error: 'Permission denied.', userFacingError: 'You do not have permission to run this process.',
      })
      const { storeScriptRevision } = await import('./developer')

      await expect(storeScriptRevision({ scriptId: 1, commitMessage: 'x', files: {} }))
        .rejects.toThrow('You do not have permission to run this process.')
    })

    it('follows an async job until it completes', async () => {
      vi.useFakeTimers()
      try {
        const { processInit, processStatus } = await import('./processes')
        vi.mocked(processInit).mockResolvedValue({ type: 'JOB_STARTED', processUUID: 'p', jobUUID: 'j' })
        vi.mocked(processStatus)
          .mockResolvedValueOnce({ type: 'RUNNING', processUUID: 'p' })
          .mockResolvedValueOnce({ type: 'COMPLETE', processUUID: 'p', values: { scriptRevisionId: 9 } })
        const { storeScriptRevision } = await import('./developer')

        const pending = storeScriptRevision({ scriptId: 1, commitMessage: 'x', files: {} })
        await vi.advanceTimersByTimeAsync(2000)

        expect(await pending).toMatchObject({ scriptRevisionId: 9 })
        expect(processStatus).toHaveBeenCalledWith('storeScriptRevision', 'p', 'j')
      } finally {
        vi.useRealTimers()
      }
    })

    it('tests a script with inputs and files and shapes outputs, log lines and the exception chain', async () => {
      const { processInit } = await import('./processes')
      vi.mocked(processInit).mockResolvedValue({
        type: 'COMPLETE', processUUID: 'p',
        values: {
          outputObject: { greeting: 'Hello, Ada!' },
          scriptLogLines: [{ tableName: 'scriptLogLine', values: { timestamp: '2026-09-25T01:02:03Z', text: 'Tested with Ada' } }],
          exception: { message: 'Greeting script failed', cause: { message: 'root cause' } },
        },
      })
      const { testScript } = await import('./developer')

      const result = await testScript({ scriptId: 101, files: { 'Script.js': 'throw 1' }, inputValues: { name: 'Ada' } })

      expect(processInit).toHaveBeenCalledWith('testScript', {
        values: { name: 'Ada', scriptId: 101, fileNames: 'Script.js', 'fileContents:Script.js': 'throw 1' },
        stepTimeoutMillis: 60000,
      })
      expect(result).toEqual({
        outputObject: { greeting: 'Hello, Ada!' },
        logLines: [{ timestamp: '2026-09-25T01:02:03Z', text: 'Tested with Ada' }],
        exceptionMessage: 'Greeting script failed\ncaused by: root cause',
      })
    })

    it('returns no exception message when the test passed', async () => {
      const { processInit } = await import('./processes')
      vi.mocked(processInit).mockResolvedValue({ type: 'COMPLETE', processUUID: 'p', values: {} })
      const { testScript } = await import('./developer')

      expect(await testScript({ scriptId: 1, files: {}, inputValues: {} }))
        .toEqual({ outputObject: {}, logLines: [], exceptionMessage: undefined })
    })
  })

  describe('scripts table queries', () => {
    it('queries revisions by script (sequence descending), files by revision and file schemas by type', async () => {
      const { queryRecords } = await import('./tables')
      vi.mocked(queryRecords).mockResolvedValue({ records: [{ tableName: 't', values: { id: 1 } }] })
      const { queryScriptRevisions, queryScriptRevisionFiles, queryScriptTypeFileSchemas } = await import('./developer')

      expect(await queryScriptRevisions(101)).toEqual([{ tableName: 't', values: { id: 1 } }])
      await queryScriptRevisionFiles(102)
      await queryScriptTypeFileSchemas(5)

      expect(queryRecords).toHaveBeenNthCalledWith(1, 'scriptRevision', { filter: {
        criteria: [{ fieldName: 'scriptId', operator: 'EQUALS', values: [101] }],
        orderBys: [{ fieldName: 'sequenceNo', isAscending: false }],
        booleanOperator: 'AND', skip: 0, limit: 25,
      } })
      expect(queryRecords).toHaveBeenNthCalledWith(2, 'scriptRevisionFile', expect.objectContaining({ filter: expect.objectContaining({
        criteria: [{ fieldName: 'scriptRevisionId', operator: 'EQUALS', values: [102] }],
      }) }))
      expect(queryRecords).toHaveBeenNthCalledWith(3, 'scriptTypeFileSchema', expect.objectContaining({ filter: expect.objectContaining({
        criteria: [{ fieldName: 'scriptTypeId', operator: 'EQUALS', values: [5] }],
      }) }))
    })
  })
})
