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

// Tests for the ESB app's overview widget

import React from 'react'
import { act, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'jest-axe'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import type { QWidgetMetaData } from '@/types'
import { esbOverview } from '@/mocks/fixtures/esb'
import { server } from '@/mocks/node'
import { EsbOverviewWidget } from './EsbOverviewWidget'
import { WidgetRenderer } from './WidgetRenderer'

const widgetMetaData = { name: 'esbOverview', label: 'ESB', type: 'ESB_OVERVIEW' } as QWidgetMetaData

/**
 * Renders an element inside a fresh query client.
 *
 * @param ui - The element to render.
 * @returns The render container.
 */
function renderWithClient(ui: React.ReactElement): HTMLElement {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>).container
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

describe('EsbOverviewWidget', () => {
  it('lists providers with their connection and management state', async () => {
    renderWithClient(<EsbOverviewWidget widgetMetaData={widgetMetaData} />)
    await screen.findByRole('table', { name: 'Providers' })
    const [artemis, rabbit] = bodyRows('Providers')
    expect(artemis).toHaveTextContent('artemis')
    expect(artemis).toHaveTextContent('ActiveMQ Artemis')
    expect(artemis).toHaveTextContent('Connected')
    expect(artemis).toHaveTextContent('Enabled')
    expect(rabbit).toHaveTextContent('RabbitMQ')
    expect(rabbit).toHaveTextContent('Disconnected')
    expect(rabbit).toHaveTextContent('Not configured')
  })

  it('lists destinations with their publishers and queue depth', async () => {
    renderWithClient(<EsbOverviewWidget widgetMetaData={widgetMetaData} />)
    await screen.findByRole('table', { name: 'Destinations' })
    const [events, fulfillment, results] = bodyRows('Destinations')
    expect(bodyRows('Destinations')).toHaveLength(3)
    expect(events).toHaveTextContent('orderEvents')
    expect(events).toHaveTextContent('Topic')
    expect(within(events).getByRole('link', { name: 'order' })).toHaveAttribute('href', '/app/order')
    expect(events).toHaveTextContent('INSERT, UPDATE, DELETE')
    expect(fulfillment).toHaveTextContent('Queue')
    expect(within(fulfillment).getAllByRole('cell')[3]).toHaveTextContent(/^7$/)
    expect(within(results).getByRole('link', { name: 'fulfillOrder' })).toHaveAttribute(
      'href',
      '/app/fulfillOrder'
    )
  })

  it('lists every trigger with its management actions', async () => {
    renderWithClient(<EsbOverviewWidget widgetMetaData={widgetMetaData} />)
    await screen.findByRole('table', { name: 'Triggers' })
    const [cancel, fulfill] = bodyRows('Triggers')
    expect(bodyRows('Triggers')).toHaveLength(2)
    expect(within(cancel).getByRole('link', { name: 'Cancel Order' })).toBeInTheDocument()
    expect(within(cancel).getByRole('button', { name: 'Resume Cancel Order' })).toBeInTheDocument()
    expect(within(fulfill).getByRole('button', { name: 'Pause Fulfill Order' })).toBeInTheDocument()
    const fulfillment = bodyRows('Destinations')[1]
    expect(
      within(fulfillment).getByRole('button', { name: 'Purge orderFulfillment' })
    ).toBeInTheDocument()
  })

  it('hides management actions without permission', async () => {
    server.use(
      http.get('/qqq/v1/esb/overview', () =>
        HttpResponse.json({ ...esbOverview, permissions: { canOperate: false, canDelete: false } })
      )
    )
    renderWithClient(<EsbOverviewWidget widgetMetaData={widgetMetaData} />)
    await screen.findByRole('table', { name: 'Triggers' })
    expect(screen.queryByRole('button', { name: /^(Pause|Resume|Restart|Purge)/ })).not.toBeInTheDocument()
  })

  it('says so when the ESB status is not available', async () => {
    server.use(
      http.get('/qqq/v1/esb/overview', () =>
        HttpResponse.json({ error: 'Permission denied.' }, { status: 403 })
      )
    )
    renderWithClient(<EsbOverviewWidget widgetMetaData={widgetMetaData} />)
    expect(await screen.findByText('ESB status is not available.')).toBeInTheDocument()
  })

  it('is rendered for the ESB_OVERVIEW widget type', async () => {
    renderWithClient(<WidgetRenderer widgetMetaData={widgetMetaData} data={{ type: 'ESB_OVERVIEW' }} />)
    expect(await screen.findByRole('table', { name: 'Destinations' })).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const container = renderWithClient(<EsbOverviewWidget widgetMetaData={widgetMetaData} />)
    await screen.findByRole('table', { name: 'Triggers' })
    let results: Awaited<ReturnType<typeof axe>> | undefined
    await act(async () => {
      results = await axe(container)
    })
    expect(results).toHaveNoViolations()
  })
})
