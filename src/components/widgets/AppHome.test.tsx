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

// Tests for AppHome: v1 app shapes (arrays omitted when empty), labels, groups, hidden entries, child apps, counts

import React from 'react'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'

import { server } from '@/mocks/node'
import type { QAppMetaData, QInstance, QTableMetaData, QProcessMetaData } from '@/types'
import { AppHome } from './AppHome'

function table(name: string, label: string, extra: Partial<QTableMetaData> = {}): QTableMetaData {
  return { name, label, isHidden: false, readPermission: true, capabilities: ['TABLE_COUNT', 'TABLE_QUERY'], ...extra } as QTableMetaData
}

function processMeta(name: string, label: string, extra: Partial<QProcessMetaData> = {}): QProcessMetaData {
  return { name, label, isHidden: false, hasPermission: true, ...extra } as QProcessMetaData
}

const instance = {
  apps: { childApp: { name: 'childApp', label: 'Child App', icon: { name: 'folder' } } },
  appTree: [],
  tables: {
    carrier: table('carrier', 'Carrier'),
    hiddenTable: table('hiddenTable', 'Hidden Table', { isHidden: true }),
    uncountable: table('uncountable', 'Uncountable', { capabilities: ['TABLE_QUERY'] }),
  },
  processes: {
    runIt: processMeta('runIt', 'Run It'),
  },
  widgets: {},
} as unknown as QInstance

function renderHome(app: QAppMetaData, meta: QInstance = instance) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AppHome appMetaData={app} instance={meta} widgetRegistry={{}} />
    </QueryClientProvider>
  )
}

describe('AppHome', () => {
  beforeEach(() => {
    server.use(http.post('*/table/carrier/count', () => HttpResponse.json({ count: 11 })))
  })

  it('renders an app with no widgets, sections or children (v1 omits empty arrays) as the empty state', () => {
    renderHome({ name: 'empty', label: 'Empty App' })
    expect(screen.getByRole('heading', { level: 1, name: 'Empty App' })).toBeInTheDocument()
    expect(screen.getByText('No dashboard content configured for this app')).toBeInTheDocument()
  })

  it('renders sections by label in Actions / Data groups, omitting hidden and unpermitted entries', async () => {
    renderHome({
      name: 'misc',
      label: 'Misc',
      icon: { name: 'stars' },
      sections: [{ name: 'misc', label: 'Misc Section', icon: { name: 'badge' }, tables: ['carrier', 'hiddenTable', 'deniedTable', 'uncountable'], processes: ['runIt', 'deniedProcess'] }],
      childMap: {
        carrier: { name: 'carrier', label: 'Carrier Label', type: 'TABLE', icon: { name: 'local_shipping' } },
        runIt: { name: 'runIt', label: 'Run It Label', type: 'PROCESS' },
      },
    })
    const section = screen.getByRole('region', { name: 'Misc Section' })
    expect(within(section).getByRole('heading', { level: 2 }).querySelector('svg')).toHaveAttribute('data-qqq-icon', 'badge')

    const actions = within(within(section).getByRole('list', { name: 'Actions' })).getAllByRole('link')
    expect(actions.map((link) => link.textContent)).toEqual(['Run It Label'])
    expect(actions[0]).toHaveAttribute('href', '/app/runIt')
    // A process without an icon uses the app icon, as Material does
    expect(actions[0].querySelector('svg')).toHaveAttribute('data-qqq-icon', 'stars')

    const data = within(within(section).getByRole('list', { name: 'Data' })).getAllByRole('link')
    expect(data).toHaveLength(2)
    expect(data[0]).toHaveTextContent('Carrier Label')
    expect(data[0].querySelector('svg')).toHaveAttribute('data-qqq-icon', 'local_shipping')
    expect(data[1]).toHaveTextContent('Uncountable')
    expect(await within(data[0]).findByText('11 total records')).toBeInTheDocument()
    expect(within(data[1]).getByText('–')).toBeInTheDocument()
    expect(screen.queryByText(/Hidden Table|deniedTable|deniedProcess/)).not.toBeInTheDocument()
  })

  it('lists child apps and builds a section from leaf children when the app declares none', () => {
    renderHome({
      name: 'parent',
      label: 'Parent',
      children: [
        { name: 'childApp', label: 'Child App', type: 'APP' },
        { name: 'runIt', label: 'Run It', type: 'PROCESS' },
      ],
    })
    expect(within(screen.getByRole('region', { name: 'Apps' })).getByRole('link', { name: 'Child App' })).toHaveAttribute('href', '/app/childApp')
    expect(screen.getByRole('link', { name: 'Child App' }).querySelector('svg')).toHaveAttribute('data-qqq-icon', 'folder')
    expect(within(screen.getByRole('region', { name: 'Parent' })).getByRole('link', { name: 'Run It' })).toBeInTheDocument()
    expect(screen.queryByText('No dashboard content configured for this app')).not.toBeInTheDocument()
  })

  it('does not render a section whose every entry is hidden or unpermitted', () => {
    renderHome({ name: 'x', label: 'X', sections: [{ name: 'x', label: 'Only Hidden', tables: ['hiddenTable'] }] })
    expect(screen.queryByRole('region', { name: 'Only Hidden' })).not.toBeInTheDocument()
    expect(screen.getByText('No dashboard content configured for this app')).toBeInTheDocument()
  })
})
