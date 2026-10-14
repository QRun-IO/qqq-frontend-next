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

import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cancelJob, getJob, getJobProgress, listJobs, retryJob, trackJob } from '@/lib/api/jobs'
import { useUiApiFeatureSupported } from '@/lib/api/ui-api-extensions'
import { JobsHeaderButton } from './JobsHeaderButton'
import { JobsPage } from './JobsPage'
import { JobDetailView } from './JobDetailView'
import { InlineJobProgress } from './InlineJobProgress'
import JobsPopover from './JobsPopover'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/lib/api/jobs', () => ({
  listJobs: vi.fn(),
  getJob: vi.fn(),
  getJobProgress: vi.fn(),
  trackJob: vi.fn(),
  cancelJob: vi.fn(),
  retryJob: vi.fn(),
}))
vi.mock('@/lib/api/ui-api-extensions', async (original) => ({
  ...(await original<typeof import('@/lib/api/ui-api-extensions')>()),
  useUiApiFeatureSupported: vi.fn(() => true),
}))
vi.mock('@/lib/hooks/use-realtime-channel', () => ({ useRealtimeChannel: vi.fn() }))

const running = { jobId: 42, status: 'RUNNING', label: 'Backup', percent: 25 }
const finished = { jobId: 43, status: 'FAILED', label: 'Import' }
const renderConnected = (element: React.ReactNode) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return { ...render(<QueryClientProvider client={client}>{element}</QueryClientProvider>), client }
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useUiApiFeatureSupported).mockReturnValue(true)
  vi.mocked(listJobs).mockImplementation(async (filter) => ({
    jobs: filter?.state === 'recent' ? [finished] : [running],
    activeCount: 1,
    generatedAt: 'now',
  }))
  vi.mocked(getJob).mockResolvedValue({
    ...running,
    actions: ['cancel'],
    progress: { percent: 25 },
  })
  vi.mocked(getJobProgress).mockResolvedValue({
    job: running,
    log: [],
    logDropped: 0,
    nextAfterLogId: 0,
    terminal: false,
  })
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})
afterEach(cleanup)

describe('JobsHeaderButton and JobsPopover', () => {
  it('makes no jobs calls when discovery does not advertise the feature', () => {
    vi.mocked(useUiApiFeatureSupported).mockReturnValue(false)
    renderConnected(<JobsHeaderButton />)
    expect(screen.queryByRole('button', { name: /Jobs/ })).not.toBeInTheDocument()
    expect(listJobs).not.toHaveBeenCalled()
  })
  it('shows an active badge, both lists, keyboard trap and restores focus on Escape', async () => {
    renderConnected(<JobsHeaderButton />)
    const button = await screen.findByRole('button', { name: 'Jobs, 1 active' })
    fireEvent.click(button)
    const dialog = await screen.findByRole('dialog', { name: 'Jobs' })
    expect(await screen.findByText('Import')).toBeInTheDocument()
    expect(screen.getByText('Backup')).toBeInTheDocument()
    const footer = screen.getByRole('link', { name: 'All jobs' })
    footer.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(footer).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(dialog).not.toBeInTheDocument()
    expect(button).toHaveFocus()
  })
  it('shows empty lists, closes on outside click and opens a job', () => {
    const close = vi.fn()
    const { rerender } = render(<JobsPopover jobs={[]} recent={[]} onClose={close} />)
    expect(screen.getByText('No active jobs.')).toBeInTheDocument()
    expect(screen.getByText('No recent jobs.')).toBeInTheDocument()
    fireEvent.pointerDown(document.body)
    expect(close).toHaveBeenCalledOnce()
    rerender(<JobsPopover jobs={[running]} recent={[]} onClose={close} />)
    fireEvent.click(screen.getByRole('link', { name: /Backup/ }))
    expect(close).toHaveBeenCalledTimes(2)
  })
  it('hides a refused tray', async () => {
    vi.mocked(listJobs).mockRejectedValue(
      new AxiosError('Forbidden', undefined, undefined, undefined, { status: 403 } as never)
    )
    const { client } = renderConnected(<JobsHeaderButton />)
    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect(screen.queryByRole('button', { name: /Jobs/ })).not.toBeInTheDocument()
  })
})

describe('JobsPage', () => {
  it('only offers All after scope=all succeeds and navigates tabs by keyboard', async () => {
    renderConnected(<JobsPage />)
    const all = await screen.findByRole('tab', { name: 'all' })
    fireEvent.click(all)
    await waitFor(() =>
      expect(listJobs).toHaveBeenCalledWith({ scope: 'all', state: 'all', limit: 200 })
    )
    fireEvent.keyDown(all, { key: 'Home' })
    expect(screen.getByRole('tab', { name: 'active' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(screen.getByRole('tab', { name: 'active' }), { key: 'ArrowRight' })
    await waitFor(() =>
      expect(listJobs).toHaveBeenCalledWith({ scope: 'mine', state: 'recent', limit: 200 })
    )
    expect(await screen.findByText('Import')).toBeInTheDocument()
  })
  it('hides All for non-admins without showing a permission error', async () => {
    vi.mocked(listJobs).mockImplementation(async (filter) => {
      if (filter?.scope === 'all')
        throw new AxiosError('Forbidden', undefined, undefined, undefined, { status: 403 } as never)
      return { jobs: [], activeCount: 0, generatedAt: 'now' }
    })
    const { client } = renderConnected(<JobsPage />)
    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect(screen.queryByRole('tab', { name: 'all' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('No active jobs.')).toBeInTheDocument()
  })
})

describe('connected live view', () => {
  it('tracks an inline process before leaving and sends all identifiers', async () => {
    const leave = vi.fn()
    let finish!: (value: { jobId: number }) => void
    vi.mocked(trackJob).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    renderConnected(
      <InlineJobProgress
        label="Backup"
        processName="backup"
        processUUID="p-1"
        jobUUID="j-1"
        progress={{
          message: 'Uploading',
          current: 1,
          total: 4,
          updatedAt: new Date(),
          logTail: [{ id: 1, level: 'INFO', message: 'Wrote table' }],
        }}
        onLeave={leave}
        onCancel={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Run in background' }))
    await waitFor(() =>
      expect(trackJob).toHaveBeenCalledWith({
        processName: 'backup',
        processUUID: 'p-1',
        jobUUID: 'j-1',
      })
    )
    expect(leave).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Run in background' })).toBeDisabled()
    await act(async () => finish({ jobId: 42 }))
    await waitFor(() => expect(leave).toHaveBeenCalledOnce())
  })
  it('retains a failed track attempt on screen and adapts structured phases', async () => {
    const leave = vi.fn()
    vi.mocked(trackJob).mockRejectedValue(new Error('offline'))
    renderConnected(
      <InlineJobProgress
        label="Backup"
        processName="backup"
        processUUID="p"
        jobUUID="j"
        progress={{
          updatedAt: new Date(),
          progress: {
            phases: [{ name: 'upload', label: 'Upload files', status: 'RUNNING' }],
            percent: null,
          },
        }}
        onLeave={leave}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByText('Upload files')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Run in background' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('still running here')
    expect(leave).not.toHaveBeenCalled()
  })
  it('cancels a durable job only after confirmation and can leave without tracking', async () => {
    vi.mocked(cancelJob).mockResolvedValue({ jobId: 42 })
    const leave = vi.fn()
    renderConnected(<JobDetailView jobId={42} onLeave={leave} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(cancelJob).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Process' }))
    await waitFor(() => expect(cancelJob).toHaveBeenCalledWith(42))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Run in background' })).toBeEnabled()
    )
    fireEvent.click(screen.getByRole('button', { name: 'Run in background' }))
    expect(leave).toHaveBeenCalledOnce()
    expect(trackJob).not.toHaveBeenCalled()
  })
  it('retries failed jobs and opens the returned id', async () => {
    vi.mocked(getJob).mockResolvedValue({ ...finished, actions: ['retry'] })
    vi.mocked(getJobProgress).mockResolvedValue({
      job: finished,
      log: [],
      logDropped: 0,
      nextAfterLogId: 0,
      terminal: true,
    })
    vi.mocked(retryJob).mockResolvedValue({ jobId: 99 })
    renderConnected(<JobDetailView jobId={43} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(retryJob).toHaveBeenCalledWith(43))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/app/jobs/99'))
  })
  it('shows a recoverable detail failure', async () => {
    vi.mocked(getJob).mockRejectedValue(new Error('offline'))
    renderConnected(<JobDetailView jobId={42} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load this job')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(getJob).toHaveBeenCalledTimes(2))
  })
})
