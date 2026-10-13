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

// Tests for ReportRun: formats from the backend, the report process's screens, files (#664, #727)

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/lib/api/processes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/processes')>()),
  processInit: vi.fn(),
  processStep: vi.fn(),
  processStatus: vi.fn(),
  processCancel: vi.fn().mockResolvedValue(true),
}))
vi.mock('@/lib/api/metadata', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/metadata')>()),
  loadProcessMetaData: vi.fn(),
  loadMetaData: vi.fn().mockResolvedValue({ widgets: {} }),
}))
vi.mock('@/lib/api/possible-values', () => ({
  fetchPossibleValues: vi.fn(),
  fetchProcessPossibleValues: vi.fn().mockResolvedValue([]),
  fetchTablePossibleValues: vi.fn().mockResolvedValue([]),
}))

import type { QFieldMetaData, QProcessMetaData, QReportMetaData } from '@/types'
import { processInit, processStep, processCancel } from '@/lib/api/processes'
import { loadProcessMetaData } from '@/lib/api/metadata'
import { fetchPossibleValues } from '@/lib/api/possible-values'
import { ReportRun } from './ReportRun'

const report: QReportMetaData = { name: 'accPersonReport', label: 'Owned Person Report', isHidden: false, hasPermission: true, processName: 'reports.basic' }

/**
 * Field metadata.
 * @param name - Name.
 * @param label - Label.
 * @param extra - Overrides.
 * @returns The field.
 */
function field(name: string, label: string, extra: Partial<QFieldMetaData> = {}): QFieldMetaData {
  return { name, label, type: 'STRING', isRequired: false, isEditable: true, isHeavy: false, isHidden: false, adornments: [], ...extra }
}

const basic: QProcessMetaData = {
  name: 'reports.basic', label: 'Report', tableName: '', isHidden: true, iconName: '', hasPermission: true, stepFlow: 'LINEAR', minInputRecords: 0,
  frontendSteps: [
    { name: 'input', label: 'Input', components: [{ type: 'EDIT_FORM' }] },
    { name: 'accessReport', label: 'Access Report', components: [{ type: 'DOWNLOAD_FORM' }] },
  ],
}

/**
 * Render the runner.
 * @param meta - Report metadata.
 */
function renderRun(meta: QReportMetaData = report) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><ReportRun reportName={meta.name} reportMetaData={meta} /></QueryClientProvider>)
}

describe('ReportRun', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadProcessMetaData).mockResolvedValue(basic)
    vi.mocked(fetchPossibleValues).mockResolvedValue([{ id: 'XLSX', label: 'XLSX' }, { id: 'CSV', label: 'CSV' }, { id: 'JSON', label: 'JSON' }])
  })

  it('offers the backend formats and runs the report in the chosen one', async () => {
    const user = userEvent.setup()
    vi.mocked(processInit).mockResolvedValue({ type: 'COMPLETE', processUUID: 'p', nextStep: 'accessReport', values: { downloadFileName: 'Owned Person Report.csv', serverFilePath: '/tmp/r.csv' } })
    renderRun()
    const select = await screen.findByLabelText('Output format')
    expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual(['XLSX', 'CSV', 'JSON'])
    expect(select).toHaveValue('XLSX')
    await user.selectOptions(select, 'CSV')
    await user.click(screen.getByRole('button', { name: 'Run Report' }))
    await waitFor(() => expect(processInit).toHaveBeenCalledWith('reports.basic', { values: { reportName: 'accPersonReport', reportFormat: 'CSV' } }))
    const link = await screen.findByRole('link', { name: 'Download Owned Person Report.csv' })
    expect(link).toHaveAttribute('href', '/qqq/v1/download/Owned%20Person%20Report.csv?filePath=%2Ftmp%2Fr.csv')
    expect(screen.getByRole('status')).toHaveTextContent('Report complete')
  })

  it('asks for the report inputs in the dynamic form, possible values and booleans included', async () => {
    const user = userEvent.setup()
    vi.mocked(processInit).mockResolvedValue({ type: 'COMPLETE', processUUID: 'p2', nextStep: 'input', values: { inputFieldList: [
      field('minimumId', 'Minimum Id', { type: 'INTEGER', isRequired: true }),
      field('includeRetired', 'Include Retired', { type: 'BOOLEAN' }),
      field('speciesId', 'Species', { type: 'INTEGER', possibleValueSourceName: 'petSpecies' }),
    ] } })
    vi.mocked(processStep).mockResolvedValue({ type: 'COMPLETE', processUUID: 'p2', nextStep: 'accessReport', values: { downloadFileName: 'r.xlsx', serverFilePath: '/tmp/r.xlsx' } })
    renderRun({ ...report, name: 'accPersonInputReport' })
    await user.click(await screen.findByRole('button', { name: 'Run Report' }))
    const form = await screen.findByRole('form', { name: 'Input' })
    expect(within(form).getByRole('checkbox', { name: 'Include Retired' })).toBeInTheDocument()
    expect(within(form).getByRole('combobox', { name: /Species/ })).toBeInTheDocument()
    await user.click(within(form).getByRole('button', { name: 'Generate Report' }))
    expect(await within(form).findByText('Minimum Id is required')).toBeInTheDocument()
    expect(processStep).not.toHaveBeenCalled()
    await user.type(within(form).getByLabelText(/Minimum Id/), '3')
    await user.click(within(form).getByRole('checkbox', { name: 'Include Retired' }))
    await user.click(within(form).getByRole('button', { name: 'Generate Report' }))
    await waitFor(() => expect(processStep).toHaveBeenCalledWith('reports.basic', 'p2', 'input', expect.objectContaining({
      values: expect.objectContaining({ minimumId: 3, includeRetired: true }),
    })))
    expect(await screen.findByRole('link', { name: 'Download r.xlsx' })).toBeInTheDocument()
  })

  it('cancels the compact input form without submitting its required fields', async () => {
    const user = userEvent.setup()
    vi.mocked(processInit).mockResolvedValue({ type: 'COMPLETE', processUUID: 'cancel-report', nextStep: 'input', values: {
      inputFieldList: [field('minimumId', 'Minimum Id', { type: 'INTEGER', isRequired: true })],
    } })
    renderRun()
    await user.click(await screen.findByRole('button', { name: 'Run Report' }))
    const form = await screen.findByRole('form', { name: 'Input' })
    expect(within(form).getByRole('button', { name: 'Generate Report' })).toBeInTheDocument()
    await user.click(within(form).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Input' })).toBeNull())
    expect(processCancel).toHaveBeenCalledWith('reports.basic', 'cancel-report', undefined)
    expect(processStep).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Run Report' })).toBeEnabled()
  })

  it('keeps step navigation for a report with another screen after its inputs', async () => {
    const user = userEvent.setup()
    vi.mocked(loadProcessMetaData).mockResolvedValue({ ...basic, frontendSteps: [
      basic.frontendSteps[0],
      { name: 'confirm', label: 'Confirm', components: [{ type: 'HELP_TEXT', values: { text: 'Check the choices' } }] },
      basic.frontendSteps[1],
    ] })
    vi.mocked(processInit).mockResolvedValue({ type: 'COMPLETE', processUUID: 'long-report', nextStep: 'input', values: {
      inputFieldList: [field('minimumId', 'Minimum Id', { type: 'INTEGER' })],
    } })
    renderRun()
    await user.click(await screen.findByRole('button', { name: 'Run Report' }))
    const form = await screen.findByRole('form', { name: 'Input' })
    expect(within(form).getByText('Step 1 of 3')).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Next' })).toBeInTheDocument()
    expect(within(form).queryByRole('button', { name: 'Generate Report' })).toBeNull()
  })

  it('shows the other screens a report process asks for, then a stored file', async () => {
    const user = userEvent.setup()
    vi.mocked(loadProcessMetaData).mockResolvedValue({ ...basic, name: 'accStoredReportProcess', frontendSteps: [
      { name: 'confirm', label: 'Confirm', components: [{ type: 'HELP_TEXT', values: { text: 'Check the choices' } }, { type: 'EDIT_FORM' }], formFields: [field('note', 'Note')] },
      { name: 'accessReport', label: 'Access Report', components: [{ type: 'DOWNLOAD_FORM' }] },
    ] })
    vi.mocked(processInit).mockResolvedValue({ type: 'COMPLETE', processUUID: 'p3', nextStep: 'confirm', values: {} })
    vi.mocked(processStep).mockResolvedValue({ type: 'COMPLETE', processUUID: 'p3', nextStep: 'accessReport', values: {
      downloadFileName: 'Stored.csv', storageTableName: 'reportStorage', storageReference: 'a/b.csv',
    } })
    renderRun({ ...report, name: 'accStoredReport', processName: 'accStoredReportProcess' })
    await user.click(await screen.findByRole('button', { name: 'Run Report' }))
    const form = await screen.findByRole('form', { name: 'Confirm' })
    expect(within(form).getByText('Check the choices')).toBeInTheDocument()
    await user.type(within(form).getByLabelText('Note'), 'checked')
    await user.click(within(form).getByRole('button', { name: 'Submit' }))
    const link = await screen.findByRole('link', { name: 'Download Stored.csv' })
    expect(link).toHaveAttribute('href', '/qqq/v1/download/Stored.csv?storageTableName=reportStorage&storageReference=a%2Fb.csv')
    expect(processStep).toHaveBeenCalledWith('accStoredReportProcess', 'p3', 'confirm', expect.objectContaining({ values: { note: 'checked' } }))
  })

  it('leaves the format to a report process screen that asks for it', async () => {
    vi.mocked(loadProcessMetaData).mockResolvedValue({ ...basic, frontendSteps: [
      { name: 'input', label: 'Input', components: [{ type: 'EDIT_FORM' }], formFields: [field('reportFormat', 'Report Format', { possibleValueSourceName: 'reportFormat' })] },
    ] })
    renderRun()
    const run = await screen.findByRole('button', { name: 'Run Report' })
    await waitFor(() => expect(run).toBeEnabled())
    expect(screen.queryByLabelText('Output format')).toBeNull()
    expect(fetchPossibleValues).not.toHaveBeenCalled()
  })

  it('shows backend errors, and no run control without permission', async () => {
    const user = userEvent.setup()
    vi.mocked(processInit).mockResolvedValue({ type: 'ERROR', processUUID: '', status: 403, error: 'Permission denied.', userFacingError: 'You do not have permission to run this process.' })
    renderRun()
    await user.click(await screen.findByRole('button', { name: 'Run Report' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission to run this process.')
    renderRun({ ...report, name: 'x', hasPermission: false })
    expect(screen.getByText('You do not have permission to run this report.')).toBeInTheDocument()
  })

  it('links the streaming route for a report without a process', async () => {
    const user = userEvent.setup()
    renderRun({ ...report, name: 'accStreamedReport', processName: undefined })
    await user.selectOptions(await screen.findByLabelText('Output format'), 'CSV')
    await user.click(screen.getByRole('button', { name: 'Run Report' }))
    expect(screen.getByRole('link', { name: /^Download / })).toHaveAttribute('href', expect.stringMatching(/\/reports\/accStreamedReport\?format=csv$/))
    expect(processInit).not.toHaveBeenCalled()
  })
})
