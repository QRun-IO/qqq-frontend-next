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

// Tests for WidgetRenderer: every canonical QQQ widget type has a renderer (#550, #663)

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/lib/api/tables', () => ({ getRecord: vi.fn(() => new Promise(() => {})), queryRecords: vi.fn(() => new Promise(() => {})) }))
vi.mock('@/lib/api/metadata', () => ({ loadMetaData: vi.fn(() => new Promise(() => {})), loadTableMetaData: vi.fn(() => new Promise(() => {})), loadProcessMetaData: vi.fn(() => new Promise(() => {})) }))

import type { QWidgetMetaData } from '@/types'
import { WidgetRenderer } from './WidgetRenderer'

/** Representative backend payloads for every canonical WidgetType value. */
const PAYLOADS: Record<string, Record<string, unknown>> = {
  alert: { type: 'alert', html: '<b>Owned warning</b>', alertType: 'WARNING', bulletList: ['one'] },
  barChart: { type: 'chart', chartData: { labels: ['A'], datasets: [{ label: 'S', data: [1] }] } },
  chart: { type: 'chart', chartData: { labels: ['A'], datasets: [{ label: 'S', data: [1] }] } },
  divider: { type: 'divider' },
  fieldValueList: { type: 'fieldValueList', fields: [{ name: 'owner', label: 'Owner' }], record: { values: { owner: 'Alice' } } },
  generic: { type: 'generic', html: 'Generic body' },
  horizontalBarChart: { type: 'chart', chartData: { labels: ['A'], datasets: [{ label: 'S', data: [-1] }] } },
  html: { type: 'html', html: '<i>Owned html</i>' },
  lineChart: { type: 'chart', chartData: { labels: ['A', 'B'], datasets: [{ label: 'S', data: [1, 2] }] } },
  smallLineChart: { type: 'chart', chartData: { labels: ['A', 'B'], datasets: [{ label: 'S', data: [1, 2] }] } },
  location: { type: 'location', title: 'Owned location', location: 'Owned address' },
  multiStatistics: { type: 'multiStatistics', statisticsGroupData: [{ header: 'This Week', statisticList: [{ label: 'Red', value: 15 }] }] },
  multiTable: { type: 'multiTable', tableDataList: [{ label: 'First', columns: [{ header: 'Name', accessor: 'name' }], rows: [{ name: 'Row' }] }] },
  pieChart: { type: 'chart', chartData: { labels: ['A'], datasets: [{ label: 'S', data: [1] }] } },
  quickSightChart: { type: 'quickSightChart', url: 'http://127.0.0.1/embed.html', label: 'Owned QuickSight' },
  statistics: { type: 'statistics', count: '98.5%', countContext: 'of 481', percentageAmount: -10 },
  stackedBarChart: { type: 'chart', chartData: { labels: ['A'], datasets: [{ label: 'S', data: [1] }, { label: 'T', data: [2] }] } },
  stepper: { type: 'stepper', activeStep: 0, steps: [{ label: 'Step one' }] },
  table: { type: 'table', columns: [{ header: 'Name', accessor: 'name' }], rows: [{ name: 'Row' }] },
  usaMap: { type: 'usaMap', mapMarkerList: [{ name: 'Chicago', latitude: 41.8, longitude: -87.6 }] },
  process: { type: 'process', processMetaData: { name: 'greetInteractive' }, defaultValues: {} },
  parentWidget: { type: 'parentWidget', childWidgetNameList: ['child'], layoutType: 'GRID' },
  composite: { type: 'block', blockTypeName: 'COMPOSITE', blocks: [{ blockTypeName: 'TEXT', values: { text: 'Owned text' } }] },
  childRecordList: { type: 'childRecordList', queryOutput: { records: [] }, childTableMetaData: { name: 'child', label: 'Child', primaryKeyField: 'id', fields: {} } },
  customComponent: { type: 'customComponent' },
  cronUI: { type: 'cronUI', cronDescription: 'Every day, at 9:00 am' },
  dynamicForm: { type: 'dynamicForm', fieldList: [{ name: 'owner', label: 'Owner' }], recordOfFieldValues: { values: { owner: 'Alice' } } },
  dataBagViewer: { type: 'dataBagViewer', queryParams: { id: '1' } },
  pivotTableSetup: { type: 'pivotTableSetup', queryParams: { id: '1' } },
  filterAndColumnsSetup: { type: 'filterAndColumnsSetup' },
  rowBuilder: { type: 'rowBuilder', records: [{ values: { name: 'Row one' } }] },
  scriptViewer: { type: 'scriptViewer', queryParams: { id: '1' } },
}

describe('WidgetRenderer', () => {
  it.each(Object.keys(PAYLOADS))('renders the canonical %s type', (type) => {
    const meta: QWidgetMetaData = { name: `owned-${type}`, label: `Owned ${type}`, type, hasPermission: true, defaultValues: { componentName: 'Owned', componentSourceUrl: '/owned.js' } }
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <WidgetRenderer
          widgetMetaData={meta}
          data={PAYLOADS[type]}
          widgetRegistry={{ child: { name: 'child', label: 'Child', type: 'html', hasPermission: true } }}
          recordContext={{ tableName: 'host', recordId: '1', record: { tableName: 'host', values: { id: 1, tableName: 'person', cronExpression: '0 0 9 * * ?' } } }}
        />
      </QueryClientProvider>
    )
    expect(screen.queryByText(/Unknown widget type/)).toBeNull()
  })

  it('falls back to the payload type for widgets without a metadata type', async () => {
    const client = new QueryClient()
    render(
      <QueryClientProvider client={client}>
        <WidgetRenderer widgetMetaData={{ name: 'untyped', label: 'Untyped', hasPermission: true }} data={{ type: 'chart', title: 'Persons', chartData: { labels: ['Jan'], datasets: [{ label: 'People', data: [17] }] } }} />
      </QueryClientProvider>
    )
    expect(await screen.findByText('Persons', { selector: '[data-qqq-id="chart-title-untyped"]' })).toBeInTheDocument()
  })

  it('still reports types it does not know', () => {
    render(<WidgetRenderer widgetMetaData={{ name: 'x', label: 'X', type: 'ownedFuture', hasPermission: true }} data={{ type: 'ownedFuture' }} />)
    expect(screen.getByText(/Unknown widget type/)).toBeInTheDocument()
  })
})
