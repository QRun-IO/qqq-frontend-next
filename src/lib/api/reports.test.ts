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

// Tests for the reports API: formats from the backend, format screens, download steps and files (#664, #727)

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./possible-values', () => ({ fetchPossibleValues: vi.fn() }))

import type { QFrontendStepMetaData, QProcessMetaData } from '@/types'
import { fetchPossibleValues } from './possible-values'
import { isDownloadStep, loadReportFormats, processDeclaresReportFormat, reportFile, reportFileUrl } from './reports'

/**
 * A process with the given screens.
 * @param steps - Its frontend steps.
 * @returns The process metadata.
 */
function processWith(steps: QFrontendStepMetaData[]): QProcessMetaData {
  return { name: 'reports.basic', label: 'Report', tableName: '', isHidden: true, iconName: '', hasPermission: true, stepFlow: 'LINEAR', minInputRecords: 0, frontendSteps: steps }
}

describe('reports API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads the output formats from the backend reportFormat source', async () => {
    vi.mocked(fetchPossibleValues).mockResolvedValue([{ id: 'XLSX', label: 'XLSX' }, { id: 'CSV', label: 'CSV' }])
    expect(await loadReportFormats()).toEqual([{ id: 'XLSX', label: 'XLSX' }, { id: 'CSV', label: 'CSV' }])
    expect(fetchPossibleValues).toHaveBeenCalledWith('reportFormat')
  })

  it('knows when the report process asks for the format on a screen', () => {
    expect(processDeclaresReportFormat(undefined)).toBe(false)
    expect(processDeclaresReportFormat(processWith([{ name: 'input', label: 'Input', components: [{ type: 'EDIT_FORM' }] }]))).toBe(false)
    expect(processDeclaresReportFormat(processWith([{ name: 'input', label: 'Input', components: [{ type: 'EDIT_FORM' }],
      formFields: [{ name: 'reportFormat', label: 'Report Format', type: 'STRING', isRequired: true, isEditable: true, isHeavy: false, isHidden: false, adornments: [] }] }]))).toBe(true)
  })

  it('recognizes the access screen that only offers the file', () => {
    expect(isDownloadStep({ name: 'accessReport', label: 'Access Report', components: [{ type: 'DOWNLOAD_FORM' }] })).toBe(true)
    expect(isDownloadStep({ name: 'output', label: 'Output', components: [{ type: 'DOWNLOAD_FORM' }, { type: 'WIDGET' }] })).toBe(false)
    expect(isDownloadStep({ name: 'empty', label: 'Empty', components: [] })).toBe(false)
  })

  it('offers the file by server path or by storage reference', () => {
    expect(reportFile({ downloadFileName: 'Owned Report - 2026.csv', serverFilePath: '/tmp/r.csv' }))
      .toEqual({ fileName: 'Owned Report - 2026.csv', url: '/qqq/v1/download/Owned%20Report%20-%202026.csv?filePath=%2Ftmp%2Fr.csv' })
    expect(reportFile({ downloadFileName: 'Stored.csv', storageTableName: 'reportStorage', storageReference: '2026/stored.csv' }))
      .toEqual({ fileName: 'Stored.csv', url: '/qqq/v1/download/Stored.csv?storageTableName=reportStorage&storageReference=2026%2Fstored.csv' })
    expect(reportFile({ downloadFileName: 'nothing.csv' })).toBeNull()
  })

  it('builds the v1 streaming route for reports without a process', () => {
    expect(reportFileUrl('accStreamedReport', 'CSV', { minimumId: '2' })).toBe('/qqq/v1/reports/accStreamedReport?minimumId=2&format=csv')
  })
})
