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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { QFieldMetaData, QRecord, QTableMetaData, QTableSection, QWidgetMetaData } from '@/types'
import { collapsibleSectionStorageKey } from '@/lib/utils/record-layout-utils'
import { RecordViewSection } from './RecordViewSection'

vi.mock('@/components/records/FieldValue', () => ({
  FieldValue: ({ field, record }: { field: QFieldMetaData; record: QRecord }) => <span>{String(record.values[field.name])}</span>,
}))
vi.mock('@/components/widgets/ConnectedWidget', () => ({
  ConnectedWidget: ({ widgetMetaData }: { widgetMetaData: QWidgetMetaData }) => <span data-testid="widget-collapse">{JSON.stringify(widgetMetaData.collapsible)}</span>,
}))

const table = {
  name: 'lab', label: 'Lab', primaryKeyField: 'id',
  fields: { title: { name: 'title', label: 'Title', type: 'STRING', isHidden: false } },
} as unknown as QTableMetaData
const record = { tableName: 'lab', values: { id: 1, title: 'Visible title' } } as QRecord

afterEach(() => window.localStorage.clear())

describe('RecordViewSection collapse metadata', () => {
  it('restores and persists a field section open state', async () => {
    const section = { name: 'details', label: 'Details', fieldNames: ['title'], isHidden: false,
      collapsible: { isCollapsible: true, initiallyOpen: false } } as QTableSection
    window.localStorage.setItem(collapsibleSectionStorageKey('lab', 'details'), 'true')
    const user = userEvent.setup()
    render(<RecordViewSection section={section} tableMetaData={table} record={record} />)
    const toggle = screen.getByRole('button', { name: 'Toggle Details' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Visible title')).toBeVisible()
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Visible title')).not.toBeVisible()
    expect(window.localStorage.getItem(collapsibleSectionStorageKey('lab', 'details'))).toBe('false')
  })

  it('overrides the widget collapse rule with the section rule without mutating shared metadata', () => {
    const section = { name: 'summary', label: 'Summary', fieldNames: [], widgetName: 'summaryWidget', isHidden: false,
      collapsible: { isCollapsible: true, initiallyOpen: false } } as QTableSection
    const widget = { name: 'summaryWidget', label: 'Summary', hasPermission: true,
      collapsible: { isCollapsible: false, initiallyOpen: true } } as QWidgetMetaData
    render(<RecordViewSection section={section} tableMetaData={table} record={record} widgetMetaDataMap={{ summaryWidget: widget }} />)
    expect(screen.getByTestId('widget-collapse')).toHaveTextContent('"isCollapsible":true')
    expect(screen.getByTestId('widget-collapse')).toHaveTextContent('"initiallyOpen":false')
    expect(widget.collapsible).toEqual({ isCollapsible: false, initiallyOpen: true })
  })

  it('collapses an association-backed widget using the section rule', async () => {
    const section = { name: 'children', label: 'Children', fieldNames: [], widgetName: 'childList', isHidden: false,
      collapsible: { isCollapsible: true, initiallyOpen: false } } as QTableSection
    const widget = { name: 'childList', label: 'Children', type: 'childRecordList', hasPermission: true,
      defaultValues: { manageAssociationName: 'childRecords' } } as QWidgetMetaData
    const renderAssociation = vi.fn(() => <span>Child records</span>)
    const user = userEvent.setup()
    render(<RecordViewSection section={section} tableMetaData={table} record={record}
      widgetMetaDataMap={{ childList: widget }} renderAssociation={renderAssociation} />)
    const toggle = screen.getByRole('button', { name: 'Children' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(renderAssociation).not.toHaveBeenCalled()
    await user.click(toggle)
    expect(screen.getByText('Child records')).toBeVisible()
    expect(renderAssociation).toHaveBeenCalledWith('childRecords', 'Children')
    expect(window.localStorage.getItem(collapsibleSectionStorageKey('lab', 'children'))).toBe('true')
  })
})
