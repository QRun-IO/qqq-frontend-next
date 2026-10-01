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

// Tests for ChildRecordListWidget

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render as renderUi, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const instance = vi.hoisted(() => ({ value: { tables: {} as Record<string, unknown>, widgets: {} } }))
vi.mock('@/lib/api/metadata', () => ({ loadMetaData: vi.fn(async () => instance.value) }))
const downloads = vi.hoisted(() => ({ calls: [] as Array<[string, string]> }))
vi.mock('./widget-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./widget-utils')>()),
  downloadText: (fileName: string, text: string) => { downloads.calls.push([fileName, text]) },
}))

import type { QRecord, QWidgetMetaData } from '@/types'
import {
  ChildRecordListWidget, addChildHref, childColumns, childExportTitle, childRecordsCsv, listColumns, nextViewAllHref, shownColumns,
} from './ChildRecordListWidget'
import type { ChildRecordListPayload, ChildTableMetaData } from './ChildRecordListWidget'

/**
 * Renders with a query client (the widget reads the cached instance metadata).
 *
 * @param ui - Element to render.
 * @returns The render result.
 */
function render(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return renderUi(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  instance.value = { tables: {}, widgets: {} }
  downloads.calls = []
})

const meta: QWidgetMetaData = { name: 'accWidgetHostJoinChild', label: 'Owned Children', type: 'childRecordList', hasPermission: true }

const childTable: ChildTableMetaData = {
  name: 'accWidgetHostChild',
  label: 'Widget Host Child',
  primaryKeyField: 'id',
  fields: {
    name: { name: 'name', label: 'Name' },
    hostId: { name: 'hostId', label: 'Host' },
    id: { name: 'id', label: 'Id' },
  },
  sections: [
    { name: 'identity', tier: 'T1', fieldNames: ['id', 'name'], isHidden: false },
    { name: 'otherFields', tier: 'T2', fieldNames: ['hostId'], isHidden: false },
  ],
}

/** The real payload shape from GET /widget/accWidgetHostJoinChild?id=1&tableName=accWidgetHost. */
const payload: ChildRecordListPayload = {
  type: 'childRecordList',
  queryOutput: {
    records: [
      { tableName: 'accWidgetHostChild', recordLabel: 'Owned child alpha', values: { id: 1, hostId: 1, name: 'Owned child alpha' }, displayValues: { hostId: 'Owned host one', name: 'Owned child alpha', id: '1' } },
      { tableName: 'accWidgetHostChild', recordLabel: 'Owned child beta', values: { id: 2, hostId: 1, name: 'Owned child beta' }, displayValues: { hostId: 'Owned host one', name: 'Owned child beta', id: '2' } },
    ],
  },
  childFrontendTableMetaData: childTable,
  tablePath: '/widgetRecords/accWidgetHostChild',
  viewAllLink: '/widgetRecords/accWidgetHostChild?filter=%7B%22criteria%22%3A%5B%5D%7D',
  totalRows: 3,
  disableRowClick: false,
  canAddChildRecord: false,
  omitFieldNames: ['hostId'],
}

describe('ChildRecordListWidget', () => {
  it('renders child rows with labelled columns, record links and the partial-count notice', () => {
    const { container } = render(<ChildRecordListWidget widgetMetaData={meta} data={payload} />)
    const table = screen.getByRole('table', { name: 'Owned Children' })
    expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Id', 'Name'])
    const alpha = container.querySelector('[data-qqq-id="child-record-row-accWidgetHostJoinChild-1"]') as HTMLElement
    expect(alpha).toHaveTextContent('Owned child alpha')
    expect(within(alpha).getByRole('link', { name: '1' })).toHaveAttribute('href', '/app/accWidgetHostChild/1')
    expect(screen.queryByText('Owned host one')).not.toBeInTheDocument()
    expect(screen.getByText('Showing 2 of 3')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View All' })).toHaveAttribute('href', '/app/accWidgetHostChild?filter=%7B%22criteria%22%3A%5B%5D%7D')
  })

  it('shows zero values and omits links when row clicks are disabled', () => {
    const data: ChildRecordListPayload = {
      ...payload,
      disableRowClick: true,
      totalRows: 1,
      viewAllLink: undefined,
      omitFieldNames: [],
      queryOutput: { records: [{ tableName: 'accWidgetHostChild', values: { id: 0, hostId: 0, name: 'Zero child' } }] },
    }
    render(<ChildRecordListWidget widgetMetaData={meta} data={data} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['0', 'Zero child', '0'])
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument()
  })

  it('shows the empty message when the backend returned no records', () => {
    render(<ChildRecordListWidget widgetMetaData={meta} data={{ ...payload, queryOutput: {}, totalRows: 0, viewAllLink: undefined }} />)
    expect(screen.getByText('No Widget Host Child records found')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows a contained notice for a malformed payload', () => {
    render(<ChildRecordListWidget widgetMetaData={meta} data={{ ...payload, queryOutput: { records: { invalidShape: true } as never } }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('child record list widget data is not in the expected format')
  })

  it('orders columns by section with the primary key first, skipping hidden sections and fields', () => {
    const table: ChildTableMetaData = {
      name: 'scheduledReport',
      primaryKeyField: 'id',
      fields: {
        id: { name: 'id', label: 'Id' },
        format: { name: 'format', label: 'Format' },
        cronExpression: { name: 'cronExpression', label: 'Cron Expression' },
        secret: { name: 'secret', label: 'Secret', isHidden: true },
        blob: { name: 'blob', label: 'Blob', isHeavy: true },
      },
      sections: [
        { tier: 'T2', fieldNames: ['format', 'secret', 'blob'] },
        { tier: 'T1', fieldNames: ['id'] },
        { tier: 'T2', fieldNames: ['cronExpression'], isHidden: true },
      ],
    }
    expect(childColumns(table).map((field) => field.name)).toEqual(['id', 'format'])
    expect(childColumns(table, [], ['format']).map((field) => field.name)).toEqual(['format'])
  })

  it('adds a child the Material way: join defaults locked, over the record or on the create page', () => {
    const add: ChildRecordListPayload = { ...payload, canAddChildRecord: true, defaultValuesForNewChildRecords: { hostId: 1 },
      defaultValuesForNewChildRecordsFromParentFields: { name: 'title' } }
    const presets = `/defaultValues=${encodeURIComponent('{"hostId":1,"name":"Host one"}')}/disabledFields=${encodeURIComponent('{"hostId":1,"name":1}')}`
    expect(addChildHref(add, 'accWidgetHostChild', { id: 1, title: 'Host one' })).toBe(`#/createChild=accWidgetHostChild${presets}`)
    expect(addChildHref({ ...add, disabledFieldsForNewChildRecords: ['hostId'], defaultValuesForNewChildRecordsFromParentFields: undefined }, 'accWidgetHostChild', undefined))
      .toBe(`/app/accWidgetHostChild/create#/defaultValues=${encodeURIComponent('{"hostId":1}')}/disabledFields=${encodeURIComponent('{"hostId":1}')}`)
  })

  it('maps Material view-all paths to the Next record query route', () => {
    expect(nextViewAllHref('/app/path/table?filter=x', 'table')).toBe('/app/table?filter=x')
    expect(nextViewAllHref('/app/path/table', 'table')).toBe('/app/table')
  })
})

/** A child table with typed fields and an exposed join (the WID-072 fixture shape). */
const typedChild: ChildTableMetaData = {
  name: 'accExtraChild',
  label: 'Extra Child',
  primaryKeyField: 'id',
  fields: {
    id: { name: 'id', label: 'Id', type: 'INTEGER' },
    hostId: { name: 'hostId', label: 'Host', type: 'INTEGER', possibleValueSourceName: 'accExtraHost' },
    name: { name: 'name', label: 'Name', type: 'STRING' },
    isActive: { name: 'isActive', label: 'Active', type: 'BOOLEAN' },
    tagId: { name: 'tagId', label: 'Tag', type: 'INTEGER', possibleValueSourceName: 'accExtraTag' },
  },
  sections: [{ name: 'identity', tier: 'T1', fieldNames: ['id', 'hostId', 'name', 'isActive', 'tagId'] }],
  exposedJoins: [{
    label: 'Owned Tag',
    joinTable: { name: 'accExtraTag', label: 'Extra Tag', primaryKeyField: 'id', fields: { id: { name: 'id', label: 'Id', type: 'INTEGER' }, code: { name: 'code', label: 'Code', type: 'STRING' } },
      sections: [{ name: 'identity', tier: 'T1', fieldNames: ['id', 'code'] }] },
  }],
}

const typedRecords: QRecord[] = [
  { tableName: 'accExtraChild', values: { id: 11, hostId: 1, name: 'Owned "quoted" child', isActive: true, tagId: 5, 'accExtraTag.id': 5, 'accExtraTag.code': 'OWN-5' },
    displayValues: { hostId: 'Owned host', tagId: 'Owned tag five', isActive: 'Yes' } },
  { tableName: 'accExtraChild', values: { id: 12, hostId: 1, name: 'Second child', isActive: false, tagId: null, 'accExtraTag.id': null, 'accExtraTag.code': null },
    displayValues: { hostId: 'Owned host', isActive: 'No' } },
]

const typedPayload: ChildRecordListPayload = {
  type: 'childRecordList',
  queryOutput: { records: typedRecords },
  childFrontendTableMetaData: typedChild,
  totalRows: 5,
  viewAllLink: '/extras/accExtraChild?filter=x',
  canAddChildRecord: true,
  defaultValuesForNewChildRecords: { hostId: 1 },
  includeExposedJoinTables: ['accExtraTag'],
  omitFieldNames: [],
}

const readable = (name: string) => name === 'accExtraTag'

describe('ChildRecordListWidget Material parity (WID-072)', () => {
  it('builds child and readable join columns, and hides the parent key only on screen', () => {
    const all = listColumns(typedChild, typedPayload, readable)
    expect(all.map((column) => [column.name, column.label])).toEqual([
      ['id', 'Id'], ['hostId', 'Host'], ['name', 'Name'], ['isActive', 'Active'], ['tagId', 'Tag'],
      ['accExtraTag.id', 'Owned Tag: Id'], ['accExtraTag.code', 'Owned Tag: Code'],
    ])
    expect(shownColumns(all, typedPayload).map((column) => column.name)).toEqual(['id', 'name', 'isActive', 'tagId', 'accExtraTag.id', 'accExtraTag.code'])
    // a join the widget did not query, or the user may not read, adds nothing
    expect(listColumns(typedChild, { ...typedPayload, includeExposedJoinTables: [] }, readable).map((column) => column.name)).not.toContain('accExtraTag.code')
    expect(listColumns(typedChild, typedPayload, () => false).map((column) => column.name)).not.toContain('accExtraTag.code')
    // omit and only apply to join columns too
    expect(listColumns(typedChild, { ...typedPayload, omitFieldNames: ['accExtraTag.id'] }, readable).map((column) => column.name)).not.toContain('accExtraTag.id')
    expect(listColumns(typedChild, { ...typedPayload, onlyIncludeFieldNames: ['id', 'accExtraTag.code'] }, readable).map((column) => column.name)).toEqual(['id', 'accExtraTag.code'])
  })

  it('writes the CSV Material writes: every cell quoted, display values first, the parent key included', () => {
    const csv = childRecordsCsv(listColumns(typedChild, typedPayload, readable), typedRecords)
    expect(csv).toBe(
      '"Id","Host","Name","Active","Tag","Owned Tag: Id","Owned Tag: Code"\n'
      + '"11","Owned host","Owned ""quoted"" child","Yes","Owned tag five","5","OWN-5"\n'
      + '"12","Owned host","Second child","No","","",""\n'
    )
    expect(childExportTitle(2, 5, true)).toBe('Export these 2 records.\nClick View All to export all records.')
    expect(childExportTitle(2, 5, false)).toBe('Export these 2 records.')
    expect(childExportTitle(2, 2, true)).toBe('Export')
  })

  it('renders typed cells with possible-value links, join columns and a row click that opens the child', async () => {
    instance.value = { tables: { accExtraChild: { name: 'accExtraChild', label: 'Extra Child' }, accExtraTag: { name: 'accExtraTag', label: 'Extra Tag', readPermission: true } }, widgets: {} }
    const meta: QWidgetMetaData = { name: 'accExtraChildren', label: 'Owned Extra Children', type: 'childRecordList', hasPermission: true, showExportButton: true }
    const { container } = render(<ChildRecordListWidget widgetMetaData={meta} data={typedPayload} />)
    const table = screen.getByRole('table', { name: 'Owned Extra Children' })
    await waitFor(() => expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Id', 'Name', 'Active', 'Tag', 'Owned Tag: Id', 'Owned Tag: Code']))
    const row = container.querySelector('[data-qqq-id="child-record-row-accExtraChildren-11"]') as HTMLElement
    expect(within(row).getByRole('link', { name: 'Owned tag five' })).toHaveAttribute('href', '/app/accExtraTag/5')
    expect(row.querySelector('[data-qqq-id="child-record-cell-accExtraChildren-isActive"]')).toHaveTextContent('Yes')
    expect(row.querySelector('[data-qqq-id="child-record-cell-accExtraChildren-accExtraTag.code"]')).toHaveTextContent('OWN-5')
    // a click anywhere on the row follows its record link; clicks on other links keep their own target
    const recordLink = within(row).getByRole('link', { name: '11' })
    const followed = vi.fn((event: Event) => event.preventDefault())
    recordLink.addEventListener('click', followed)
    fireEvent.click(row.querySelector('[data-qqq-id="child-record-cell-accExtraChildren-name"]') as HTMLElement)
    expect(followed).toHaveBeenCalledTimes(1)
    const tagLink = within(row).getByRole('link', { name: 'Owned tag five' })
    tagLink.addEventListener('click', (event) => event.preventDefault())
    fireEvent.click(tagLink)
    expect(followed).toHaveBeenCalledTimes(1)
  })

  it('exports the shown rows with every column from the Export button', async () => {
    instance.value = { tables: { accExtraTag: { name: 'accExtraTag', label: 'Extra Tag' } }, widgets: {} }
    const meta: QWidgetMetaData = { name: 'accExtraChildren', label: 'Owned Extra Children', type: 'childRecordList', hasPermission: true, showExportButton: true }
    render(<ChildRecordListWidget widgetMetaData={meta} data={typedPayload} />)
    const button = screen.getByRole('button', { name: 'Export these 2 records. Click View All to export all records.' })
    await waitFor(() => expect(screen.getAllByRole('columnheader')).toHaveLength(6))
    fireEvent.click(button)
    expect(downloads.calls).toHaveLength(1)
    expect(downloads.calls[0][0]).toMatch(/^Owned Extra Children \d{4}-\d{2}-\d{2} \d{4}\.csv$/)
    expect(downloads.calls[0][1].split('\n')[0]).toBe('"Id","Host","Name","Active","Tag","Owned Tag: Id","Owned Tag: Code"')
  })

  it('offers no Export without showExportButton and disables it without rows; no row click when disabled', () => {
    const meta: QWidgetMetaData = { name: 'accExtraChildren', label: 'Owned Extra Children', type: 'childRecordList', hasPermission: true }
    const { rerender, container } = render(<ChildRecordListWidget widgetMetaData={meta} data={{ ...typedPayload, disableRowClick: true }} />)
    expect(screen.queryByRole('button', { name: /Export/ })).not.toBeInTheDocument()
    expect(container.querySelector('[data-row-link]')).toBeNull()
    const client = new QueryClient()
    rerender(<QueryClientProvider client={client}><ChildRecordListWidget widgetMetaData={{ ...meta, showExportButton: true }} data={{ ...typedPayload, queryOutput: { records: [] } }} /></QueryClientProvider>)
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled()
  })
})
