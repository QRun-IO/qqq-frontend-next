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

// Tests for the selection banner, bulk shortcuts and the Actions menu entries (#649)

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import type { QProcessMetaData, QTableMetaData } from '@/types'
import { BulkActionBar } from './BulkActionBar'
import { RecordQueryBulkBar } from './RecordQueryBulkBar'
import { buildActionEntries } from './ProcessLauncherMenu'
import { selectionBannerText } from './SelectionMenu'

const table = (overrides: Partial<QTableMetaData> = {}): QTableMetaData => ({
  name: 'person', label: 'Person', isHidden: false, primaryKeyField: 'id', fields: {}, sections: [], exposedJoins: [],
  capabilities: ['TABLE_QUERY', 'TABLE_INSERT', 'TABLE_UPDATE', 'TABLE_DELETE'], readPermission: true, insertPermission: true,
  editPermission: true, deletePermission: true, usesVariants: false, variantTableLabel: '', ...overrides,
})
const process = (name: string, extra: Partial<QProcessMetaData> = {}): QProcessMetaData => ({
  name, label: name, tableName: 'person', isHidden: name.includes('.bulk'), iconName: '', hasPermission: true, stepFlow: 'LINEAR',
  minInputRecords: 0, frontendSteps: [], ...extra,
})
const allProcesses = Object.fromEntries(['person.bulkInsert', 'person.bulkEdit', 'person.bulkEditWithFile', 'person.bulkDelete'].map((n) => [n, process(n)]))

describe('BulkActionBar', () => {
  it('is hidden without a selection and shows the banner and actions with one', async () => {
    const onClear = vi.fn()
    const onClick = vi.fn()
    const { rerender, container } = render(<BulkActionBar selectionCount={0} selectionText="" onClearSelection={onClear} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<BulkActionBar selectionCount={2} selectionText="2 records are selected." onClearSelection={onClear}
      actions={[{ key: 'x', label: 'Bulk Edit', dataId: 'bulk-edit', onClick }]} />)
    expect(screen.getByText('2 records are selected.')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Bulk Edit' }))
    await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(onClick).toHaveBeenCalledOnce()
    expect(onClear).toHaveBeenCalledOnce()
  })

  it('launches bulk edit and bulk delete processes from the query bar', async () => {
    const onLaunch = vi.fn()
    render(<RecordQueryBulkBar tableMetaData={table()} allProcesses={allProcesses} selectionMode="all" selectionCount={11}
      pageRowCount={10} allPageRowsSelected={false} distinct={false} onClearSelection={vi.fn()} onLaunch={onLaunch} />)
    expect(screen.getByText('All 11 records matching this query are selected.')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Bulk Delete' }))
    expect(onLaunch).toHaveBeenCalledWith(allProcesses['person.bulkDelete'])
  })
})

describe('selection banner text (Material wording)', () => {
  it('describes each selection mode', () => {
    expect(selectionBannerText('rows', 10, 10, true, false)).toBe('The 10 records on this page are selected.')
    expect(selectionBannerText('rows', 1, 10, false, false)).toBe('1 record is selected.')
    expect(selectionBannerText('all', 30, 25, false, true)).toBe('All 30 distinct records matching this query are selected.')
    expect(selectionBannerText('subset', 5, 25, false, false)).toBe('The first 5 records matching this query are selected.')
  })
})

describe('buildActionEntries', () => {
  it('offers bulk processes per capability, permission and process, in Material order', () => {
    const { bulk } = buildActionEntries({ tableMetaData: table(), allProcesses, processes: [], selectionCount: 1 })
    expect(bulk.map((e) => e.label)).toEqual(['Bulk Load', 'Bulk Edit', 'Bulk Edit With File', 'Bulk Delete'])
    const viewer = buildActionEntries({ tableMetaData: table({ insertPermission: false, editPermission: false, deletePermission: false }), allProcesses, processes: [], selectionCount: 1 })
    expect(viewer.bulk).toEqual([])
    const readOnly = buildActionEntries({ tableMetaData: table({ capabilities: ['TABLE_QUERY'] }), allProcesses, processes: [], selectionCount: 1 })
    expect(readOnly.bulk).toEqual([])
  })

  it('blocks bulk edit/delete without a selection and enforces process record limits', () => {
    const { bulk, table: processes } = buildActionEntries({
      tableMetaData: table(), allProcesses, selectionCount: 0,
      processes: [process('greet', { label: 'Greet', minInputRecords: 1 }), process('clone', { label: 'Clone', maxInputRecords: 1 })],
    })
    expect(bulk.find((e) => e.key === 'bulkEdit')?.blockedMessage).toBe('No records were selected to Bulk Edit.')
    expect(bulk.find((e) => e.key === 'bulkInsert')?.blockedMessage).toBeUndefined()
    expect(processes.map((e) => e.label)).toEqual(['Clone', 'Greet'])
    expect(processes[1].blockedMessage).toBe('No records were selected for the process: Greet')
    const many = buildActionEntries({ tableMetaData: table(), allProcesses, selectionCount: 2, processes: [process('clone', { label: 'Clone', maxInputRecords: 1 })] })
    expect(many.table[0].blockedMessage).toBe('Too many records were selected for the process: Clone.  A maximum of 1 is allowed.')
  })

  it('lists processes added to every screen after the table\'s own, in order, hidden or not', () => {
    const { table: own, added } = buildActionEntries({
      tableMetaData: table(), allProcesses, selectionCount: 0,
      processes: [
        process('zeta', { label: 'Zeta' }),
        process('alpha', { label: 'Alpha' }),
        process('tag', { label: 'Tag Records', tableName: '', isHidden: true, minInputRecords: 1 }),
        process('audit', { label: 'Audit Records', tableName: 'other' }),
        process('denied', { label: 'Denied', tableName: '', hasPermission: false }),
      ],
    })
    expect(own.map((e) => e.label)).toEqual(['Alpha', 'Zeta'])
    expect(added.map((e) => e.label)).toEqual(['Tag Records', 'Audit Records'])
    expect(added[0].blockedMessage).toBe('No records were selected for the process: Tag Records')
  })
})
