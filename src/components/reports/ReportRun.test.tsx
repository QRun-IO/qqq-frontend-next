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

// Tests for ReportRun (#664)

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/lib/api/reports', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api/reports')>()
  return { ...original, startReport: vi.fn(), submitReportInputs: vi.fn(), pollReport: vi.fn() }
})

import type { QReportMetaData } from '@/types'
import { startReport, submitReportInputs } from '@/lib/api/reports'
import { ReportRun } from './ReportRun'

const report: QReportMetaData = { name: 'accPersonReport', label: 'Owned Person Report', isHidden: false, hasPermission: true, processName: 'reports.basic' }

describe('ReportRun', () => {
  beforeEach(() => vi.clearAllMocks())

  it('runs the report in the chosen format and offers the file', async () => {
    const user = userEvent.setup()
    vi.mocked(startReport).mockResolvedValue({ kind: 'done', processUUID: 'p', fileName: 'Owned Person Report.xlsx', downloadUrl: '/download/x?filePath=y' })
    render(<ReportRun reportName="accPersonReport" reportMetaData={report} />)
    expect(screen.getByLabelText('Output format')).toHaveValue('CSV')
    await user.selectOptions(screen.getByLabelText('Output format'), 'XLSX')
    await user.click(screen.getByRole('button', { name: 'Run Report' }))
    expect(startReport).toHaveBeenCalledWith('reports.basic', 'accPersonReport', 'XLSX')
    const link = await screen.findByRole('link', { name: 'Download Owned Person Report.xlsx' })
    expect(link).toHaveAttribute('href', '/download/x?filePath=y')
    expect(link).toHaveAttribute('download', 'Owned Person Report.xlsx')
  })

  it('asks for required inputs before generating', async () => {
    const user = userEvent.setup()
    vi.mocked(startReport).mockResolvedValue({ kind: 'input', processUUID: 'p2', inputFields: [{ name: 'minimumId', label: 'Minimum Id', type: 'INTEGER', isRequired: true } as never] })
    vi.mocked(submitReportInputs).mockResolvedValue({ kind: 'done', processUUID: 'p2', fileName: 'r.csv', downloadUrl: '/download/r.csv?filePath=z' })
    render(<ReportRun reportName="accPersonInputReport" reportMetaData={{ ...report, name: 'accPersonInputReport' }} />)
    await user.click(screen.getByRole('button', { name: 'Run Report' }))
    const input = await screen.findByLabelText(/Minimum Id/)
    await user.click(screen.getByRole('button', { name: 'Generate Report' }))
    expect(screen.getByText('Minimum Id is required.')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(submitReportInputs).not.toHaveBeenCalled()
    await user.type(input, '3')
    await user.click(screen.getByRole('button', { name: 'Generate Report' }))
    expect(submitReportInputs).toHaveBeenCalledWith('reports.basic', 'p2', { reportName: 'accPersonInputReport', reportFormat: 'CSV', minimumId: 3 })
    expect(await screen.findByRole('link', { name: 'Download r.csv' })).toBeInTheDocument()
  })

  it('shows backend errors, and no run control without permission', async () => {
    const user = userEvent.setup()
    vi.mocked(startReport).mockResolvedValue({ kind: 'error', message: 'Permission denied.' })
    const { unmount } = render(<ReportRun reportName="accPersonReport" reportMetaData={report} />)
    await user.click(screen.getByRole('button', { name: 'Run Report' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Permission denied.')
    unmount()
    render(<ReportRun reportName="x" reportMetaData={{ ...report, hasPermission: false }} />)
    expect(screen.getByText('You do not have permission to run this report.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Run Report' })).toBeNull()
  })

  it('links the streaming route for a report without a process', async () => {
    const user = userEvent.setup()
    render(<ReportRun reportName="accStreamedReport" reportMetaData={{ ...report, name: 'accStreamedReport', processName: undefined }} />)
    await user.click(screen.getByRole('button', { name: 'Run Report' }))
    expect(screen.getByRole('link', { name: /^Download / })).toHaveAttribute('href', expect.stringMatching(/\/reports\/accStreamedReport\?format=csv$/))
    expect(startReport).not.toHaveBeenCalled()
  })
})
