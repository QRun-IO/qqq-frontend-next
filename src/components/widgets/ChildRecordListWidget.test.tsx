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
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'

import type { QWidgetMetaData } from '@/types'
import { ChildRecordListWidget, addChildHref, childColumns, nextViewAllHref } from './ChildRecordListWidget'
import type { ChildRecordListPayload, ChildTableMetaData } from './ChildRecordListWidget'

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
