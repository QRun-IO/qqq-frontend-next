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

// Tests for the process Developer view

import React from 'react'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'jest-axe'
import { describe, expect, it } from 'vitest'

import { fulfillOrderEsb } from '@/mocks/fixtures/esb'
import { qInstance } from '@/mocks/fixtures/q-instance'
import type { EsbProcessResponse } from '@/types'
import { ProcessDeveloperView } from './ProcessDeveloperView'

const fulfillOrder = qInstance.processes.fulfillOrder

/**
 * Renders the view inside a query client.
 *
 * @param esb - The process's ESB data.
 * @returns The render container.
 */
function renderView(esb: EsbProcessResponse | null): HTMLElement {
  const { container } = render(
    <QueryClientProvider client={new QueryClient()}>
      <ProcessDeveloperView process={fulfillOrder} esb={esb} />
    </QueryClientProvider>
  )
  return container
}

/**
 * Reads the value shown for a summary statistic.
 *
 * @param label - The statistic's label.
 * @returns Its displayed value.
 */
function stat(label: string): string | null | undefined {
  return screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent
}

describe('ProcessDeveloperView', () => {
  it('summarizes the process metadata', () => {
    renderView(null)
    expect(
      screen.getByRole('heading', { name: 'Process Developer View: fulfillOrder' })
    ).toBeInTheDocument()
    expect(stat('Label')).toBe('Fulfill Order')
    expect(stat('Steps')).toBe('2')
    expect(stat('Table')).toBe('order')
    expect(stat('Access')).toBe('Allowed')
  })

  it('shows the full metadata as JSON on demand', async () => {
    const user = userEvent.setup()
    renderView(null)
    expect(screen.queryByText(/"trackingNumber"/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Full Process Metadata' }))
    expect(screen.getByText(/"trackingNumber"/)).toBeInTheDocument()
  })

  it('shows the process\'s ESB publications and triggers', () => {
    renderView(fulfillOrderEsb)
    expect(screen.getByRole('heading', { name: 'Enterprise Service Bus' })).toBeInTheDocument()
    const publications = screen.getByRole('table', { name: 'Publications' })
    expect(within(publications).getByText('fulfillmentResults')).toBeInTheDocument()
    expect(publications).toHaveTextContent('COMPLETED, FAILED')
    const triggers = screen.getByRole('table', { name: 'Triggers' })
    expect(within(triggers).getAllByRole('row')).toHaveLength(2)
    expect(triggers).toHaveTextContent('orderFulfillment')
  })

  it('omits the ESB section when the process has none', () => {
    renderView(null)
    expect(
      screen.queryByRole('heading', { name: 'Enterprise Service Bus' })
    ).not.toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const container = renderView(fulfillOrderEsb)
    let results: Awaited<ReturnType<typeof axe>> | undefined
    await act(async () => {
      results = await axe(container)
    })
    expect(results).toHaveNoViolations()
  })
})
