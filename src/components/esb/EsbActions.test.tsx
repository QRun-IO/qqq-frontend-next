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

// Tests for the ESB management actions

import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EsbCapabilities, EsbPermissions } from '@/types'
import { processInit, processStatus } from '@/lib/api/processes'
import { orderEsb } from '@/mocks/fixtures/esb'
import {
  EsbQueueActions,
  EsbTriggerActions,
  destinationQueue,
  type EsbQueueRef,
} from './EsbActions'

vi.mock('@/lib/api/processes', () => ({ processInit: vi.fn(), processStatus: vi.fn() }))
vi.mock('sonner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('sonner')>()),
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() },
}))

const [fulfillTrigger, cancelTrigger] = orderEsb.subscribers
const orderFulfillment = orderEsb.publications[1].destination

const NONE: EsbPermissions = { canOperate: false, canDelete: false }
const ALL: EsbPermissions = { canOperate: true, canDelete: true }
const NO_CAPABILITIES: EsbCapabilities = {
  browse: false,
  pauseQueue: false,
  purge: false,
  deleteSelected: false,
  deleteOlderThan: false,
  move: false,
}

/**
 * Renders a component inside a fresh query client.
 *
 * @param ui - The element to render.
 */
function renderWithClient(ui: React.ReactElement): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

/**
 * The broker queue behind the `orderFulfillment` destination.
 *
 * @returns Its queue reference.
 */
function fulfillmentQueue(): EsbQueueRef {
  const queue = destinationQueue(orderFulfillment)
  if (!queue) throw new Error('orderFulfillment is a queue')
  return queue
}

describe('EsbActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(processInit).mockResolvedValue({
      type: 'COMPLETE',
      processUUID: 'uuid',
      values: { count: 1, message: 'Done.' },
    })
  })

  it('shows no actions without esbOperate or esbDelete', () => {
    renderWithClient(
      <>
        <EsbTriggerActions trigger={fulfillTrigger} permissions={NONE} />
        <EsbQueueActions queue={fulfillmentQueue()} permissions={NONE} />
      </>
    )
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('shows no queue actions the broker does not support', () => {
    renderWithClient(
      <EsbQueueActions
        queue={{ ...fulfillmentQueue(), capabilities: NO_CAPABILITIES }}
        permissions={ALL}
      />
    )
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('needs esbOperate for pausing a queue and esbDelete for purging and deleting', () => {
    const { unmount } = render(
      <QueryClientProvider client={new QueryClient()}>
        <EsbQueueActions
          queue={fulfillmentQueue()}
          permissions={{ canOperate: true, canDelete: false }}
        />
      </QueryClientProvider>
    )
    expect(screen.getByRole('button', { name: 'Pause queue orderFulfillment' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Purge orderFulfillment' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Delete older messages in orderFulfillment' })
    ).not.toBeInTheDocument()
    unmount()

    renderWithClient(
      <EsbQueueActions
        queue={fulfillmentQueue()}
        permissions={{ canOperate: false, canDelete: true }}
      />
    )
    expect(
      screen.queryByRole('button', { name: 'Pause queue orderFulfillment' })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Purge orderFulfillment' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Delete older messages in orderFulfillment' })
    ).toBeInTheDocument()
  })

  it('offers resume instead of pause for a paused queue', () => {
    renderWithClient(
      <EsbQueueActions queue={{ ...fulfillmentQueue(), paused: true }} permissions={ALL} />
    )
    expect(
      screen.getByRole('button', { name: 'Resume queue orderFulfillment' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Pause queue orderFulfillment' })
    ).not.toBeInTheDocument()
  })

  it('offers pause for a running trigger and resume for a paused one', () => {
    renderWithClient(
      <>
        <EsbTriggerActions trigger={fulfillTrigger} permissions={ALL} />
        <EsbTriggerActions trigger={cancelTrigger} permissions={ALL} />
      </>
    )
    expect(screen.getByRole('button', { name: 'Pause Fulfill Order' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resume Cancel Order' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Restart/ })).toHaveLength(2)
  })

  it('pauses a trigger with esbPauseTrigger', async () => {
    const user = userEvent.setup()
    renderWithClient(<EsbTriggerActions trigger={fulfillTrigger} permissions={ALL} />)
    await user.click(screen.getByRole('button', { name: 'Pause Fulfill Order' }))
    await waitFor(() =>
      expect(processInit).toHaveBeenCalledWith('esbPauseTrigger', {
        values: { triggerName: 'fulfillOrder.orderFulfillment' },
      })
    )
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Done.'))
  })

  it.each([1, null])('confirms replay-all with a safe count of %s', async (count) => {
    const user = userEvent.setup()
    renderWithClient(
      <EsbTriggerActions
        trigger={{
          ...fulfillTrigger,
          deadLetter: { ...fulfillTrigger.deadLetter, messageCount: count },
        }}
        permissions={ALL}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Replay dead letters for Fulfill Order' }))
    let dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('orderFulfillment.dlq')
    expect(dialog).toHaveTextContent(
      count === null ? 'all dead letters (count unknown)' : '1 message'
    )
    expect(processInit).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(processInit).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Replay dead letters for Fulfill Order' }))
    dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Replay dead letters' }))
    await waitFor(() =>
      expect(processInit).toHaveBeenCalledWith('esbReplayDeadLetters', {
        values: { triggerName: 'fulfillOrder.orderFulfillment', all: true },
      })
    )
  })

  it('does not purge until the dialog naming the queue and message count is confirmed', async () => {
    const user = userEvent.setup()
    renderWithClient(<EsbQueueActions queue={fulfillmentQueue()} permissions={ALL} />)

    await user.click(screen.getByRole('button', { name: 'Purge orderFulfillment' }))
    let dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('orderFulfillment')
    expect(dialog).toHaveTextContent('7 messages')
    expect(processInit).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(processInit).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Purge orderFulfillment' }))
    dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Purge queue' }))
    await waitFor(() =>
      expect(processInit).toHaveBeenCalledWith('esbPurgeQueue', {
        values: { providerName: 'artemis', brokerQueueName: 'orderFulfillment' },
      })
    )
  })

  it('deletes messages older than the chosen time after confirmation', async () => {
    const user = userEvent.setup()
    renderWithClient(<EsbQueueActions queue={fulfillmentQueue()} permissions={ALL} />)

    await user.click(
      screen.getByRole('button', { name: 'Delete older messages in orderFulfillment' })
    )
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('orderFulfillment')
    expect(dialog).toHaveTextContent('7 messages')
    const confirm = within(dialog).getByRole('button', { name: 'Delete messages' })
    expect(confirm).toBeDisabled()

    await user.type(within(dialog).getByLabelText('Older than'), '2026-09-25T10:00')
    await user.click(confirm)
    await waitFor(() =>
      expect(processInit).toHaveBeenCalledWith('esbDeleteMessages', {
        values: {
          providerName: 'artemis',
          brokerQueueName: 'orderFulfillment',
          olderThan: new Date('2026-09-25T10:00').toISOString(),
        },
      })
    )
  })

  it('pauses a broker queue with esbPauseQueue', async () => {
    const user = userEvent.setup()
    renderWithClient(<EsbQueueActions queue={fulfillmentQueue()} permissions={ALL} />)
    await user.click(screen.getByRole('button', { name: 'Pause queue orderFulfillment' }))
    await waitFor(() =>
      expect(processInit).toHaveBeenCalledWith('esbPauseQueue', {
        values: { providerName: 'artemis', brokerQueueName: 'orderFulfillment' },
      })
    )
  })

  it('shows the process error when an action fails', async () => {
    vi.mocked(processInit).mockResolvedValue({ type: 'ERROR', error: 'Broker unavailable' })
    const user = userEvent.setup()
    renderWithClient(<EsbTriggerActions trigger={fulfillTrigger} permissions={ALL} />)
    await user.click(screen.getByRole('button', { name: 'Restart Fulfill Order' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Broker unavailable'))
  })

  it.each([
    ['Resume Cancel Order', 'esbResumeTrigger', 'cancelOrder.orderEvents'],
    ['Restart Fulfill Order', 'esbRestartTrigger', 'fulfillOrder.orderFulfillment'],
  ])('sends the exact trigger input for %s', async (label, processName, triggerName) => {
    const user = userEvent.setup()
    renderWithClient(
      <EsbTriggerActions
        trigger={triggerName === cancelTrigger.name ? cancelTrigger : fulfillTrigger}
        permissions={ALL}
      />
    )
    await user.click(screen.getByRole('button', { name: label }))
    await waitFor(() =>
      expect(processInit).toHaveBeenCalledWith(processName, { values: { triggerName } })
    )
  })

  it('sends provider and broker queue when resuming delivery', async () => {
    const user = userEvent.setup()
    renderWithClient(
      <EsbQueueActions queue={{ ...fulfillmentQueue(), paused: true }} permissions={ALL} />
    )
    await user.click(screen.getByRole('button', { name: 'Resume queue orderFulfillment' }))
    await waitFor(() =>
      expect(processInit).toHaveBeenCalledWith('esbResumeQueue', {
        values: { providerName: 'artemis', brokerQueueName: 'orderFulfillment' },
      })
    )
  })

  it('hides replay for an empty dead-letter queue and pause when queue state is unknown', () => {
    renderWithClient(
      <>
        <EsbTriggerActions
          trigger={{
            ...fulfillTrigger,
            deadLetter: { ...fulfillTrigger.deadLetter, messageCount: 0 },
          }}
          permissions={ALL}
        />
        <EsbQueueActions queue={{ ...fulfillmentQueue(), paused: null }} permissions={ALL} />
      </>
    )
    expect(screen.queryByRole('button', { name: /Replay/ })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Pause queue|Resume queue/ })
    ).not.toBeInTheDocument()
  })

  it.each(['COMPLETE', 'ERROR'] as const)(
    'keeps controls pending and reports only the final async %s outcome',
    async (type) => {
      vi.mocked(processInit).mockResolvedValue({
        type: 'JOB_STARTED',
        processUUID: 'uuid',
        jobUUID: 'job',
      })
      vi.mocked(processStatus).mockResolvedValue(
        type === 'COMPLETE'
          ? { type, processUUID: 'uuid', values: { message: 'Restarted 2 consumers.', count: 2 } }
          : { type, error: 'Restart failed.' }
      )
      const user = userEvent.setup()
      renderWithClient(<EsbTriggerActions trigger={fulfillTrigger} permissions={ALL} />)
      await user.click(screen.getByRole('button', { name: 'Restart Fulfill Order' }))
      expect(screen.getByRole('button', { name: 'Restart Fulfill Order' })).toBeDisabled()
      expect(toast.success).not.toHaveBeenCalled()
      expect(toast.error).not.toHaveBeenCalled()
      await waitFor(
        () =>
          expect(type === 'COMPLETE' ? toast.success : toast.error).toHaveBeenCalledWith(
            type === 'COMPLETE' ? 'Restarted 2 consumers.' : 'Restart failed.'
          ),
        { timeout: 2500 }
      )
      expect(type === 'COMPLETE' ? toast.error : toast.success).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Restart Fulfill Order' })).toBeEnabled()
    }
  )

  it('treats a topic as having no broker queue', () => {
    expect(destinationQueue(orderEsb.publications[0].destination)).toBeNull()
  })
})
