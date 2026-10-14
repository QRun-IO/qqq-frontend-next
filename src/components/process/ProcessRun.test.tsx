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

// Tests for ProcessRun's completion callback (the record picker's upload-and-select)

import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'

import type { QFrontendStepMetaData, QProcessMetaData } from '@/types'
import type { ProcessRunProps } from './ProcessRun'
import { processJob } from '@/lib/api/processes'

const processState: { current: {
  phase: string; values: Record<string, unknown>; steps: QFrontendStepMetaData[]; screenInstance: number
  currentStep?: QFrontendStepMetaData; processUUID?: string; backStep?: string | null
} } = { current: { phase: 'step', values: {}, steps: [], screenInstance: 1 } }
const { push } = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/lib/api/processes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/processes')>()),
  processJob: vi.fn(),
}))
vi.mock('@/lib/api/metadata', () => ({ loadMetaData: vi.fn().mockResolvedValue({ apps: {}, appTree: [] }) }))
vi.mock('@/lib/hooks/use-metadata', () => ({ useTableMetaData: () => ({ data: undefined }) }))
vi.mock('@/lib/hooks/use-process', () => ({
  useProcess: () => ({ state: processState.current, start: vi.fn(), submit: vi.fn(), back: vi.fn(), cancel: vi.fn() }),
}))

vi.mock('@/components/jobs/JobDetailView', () => ({ JobDetailView: ({ jobId }: { jobId: number }) => <div data-testid="durable-live">{jobId}</div> }))

import { ProcessRun } from './ProcessRun'

const PROCESS = { name: 'uploadImage', label: 'Upload image', tableName: 'media', stepFlow: 'LINEAR', frontendSteps: [] } as unknown as QProcessMetaData

/**
 * Render an embedded run with a completion callback.
 * @param onComplete - The callback.
 * @returns The rerender function.
 */
function renderRun(onComplete: (values: Record<string, unknown>) => void) {
  const client = new QueryClient()
  const view = () => (
    <QueryClientProvider client={client}>
      <ProcessRun processName="uploadImage" processMetaData={PROCESS} isEmbedded onComplete={onComplete} />
    </QueryClientProvider>
  )
  const result = render(view())
  return () => result.rerender(view())
}

describe('ProcessRun onComplete', () => {
  it('reports the final values once, when the run completes', () => {
    const onComplete = vi.fn()
    processState.current = { phase: 'step', values: {}, steps: [], screenInstance: 1 }
    const rerender = renderRun(onComplete)
    expect(onComplete).not.toHaveBeenCalled()

    processState.current = { phase: 'complete', values: { mediaId: 42 }, steps: [], screenInstance: 2 }
    rerender()
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith({ mediaId: 42 })

    rerender()
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})

const review: QFrontendStepMetaData = { name: 'confirm', label: 'Confirm', components: [{ type: 'EDIT_FORM' }], formFields: [
  { name: 'note', label: 'Note', type: 'STRING', isEditable: true, isRequired: false, isHidden: false, isHeavy: false, adornments: [] },
] }
const resultStep: QFrontendStepMetaData = { name: 'result', label: 'Result', components: [{ type: 'PROCESS_SUMMARY_RESULTS' }] }
const backgroundProcess: QProcessMetaData = { ...PROCESS, name: 'genericProcess', label: 'Generic process', tableName: '', hasPermission: true, durableJobEligible: true, frontendSteps: [review, resultStep] }

/**
 * Render a process using the real screen and summary components.
 * @param props - Launch inputs or metadata overrides.
 * @returns The rendered view.
 */
function renderBackgroundRun(props: Partial<ProcessRunProps> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><ProcessRun processName="genericProcess" processMetaData={backgroundProcess} {...props} /></QueryClientProvider>)
}

describe('ProcessRun durable jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(processJob).mockResolvedValue({ jobId: 42, status: 'QUEUED' })
    processState.current = { phase: 'step', values: { collected: 'earlier', note: 'old' }, steps: [review, resultStep], currentStep: review, processUUID: 'run-1', backStep: null, screenInstance: 1 }
  })

  it('posts collected and current inputs with the original record ids and navigates to the record', async () => {
    renderBackgroundRun({ initialRequest: { values: { preset: true }, recordsParam: 'recordIds', recordIds: '7, item-two' } })
    const user = userEvent.setup()
    await user.clear(screen.getByLabelText('Note'))
    await user.type(screen.getByLabelText('Note'), 'edited')
    await user.click(screen.getByRole('button', { name: 'Run in background' }))
    await waitFor(() => expect(processJob).toHaveBeenCalledWith('genericProcess', {
      values: { preset: true, collected: 'earlier', note: 'edited' }, recordIds: ['7', 'item-two'], startAfterStep: 'confirm', label: 'Generic process',
    }))
    expect(push).toHaveBeenCalledWith('/app/jobs/42')
  })

  it('posts the original filter as JSON instead of record ids, including in an embedded run', async () => {
    const filter = { criteria: [{ fieldName: 'state', operator: 'EQUALS', values: ['ready'] }], subFilters: [], booleanOperator: 'AND', orderBys: [] }
    renderBackgroundRun({ isEmbedded: true, initialRequest: { recordsParam: 'filterJSON', filterJSON: JSON.stringify(filter), recordIds: 'ignored' } })
    await userEvent.click(screen.getByRole('button', { name: 'Run in background' }))
    await waitFor(() => expect(processJob).toHaveBeenCalledWith('genericProcess', {
      values: { collected: 'earlier', note: 'old' }, filter, startAfterStep: 'confirm', label: 'Generic process',
    }))
    expect(push).toHaveBeenCalledWith('/app/jobs/42')
  })

  it.each([400, 403, 404, 429])('shows the server error on HTTP %s and keeps inputs for retry', async (status) => {
    const config = { headers: new AxiosHeaders() }
    vi.mocked(processJob).mockRejectedValueOnce(new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, {}, {
      status, statusText: '', headers: {}, config, data: { error: 'Too many queued jobs. Try again later.' },
    }))
    renderBackgroundRun()
    await userEvent.click(screen.getByRole('button', { name: 'Run in background' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many queued jobs. Try again later.')
    expect(screen.getByLabelText('Note')).toHaveValue('old')
    expect(screen.getByRole('button', { name: 'Run in background' })).toBeEnabled()
    expect(push).not.toHaveBeenCalled()
  })

  it.each(['step', 'complete'])('shows a live durable job for a %s response', (phase) => {
    processState.current = { ...processState.current, phase, values: { durableJobId: 42 } }
    renderBackgroundRun()
    expect(screen.getByTestId('durable-live')).toHaveTextContent('42')
  })

  it('disables both submit actions while the job request is pending', async () => {
    let resolveJob!: (value: { jobId: number; status: string }) => void
    vi.mocked(processJob).mockImplementationOnce(() => new Promise((resolve) => { resolveJob = resolve }))
    renderBackgroundRun()
    await userEvent.click(screen.getByRole('button', { name: 'Run in background' }))
    expect(screen.getByRole('button', { name: 'Run in background' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Run in background' }))
    expect(processJob).toHaveBeenCalledTimes(1)
    resolveJob({ jobId: 42, status: 'QUEUED' })
    await waitFor(() => expect(push).toHaveBeenCalledWith('/app/jobs/42'))
  })

  it('does not show a background banner for an ordinary process response', () => {
    renderBackgroundRun()
    expect(screen.queryByRole('region', { name: 'Page banner' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open job' })).not.toBeInTheDocument()
  })
})
