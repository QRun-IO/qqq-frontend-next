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

// Tests for the table Developer-view ESB section

import React from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/node'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'jest-axe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { processInit } from '@/lib/api/processes'

vi.mock('@/lib/api/processes', () => ({ processInit: vi.fn(), processStatus: vi.fn() }))

import { fulfillOrderEsb, orderEsb, orderFulfillmentMessages } from '@/mocks/fixtures/esb'
import { EsbSection } from './EsbSection'

/**
 * Reads the value of one counter inside a row.
 *
 * @param scope - The row (or cell) holding the counters.
 * @param label - The counter's label.
 * @returns The counter's displayed value.
 */
function counter(scope: HTMLElement, label: string): string | null | undefined {
  return within(scope).getByText(label, { selector: 'dt' }).nextElementSibling?.textContent
}

/**
 * Returns the body rows of the table with the given accessible name.
 *
 * @param name - The table's accessible name.
 * @returns Its rows, excluding the header row.
 */
function bodyRows(name: string): HTMLElement[] {
  return within(screen.getByRole('table', { name })).getAllByRole('row').slice(1)
}

describe('EsbSection', () => {
  beforeEach(() => {
    vi.mocked(processInit).mockReset()
    vi.mocked(processInit).mockResolvedValue({
      type: 'COMPLETE',
      processUUID: 'queue-run',
      values: { message: 'Done.' },
    })
  })

  it.each([
    ['subscription', false],
    ['subscription', true],
    ['subscription', null],
    ['subscription', undefined],
    ['deadLetter', false],
    ['deadLetter', true],
    ['deadLetter', null],
    ['deadLetter', undefined],
  ] as const)('uses %s paused=%s for broker queue controls', async (kind, paused) => {
    const user = userEvent.setup()
    const original = orderEsb.subscribers[kind === 'subscription' ? 1 : 0]
    const brokerName = 'serialized.custom.queue'
    const brokerQueue = { brokerName, messageCount: 9, ...(paused === undefined ? {} : { paused }) }
    const trigger = { ...original, [kind]: brokerQueue }
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <EsbSection
          data={{
            ...orderEsb,
            publications: [],
            subscribers: [trigger],
            permissions: { canOperate: true, canDelete: true },
          }}
        />
      </QueryClientProvider>
    )
    if (kind === 'deadLetter') {
      await user.click(
        screen.getByRole('button', { name: `Browse dead letters for ${trigger.processLabel}` })
      )
      await screen.findByRole('dialog')
    }
    if (paused == null) {
      expect(
        screen.queryByRole('button', { name: `Pause queue ${brokerName}` })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: `Resume queue ${brokerName}` })
      ).not.toBeInTheDocument()
      expect(processInit).not.toHaveBeenCalled()
    } else {
      const action = paused ? 'Resume' : 'Pause'
      expect(
        screen.queryByRole('button', { name: `${paused ? 'Pause' : 'Resume'} queue ${brokerName}` })
      ).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: `${action} queue ${brokerName}` }))
      await waitFor(() =>
        expect(processInit).toHaveBeenCalledWith(paused ? 'esbResumeQueue' : 'esbPauseQueue', {
          values: { providerName: 'artemis', brokerQueueName: brokerName },
        })
      )
    }
  })

  it.each([
    ['subscription', 'permission'],
    ['subscription', 'capability'],
    ['deadLetter', 'permission'],
    ['deadLetter', 'capability'],
  ] as const)(
    'hides %s pause/resume without %s even when state is known',
    async (kind, missing) => {
      const user = userEvent.setup()
      const original = orderEsb.subscribers[kind === 'subscription' ? 1 : 0]
      const brokerName = 'restricted.queue'
      const trigger = {
        ...original,
        [kind]: { brokerName, messageCount: 9, paused: false },
        destination: {
          ...original.destination,
          capabilities: {
            ...original.destination.capabilities,
            pauseQueue: missing !== 'capability',
          },
        },
      }
      render(
        <QueryClientProvider client={new QueryClient()}>
          <EsbSection
            data={{
              ...orderEsb,
              publications: [],
              subscribers: [trigger],
              permissions: { canOperate: missing !== 'permission', canDelete: true },
            }}
          />
        </QueryClientProvider>
      )
      if (kind === 'deadLetter') {
        await user.click(
          screen.getByRole('button', { name: `Browse dead letters for ${trigger.processLabel}` })
        )
        await screen.findByRole('dialog')
      }
      expect(
        screen.queryByRole('button', { name: `Pause queue ${brokerName}` })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: `Resume queue ${brokerName}` })
      ).not.toBeInTheDocument()
      expect(processInit).not.toHaveBeenCalled()
    }
  )

  it('uses the serialized subscription name for controls and trigger for browsing', async () => {
    let requestedTrigger: string | null = null
    server.use(
      http.get('/qqq/v1/esb/messages/orderEvents', ({ request }) => {
        requestedTrigger = new URL(request.url).searchParams.get('trigger')
        return HttpResponse.json(orderFulfillmentMessages)
      })
    )
    const user = userEvent.setup()
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <EsbSection
          data={{
            ...orderEsb,
            subscribers: [
              {
                ...orderEsb.subscribers[1],
                subscription: { brokerName: 'custom.subscription.queue', messageCount: 9 },
              },
            ],
            permissions: { canOperate: true, canDelete: true },
          }}
        />
      </QueryClientProvider>
    )
    expect(screen.getByText('custom.subscription.queue')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Purge custom.subscription.queue' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Pause queue custom.subscription.queue' })
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Browse subscription for Cancel Order' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Messages in custom.subscription.queue',
    })
    await within(dialog).findByRole('table', { name: 'Messages' })
    await waitFor(() => expect(requestedTrigger).toBe('cancelOrder.orderEvents'))
    expect(
      within(dialog).queryByRole('button', { name: 'Replay selected' })
    ).not.toBeInTheDocument()
  })

  it('hides browsing and broker controls when the trigger destination has no capabilities', () => {
    const trigger = orderEsb.subscribers[1]
    render(
      <QueryClientProvider client={new QueryClient()}>
        <EsbSection
          data={{
            ...orderEsb,
            publications: [],
            subscribers: [
              {
                ...trigger,
                destination: {
                  ...trigger.destination,
                  capabilities: {
                    browse: false,
                    pauseQueue: false,
                    purge: false,
                    deleteSelected: false,
                    deleteOlderThan: false,
                    move: false,
                  },
                },
              },
            ],
            permissions: { canOperate: true, canDelete: true },
          }}
        />
      </QueryClientProvider>
    )
    expect(screen.queryByRole('button', { name: /Browse/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Purge/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resume Cancel Order' })).toBeInTheDocument()
  })

  it('renders nothing when the table has no ESB section', () => {
    const { container } = render(<EsbSection data={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('lists publications with destination, type, events, counters and queue depth', () => {
    render(<EsbSection data={orderEsb} />)
    expect(screen.getByRole('heading', { name: 'Enterprise Service Bus' })).toBeInTheDocument()
    const [topic, queue] = bodyRows('Publications')
    expect(bodyRows('Publications')).toHaveLength(2)

    const topicCells = within(topic).getAllByRole('cell')
    expect(topicCells[0]).toHaveTextContent('orderEvents')
    expect(topicCells[1]).toHaveTextContent('Topic')
    expect(topicCells[2]).toHaveTextContent('INSERT, UPDATE, DELETE')
    expect(counter(topic, 'Published')).toBe('128')
    expect(counter(topic, 'Publish failures')).toBe('2')

    const queueCells = within(queue).getAllByRole('cell')
    expect(queueCells[0]).toHaveTextContent('orderFulfillment')
    expect(queueCells[1]).toHaveTextContent('Queue')
    expect(queueCells[2]).toHaveTextContent('INSERT')
    expect(counter(queue, 'Published')).toBe('40')
    expect(queueCells[4]).toHaveTextContent('7')
  })

  it('shows "—" for queue depth when the broker reports no queue info', () => {
    render(<EsbSection data={orderEsb} />)
    const [topic, queue] = bodyRows('Publications')
    expect(within(topic).getAllByRole('cell')[4]).toHaveTextContent(/^—$/)
    expect(within(queue).getAllByRole('cell')[4]).toHaveTextContent(/^7$/)
  })

  it('lists subscribers with process link, state, counters and dead-letter count', () => {
    render(<EsbSection data={orderEsb} />)
    const [fulfill, cancel] = bodyRows('Subscribers')
    expect(bodyRows('Subscribers')).toHaveLength(2)

    const fulfillCells = within(fulfill).getAllByRole('cell')
    expect(within(fulfillCells[0]).getByRole('link', { name: 'Fulfill Order' })).toHaveAttribute(
      'href',
      '/app/fulfillOrder/dev'
    )
    expect(fulfillCells[0]).toHaveTextContent('Single, concurrency 2, 3 attempts')
    expect(fulfillCells[1]).toHaveTextContent('orderFulfillment')
    expect(fulfillCells[2]).toHaveTextContent('Running')
    expect(counter(fulfill, 'Consumed')).toBe('33')
    expect(counter(fulfill, 'Succeeded')).toBe('30')
    expect(counter(fulfill, 'Failed')).toBe('3')
    expect(counter(fulfill, 'Retried')).toBe('4')
    expect(counter(fulfill, 'Dead-lettered')).toBe('1')
    expect(counter(fulfill, 'In flight')).toBe('1')
    expect(counter(fulfill, 'Avg time')).toBe('120 ms')
    expect(counter(fulfill, 'Max time')).toBe('950 ms')
    expect(counter(fulfill, 'Last error')).toBe('Warehouse API timed out')
    expect(fulfillCells[4]).toHaveTextContent(/^1$/)

    const cancelCells = within(cancel).getAllByRole('cell')
    expect(within(cancelCells[0]).getByRole('link', { name: 'Cancel Order' })).toHaveAttribute(
      'href',
      '/app/cancelOrder/dev'
    )
    expect(cancelCells[1]).toHaveTextContent('orderEvents')
    expect(cancelCells[2]).toHaveTextContent('Paused')
    expect(within(cancel).queryByText('Last error')).not.toBeInTheDocument()
    expect(cancelCells[4]).toHaveTextContent(/^—$/)
  })

  it('says so when there are no publications or subscribers', () => {
    render(<EsbSection data={{ ...orderEsb, publications: [], subscribers: [] }} />)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByText('This table does not publish to any destination.')).toBeInTheDocument()
    expect(
      screen.getByText('No processes you can access are triggered by these destinations.')
    ).toBeInTheDocument()
  })

  it("offers browsing a queue and a trigger's dead letters to anyone who sees them", () => {
    render(<EsbSection data={orderEsb} />)
    const [topic, queue] = bodyRows('Publications')
    expect(within(topic).queryByRole('button')).not.toBeInTheDocument()
    expect(
      within(queue).getByRole('button', { name: 'Browse orderFulfillment' })
    ).toBeInTheDocument()
    expect(within(queue).queryByRole('button', { name: /^Purge/ })).not.toBeInTheDocument()
    const [fulfill] = bodyRows('Subscribers')
    expect(
      within(fulfill).getByRole('button', { name: 'Browse dead letters for Fulfill Order' })
    ).toBeInTheDocument()
    expect(within(fulfill).queryByRole('button', { name: /^Pause/ })).not.toBeInTheDocument()
  })

  it('shows management actions when the user may operate and delete', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <EsbSection data={{ ...orderEsb, permissions: { canOperate: true, canDelete: true } }} />
      </QueryClientProvider>
    )
    const [topic, queue] = bodyRows('Publications')
    expect(within(topic).queryByRole('button')).not.toBeInTheDocument()
    expect(
      within(queue).getByRole('button', { name: 'Purge orderFulfillment' })
    ).toBeInTheDocument()
    expect(
      within(queue).getByRole('button', { name: 'Pause queue orderFulfillment' })
    ).toBeInTheDocument()
    const [fulfill, cancel] = bodyRows('Subscribers')
    expect(within(fulfill).getByRole('button', { name: 'Pause Fulfill Order' })).toBeInTheDocument()
    expect(within(cancel).getByRole('button', { name: 'Resume Cancel Order' })).toBeInTheDocument()
  })

  it("renders a process's publications and the triggers that start it", () => {
    render(<EsbSection data={fulfillOrderEsb} />)
    expect(bodyRows('Publications')).toHaveLength(1)
    expect(bodyRows('Triggers')).toHaveLength(1)
    expect(screen.queryByRole('table', { name: 'Subscribers' })).not.toBeInTheDocument()
  })

  it('says so when a process has no publications or triggers', () => {
    render(<EsbSection data={{ ...fulfillOrderEsb, publications: [], triggers: [] }} />)
    expect(
      screen.getByText('This process does not publish to any destination.')
    ).toBeInTheDocument()
    expect(screen.getByText('No destinations trigger this process.')).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<EsbSection data={orderEsb} />)
    // next/link updates its prefetch state while axe runs; act() flushes it.
    let results: Awaited<ReturnType<typeof axe>> | undefined
    await act(async () => {
      results = await axe(container)
    })
    expect(results).toHaveNoViolations()
  })
})
