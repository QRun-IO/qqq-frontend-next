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
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { JobProgressView, JobStatusChip } from './JobProgressView'
import { JobProgressBar } from './JobProgressBar'
import { JobPhaseStepper } from './JobPhaseStepper'
import { JobLogPanel } from './JobLogPanel'
import { JobList } from './JobList'
import { isJobTerminal, jobBytes, jobDuration } from './job-display'

const job = {
  jobId: 42,
  label: 'Back up workspace',
  status: 'RUNNING',
  startedAt: '2026-10-14T12:00:00Z',
}
const log = [
  { id: 1, level: 'INFO', message: '<script>not HTML</script>' },
  { id: 2, level: 'ERROR', message: 'Failed to upload' },
]
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('JobProgressBar', () => {
  it('eases via scaleX, clamps and never visibly decreases during the mounted attempt', () => {
    const { rerender } = render(<JobProgressBar percent={30} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '30')
    rerender(<JobProgressBar percent={20} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '30')
    expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({
      transform: 'scaleX(0.3)',
    })
    rerender(<JobProgressBar percent={110} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  })
  it('has no numeric value when indeterminate and respects static reduced motion styles', () => {
    render(<JobProgressBar percent={null} />)
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')
    expect(screen.getByRole('progressbar').firstElementChild).toHaveClass('qqq-job-shimmer')
    const css = readFileSync('src/components/jobs/jobs.css', 'utf8')
    expect(css).toContain('prefers-reduced-motion: reduce')
    expect(css).toContain('transition: none')
    expect(css).toContain('animation: none')
    expect(css).not.toMatch(/transition:\s*(width|all)|@keyframes[^}]*width:/)
  })
})

describe('phases and job states', () => {
  it('shows completed, current, pending, skipped and failed phases with textual status', () => {
    render(
      <JobPhaseStepper
        phases={['DONE', 'RUNNING', 'PENDING', 'SKIPPED', 'FAILED'].map((status) => ({
          name: status,
          label: `${status} phase`,
          status,
        }))}
      />
    )
    const items = screen.getAllByRole('listitem')
    expect(items[1]).toHaveAttribute('aria-current', 'step')
    expect(items[1].querySelector('svg')).toHaveClass('qqq-job-pulse')
    expect(items[4]).toHaveClass('text-destructive')
    expect(items).toHaveLength(5)
  })
  it('shows active and finished rows, percent, ETA, duration and empty state', () => {
    const { rerender } = render(<JobList jobs={[]} label="Active" />)
    expect(screen.getByText('No active jobs.')).toBeInTheDocument()
    rerender(
      <JobList
        label="Jobs"
        jobs={[
          { ...job, percent: 25, currentPhase: 'Upload', etaSeconds: 90 },
          { ...job, jobId: 43, status: 'FAILED', finishedAt: '2026-10-14T12:02:00Z' },
        ]}
      />
    )
    expect(screen.getByText('ETA 1m 30s')).toBeInTheDocument()
    expect(screen.getByText(/Duration 2m 0s/)).toBeInTheDocument()
    expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', '/app/jobs/42')
    expect(screen.getByText('failed')).toHaveClass('text-destructive')
  })
  it('formats bytes and durations and distinguishes review from terminal states', () => {
    expect(jobBytes(0)).toBe('0 B')
    expect(jobBytes(1024)).toBe('1 KB')
    expect(jobDuration(-1)).toBe('0s')
    expect(jobDuration(3601)).toBe('1h 0m')
    expect(isJobTerminal('NEEDS_REVIEW')).toBe(false)
    expect(isJobTerminal('COMPLETED_WITH_ERRORS')).toBe(true)
    render(<JobStatusChip status="COMPLETED_WITH_ERRORS" />)
    expect(screen.getByText('completed with errors')).toBeInTheDocument()
  })
})

describe('JobLogPanel', () => {
  it('renders log text safely, copies displayed lines and collapses', async () => {
    const copy = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: copy },
    })
    const { container } = render(<JobLogPanel lines={log} logDropped={12} />)
    expect(container.querySelector('script')).toBeNull()
    expect(screen.getByText('[INFO] <script>not HTML</script>')).toBeInTheDocument()
    expect(screen.getByText('12 earlier lines not kept')).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    })
    expect(copy).toHaveBeenCalledWith('[INFO] <script>not HTML</script>\n[ERROR] Failed to upload')
    expect(screen.getByRole('status')).toHaveTextContent('Copied')
    fireEvent.click(screen.getByRole('button', { name: 'Hide log' }))
    expect(screen.queryByRole('region', { name: 'Job log' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show log (2)' })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
  })
  it('pauses auto-scroll when the user scrolls up and resumes on Jump to latest', () => {
    const { rerender } = render(<JobLogPanel lines={log} />)
    const panel = screen.getByRole('region', { name: 'Job log' })
    Object.defineProperty(panel, 'scrollHeight', { configurable: true, value: 1000 })
    Object.defineProperty(panel, 'clientHeight', { configurable: true, value: 200 })
    panel.scrollTop = 100
    fireEvent.scroll(panel)
    rerender(<JobLogPanel lines={[...log, { id: 3, level: 'WARN', message: 'Warning' }]} />)
    expect(panel.scrollTop).toBe(100)
    fireEvent.click(screen.getByRole('button', { name: 'Jump to latest' }))
    expect(panel.scrollTop).toBe(1000)
    expect(screen.queryByRole('button', { name: 'Jump to latest' })).not.toBeInTheDocument()
  })
  it('shows empty and clipboard failure states', async () => {
    const { rerender } = render(<JobLogPanel lines={[]} />)
    expect(screen.getByText('Waiting for log messages…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy' })).toBeDisabled()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    rerender(<JobLogPanel lines={log} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    })
    expect(screen.getByRole('status')).toHaveTextContent('Could not copy')
  })
})

describe('JobProgressView', () => {
  it('shows measurements and elapsed ticking, then stops when finished', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-14T12:00:10Z'))
    const { rerender } = render(
      <JobProgressView
        job={job}
        progress={{
          percent: 25,
          done: 12,
          total: 48,
          unitLabel: 'tables',
          bytesDone: 1024,
          bytesTotal: 2048,
          etaSeconds: 30,
          message: 'Uploading',
        }}
      />
    )
    expect(screen.getByText('12 / 48 tables')).toBeInTheDocument()
    expect(screen.getByText('1 KB / 2 KB')).toBeInTheDocument()
    expect(screen.getByText('Elapsed 10s')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByText('Elapsed 11s')).toBeInTheDocument()
    rerender(
      <JobProgressView job={{ ...job, status: 'COMPLETED', finishedAt: '2026-10-14T12:00:12Z' }} />
    )
    act(() => vi.advanceTimersByTime(5000))
    expect(screen.getByText('Elapsed 12s')).toBeInTheDocument()
  })
  it('auto-backgrounds exactly once at five seconds', () => {
    vi.useFakeTimers()
    const background = vi.fn()
    render(<JobProgressView job={job} autoBackground onBackground={background} />)
    act(() => vi.advanceTimersByTime(4000))
    expect(background).not.toHaveBeenCalled()
    expect(screen.getByText('Moving to Jobs in 1s')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1000))
    expect(background).toHaveBeenCalledTimes(1)
    act(() => vi.advanceTimersByTime(5000))
    expect(background).toHaveBeenCalledTimes(1)
  })
  it('Stay cancels auto-background and completion suppresses it', () => {
    vi.useFakeTimers()
    const background = vi.fn()
    const { rerender } = render(
      <JobProgressView job={job} autoBackground onBackground={background} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }))
    act(() => vi.advanceTimersByTime(6000))
    expect(background).not.toHaveBeenCalled()
    rerender(
      <JobProgressView
        key="finished"
        job={{ ...job, status: 'COMPLETED' }}
        autoBackground
        onBackground={background}
      />
    )
    act(() => vi.advanceTimersByTime(6000))
    expect(background).not.toHaveBeenCalled()
  })
  it('confirms cancellation and renders finished retry, record and done actions', () => {
    const cancel = vi.fn(),
      retry = vi.fn(),
      done = vi.fn()
    const { rerender } = render(<JobProgressView job={job} onCancel={cancel} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(cancel).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Process' }))
    expect(cancel).toHaveBeenCalledTimes(1)
    rerender(
      <JobProgressView
        job={{ ...job, status: 'FAILED' }}
        onRetry={retry}
        onDone={done}
        recordHref="/app/jobs_job/42"
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(retry).toHaveBeenCalledOnce()
    expect(done).toHaveBeenCalledOnce()
    expect(screen.getByRole('link', { name: 'Open job record' })).toHaveAttribute(
      'href',
      '/app/jobs_job/42'
    )
    expect(screen.queryByRole('button', { name: 'Run in background' })).not.toBeInTheDocument()
  })
})
