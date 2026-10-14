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

import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AssistantRun } from './use-assistant-engine'
import { AssistantRunStatus } from './AssistantRunStatus'

afterEach(() => vi.useRealTimers())

describe('AssistantRunStatus', () => {
  it('ticks elapsed time without changing the polite announcement until the phase changes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-14T12:00:00Z'))
    const run: AssistantRun = { key: 1, conversationId: 4, assistantMessageId: 11, turnId: null, status: 'running', phase: 'starting', startedAt: new Date().toISOString() }
    const { rerender, container } = render(<AssistantRunStatus run={run} />)
    expect(screen.getByText('Starting...')).toBeInTheDocument()
    rerender(<AssistantRunStatus run={{ ...run, phase: 'thinking' }} />)
    act(() => vi.advanceTimersByTime(7000))
    expect(screen.getByText('Thinking...')).toBeInTheDocument()
    expect(screen.getByText('0:07')).toBeInTheDocument()
    expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent(/^Thinking\.\.\.$/)
    rerender(<AssistantRunStatus run={{ ...run, phase: 'tool', toolLabel: 'Search records' }} />)
    act(() => vi.advanceTimersByTime(14000))
    expect(screen.getByText('Using Search records...')).toBeInTheDocument()
    expect(screen.getByText('0:21')).toBeInTheDocument()
    rerender(<AssistantRunStatus run={{ ...run, phase: 'writing' }} />)
    act(() => vi.advanceTimersByTime(9000))
    expect(screen.getByText('Writing...')).toBeInTheDocument()
    expect(screen.getByText('0:30')).toBeInTheDocument()
    rerender(<AssistantRunStatus run={{ ...run, status: 'cancelling' }} />)
    expect(screen.getByText('Stopping...')).toBeInTheDocument()
  })
})
