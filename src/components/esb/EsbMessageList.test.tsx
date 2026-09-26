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

// Tests for browsing ESB messages and acting on selected ones

import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EsbPermissions } from '@/types'
import { processInit } from '@/lib/api/processes'
import { orderEsb, orderFulfillmentMessages } from '@/mocks/fixtures/esb'
import { server } from '@/mocks/node'
import { deadLetterQueue, destinationQueue, type EsbQueueRef } from './EsbActions'
import { EsbBrowseButton, EsbMessageList, type EsbMessageSource } from './EsbMessageList'

vi.mock('@/lib/api/processes', () => ({ processInit: vi.fn() }))

const fulfillTrigger = orderEsb.subscribers[0]
const ALL: EsbPermissions = { canOperate: true, canDelete: true }
const NONE: EsbPermissions = { canOperate: false, canDelete: false }
const QUEUE_SOURCE: EsbMessageSource = { kind: 'destination', name: 'orderFulfillment' }
const DEAD_LETTER_SOURCE: EsbMessageSource = {
  kind: 'deadLetters',
  triggerName: 'fulfillOrder.orderFulfillment',
}

/**
 * The broker queue behind the `orderFulfillment` destination.
 *
 * @returns Its queue reference.
 */
function fulfillmentQueue(): EsbQueueRef {
  const queue = destinationQueue(orderEsb.publications[1].destination)
  if (!queue) throw new Error('orderFulfillment is a queue')
  return queue
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

describe('EsbMessageList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(processInit).mockResolvedValue({
      type: 'COMPLETE',
      processUUID: 'uuid',
      values: { count: 1, message: 'Done.' },
    })
  })

  it('lists a queue\'s messages with their event type and subject', async () => {
    renderWithClient(
      <EsbMessageList source={QUEUE_SOURCE} queue={fulfillmentQueue()} permissions={NONE} />
    )
    const table = await screen.findByRole('table', { name: 'Messages' })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('ID:msg-1')
    expect(rows[0]).toHaveTextContent('qqq.table.order.INSERT')
    expect(rows[0]).toHaveTextContent('1001')
    expect(rows[1]).toHaveTextContent('ID:msg-2')
  })

  it('shows a dead letter\'s error and raw body when it is not a CloudEvent', async () => {
    renderWithClient(
      <EsbMessageList
        source={DEAD_LETTER_SOURCE}
        queue={deadLetterQueue(fulfillTrigger)}
        permissions={NONE}
      />
    )
    const table = await screen.findByRole('table', { name: 'Messages' })
    expect(table).toHaveTextContent('unparseable message')
    expect(table).toHaveTextContent('Not a CloudEvent')
    expect(table).toHaveTextContent('not json')
  })

  it('pages forward while the backend has more messages', async () => {
    const offsets: string[] = []
    server.use(
      http.get('/qqq/v1/esb/messages/orderFulfillment', ({ request }) => {
        const offset = new URL(request.url).searchParams.get('offset') ?? ''
        offsets.push(offset)
        return HttpResponse.json(
          offset === '0' ? orderFulfillmentMessages : { messages: [], hasMore: false }
        )
      })
    )
    const user = userEvent.setup()
    renderWithClient(
      <EsbMessageList source={QUEUE_SOURCE} queue={fulfillmentQueue()} permissions={NONE} />
    )
    await screen.findByRole('table', { name: 'Messages' })
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    await screen.findByText('No messages.')
    expect(offsets).toEqual(['0', '50'])
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })

  it('offers no selection without permission', async () => {
    renderWithClient(
      <EsbMessageList source={QUEUE_SOURCE} queue={fulfillmentQueue()} permissions={NONE} />
    )
    await screen.findByRole('table', { name: 'Messages' })
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /selected/ })).not.toBeInTheDocument()
  })

  it('deletes the selected messages after a confirmation naming the queue and count', async () => {
    const user = userEvent.setup()
    renderWithClient(
      <EsbMessageList source={QUEUE_SOURCE} queue={fulfillmentQueue()} permissions={ALL} />
    )
    await user.click(await screen.findByRole('checkbox', { name: 'Select ID:msg-1' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select ID:msg-2' }))
    await user.click(screen.getByRole('button', { name: 'Delete selected' }))

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('2 selected messages')
    expect(dialog).toHaveTextContent('orderFulfillment')
    expect(processInit).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Delete messages' }))
    await waitFor(() =>
      expect(processInit).toHaveBeenCalledWith('esbDeleteMessages', {
        values: {
          providerName: 'artemis',
          brokerQueueName: 'orderFulfillment',
          messageIds: 'ID:msg-1,ID:msg-2',
        },
      })
    )
  })

  it('moves the selected messages to the named queue', async () => {
    const user = userEvent.setup()
    renderWithClient(
      <EsbMessageList source={QUEUE_SOURCE} queue={fulfillmentQueue()} permissions={ALL} />
    )
    await user.click(await screen.findByRole('checkbox', { name: 'Select ID:msg-2' }))
    await user.click(screen.getByRole('button', { name: 'Move selected' }))
    const dialog = await screen.findByRole('alertdialog')
    const confirm = within(dialog).getByRole('button', { name: 'Move messages' })
    expect(confirm).toBeDisabled()
    await user.type(within(dialog).getByLabelText('Target queue'), 'orderFulfillment.hold')
    await user.click(confirm)
    await waitFor(() =>
      expect(processInit).toHaveBeenCalledWith('esbMoveMessages', {
        values: {
          providerName: 'artemis',
          brokerQueueName: 'orderFulfillment',
          messageIds: 'ID:msg-2',
          toBrokerQueueName: 'orderFulfillment.hold',
        },
      })
    )
  })

  it('replays the selected dead letters through the trigger', async () => {
    const user = userEvent.setup()
    renderWithClient(
      <EsbMessageList
        source={DEAD_LETTER_SOURCE}
        queue={deadLetterQueue(fulfillTrigger)}
        permissions={{ canOperate: true, canDelete: false }}
      />
    )
    await user.click(await screen.findByRole('checkbox', { name: 'Select ID:dlq-1' }))
    expect(screen.queryByRole('button', { name: 'Delete selected' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Replay selected' }))
    await waitFor(() =>
      expect(processInit).toHaveBeenCalledWith('esbReplayDeadLetters', {
        values: { triggerName: 'fulfillOrder.orderFulfillment', messageIds: 'ID:dlq-1' },
      })
    )
  })

  it('opens the list in a dialog from the browse button', async () => {
    const user = userEvent.setup()
    renderWithClient(
      <EsbBrowseButton
        label="Browse"
        title="Messages in orderFulfillment"
        source={QUEUE_SOURCE}
        queue={fulfillmentQueue()}
        permissions={NONE}
      />
    )
    expect(screen.queryByRole('table', { name: 'Messages' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Browse' }))
    const dialog = await screen.findByRole('dialog', { name: 'Messages in orderFulfillment' })
    expect(await within(dialog).findByRole('table', { name: 'Messages' })).toBeInTheDocument()
  })
})
