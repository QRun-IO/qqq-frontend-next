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
import { act, render, screen, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import { describe, expect, it } from 'vitest'

import { orderEsb } from '@/mocks/fixtures/esb'
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
      '/app/fulfillOrder'
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
      '/app/cancelOrder'
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
