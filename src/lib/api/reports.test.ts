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

// Tests for the reports API: process-based runs, input steps, downloads (#664)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'

vi.mock('./processes', () => ({ processInit: vi.fn(), processStep: vi.fn(), processStatus: vi.fn() }))

import type { ProcessResponse } from './processes'
import { processInit, processStatus, processStep } from './processes'
import { pollReport, reportDownloadUrl, reportFileUrl, reportStateFromResponse, startReport, submitReportInputs } from './reports'

const initMock = vi.mocked(processInit)

describe('reports API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('runs the report process with the report name and format', async () => {
    initMock.mockResolvedValue({ processUUID: 'p1', nextStep: 'accessReport', values: { downloadFileName: 'Owned Report - 2026.csv', serverFilePath: '/tmp/r.csv' } } as unknown as ProcessResponse)
    const state = await startReport('reports.basic', 'accPersonReport', 'CSV')
    expect(initMock).toHaveBeenCalledWith('reports.basic', { values: { reportName: 'accPersonReport', reportFormat: 'CSV' } })
    expect(state).toEqual({ kind: 'done', processUUID: 'p1', fileName: 'Owned Report - 2026.csv', downloadUrl: reportDownloadUrl('Owned Report - 2026.csv', '/tmp/r.csv') })
    expect(reportDownloadUrl('Owned Report - 2026.csv', '/tmp/r.csv')).toBe('/qqq/v1/download/Owned%20Report%20-%202026.csv?filePath=%2Ftmp%2Fr.csv')
  })

  it('returns the input fields when the report declares them, and submits them to the input step', async () => {
    initMock.mockResolvedValue({ processUUID: 'p2', nextStep: 'input', values: { inputFieldList: [{ name: 'minimumId', label: 'Minimum Id', type: 'INTEGER', isRequired: true }] } } as unknown as ProcessResponse)
    const state = await startReport('reports.basic', 'accPersonInputReport', 'JSON')
    expect(state).toMatchObject({ kind: 'input', processUUID: 'p2', inputFields: [{ name: 'minimumId' }] })
    vi.mocked(processStep).mockResolvedValue({ processUUID: 'p2', values: { downloadFileName: 'r.json', serverFilePath: '/tmp/r.json' } } as unknown as ProcessResponse)
    expect(await submitReportInputs('reports.basic', 'p2', { minimumId: 3 })).toMatchObject({ kind: 'done', fileName: 'r.json' })
    expect(processStep).toHaveBeenCalledWith('reports.basic', 'p2', 'input', { values: { minimumId: 3 } })
  })

  it('polls asynchronous jobs until they finish', async () => {
    initMock.mockResolvedValue({ processUUID: 'p3', jobUUID: 'j3' } as unknown as ProcessResponse)
    expect(await startReport('reports.basic', 'big', 'XLSX')).toEqual({ kind: 'running', processUUID: 'p3', jobUUID: 'j3' })
    vi.mocked(processStatus).mockResolvedValueOnce({ processUUID: 'p3', type: 'RUNNING', message: 'Generating Report' } as unknown as ProcessResponse)
    expect(await pollReport('reports.basic', 'p3', 'j3')).toEqual({ kind: 'running', processUUID: 'p3', jobUUID: 'j3', message: 'Generating Report' })
    vi.mocked(processStatus).mockResolvedValueOnce({ processUUID: 'p3', values: { downloadFileName: 'big.xlsx', serverFilePath: '/tmp/big.xlsx' } } as unknown as ProcessResponse)
    expect(await pollReport('reports.basic', 'p3', 'j3')).toMatchObject({ kind: 'done', fileName: 'big.xlsx' })
  })

  it('reports backend errors and permission denials', async () => {
    expect(reportStateFromResponse({ processUUID: 'p', error: 'Error running report', userFacingError: 'Bad input' } as unknown as ProcessResponse)).toEqual({ kind: 'error', message: 'Bad input' })
    initMock.mockRejectedValue(new AxiosError('Request failed with status code 403', '403', undefined, undefined,
      { status: 403, statusText: 'Forbidden', headers: {}, config: { headers: new AxiosHeaders() }, data: { error: 'Permission denied.' } }))
    expect(await startReport('reports.basic', 'restricted', 'CSV')).toEqual({ kind: 'error', message: 'Permission denied.' })
    expect(reportStateFromResponse({ processUUID: 'p', values: {} } as unknown as ProcessResponse)).toEqual({ kind: 'error', message: 'The report did not produce a file.' })
  })

  it('shows the user-facing message of a refused run the process API normalized to an ERROR', async () => {
    initMock.mockResolvedValue({ type: 'ERROR', processUUID: '', status: 403, error: 'Permission denied.', userFacingError: 'You do not have permission to run this process.' })
    expect(await startReport('reports.basic', 'restricted', 'CSV')).toEqual({ kind: 'error', message: 'You do not have permission to run this process.' })
    initMock.mockResolvedValue({ type: 'RUNNING', processUUID: 'p4', message: 'Generating Report' })
    expect(await startReport('reports.basic', 'big', 'CSV')).toMatchObject({ kind: 'running', processUUID: 'p4', message: 'Generating Report' })
  })

  it('builds the v1 streaming route for reports without a process', () => {
    expect(reportFileUrl('accStreamedReport', 'CSV', { minimumId: '2' })).toBe('/qqq/v1/reports/accStreamedReport?minimumId=2&format=csv')
  })
})
