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


// Tests for AppHome widget headings: every widget title is an h2 under the page's h1

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import type { QAppMetaData, QInstance, QWidgetMetaData } from '@/types'
import { AppHome } from './AppHome'
import { WidgetBlock } from './WidgetBlock'

// The real chrome (WidgetBlock) around a stub body, so the title element is the production one
vi.mock('./ConnectedWidget', () => ({
  ConnectedWidget: ({ widgetMetaData }: { widgetMetaData: QWidgetMetaData }) => (
    <WidgetBlock widgetMetaData={widgetMetaData}><p>{widgetMetaData.label} body</p></WidgetBlock>
  ),
}))

describe('AppHome widget headings', () => {
  it('renders widget titles as h2 directly under the h1', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const registry = {
      one: { name: 'one', label: 'First Widget', type: 'table', hasPermission: true, isCard: true },
      two: { name: 'two', label: 'Second Widget', type: 'table', hasPermission: true, isCard: true },
    } as Record<string, QWidgetMetaData>
    render(
      <QueryClientProvider client={client}>
        <AppHome appMetaData={{ name: 'home', label: 'Home', widgets: ['one', 'two'], children: [], sections: [] } as unknown as QAppMetaData}
          instance={{ apps: {}, appTree: [], tables: {}, processes: {}, widgets: {} } as unknown as QInstance} widgetRegistry={registry} />
      </QueryClientProvider>
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['First Widget', 'Second Widget'])
    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0)
  })
})
