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

import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { QTableMetaData } from '@/types'
import { queryRecords } from '@/lib/api/tables'
import { GotoRecordButton, GotoRecordDialog } from './GotoRecordDialog'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/lib/api/tables', () => ({ queryRecords: vi.fn() }))

const field = (name: string, label: string) => ({ name, label, type: 'STRING' })
const table = (gotoFieldNames?: string[][]): QTableMetaData => ({
  name: 'bin', label: 'Storage Bin', primaryKeyField: 'id',
  fields: { id: field('id', 'Id'), code: field('code', 'Bin Code'), aisle: field('aisle', 'Aisle'), shelf: field('shelf', 'Shelf') },
  ...(gotoFieldNames ? { supplementalMetaData: { materialDashboard: { gotoFieldNames } } } : {}),
} as unknown as QTableMetaData)
const record = (id: number) => ({ tableName: 'bin', values: { id } })

describe('GotoRecordDialog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the button only for tables with gotoFieldNames, and restores focus on close', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<GotoRecordButton tableMetaData={table()} />)
    expect(screen.queryByRole('button', { name: /Go to a/ })).not.toBeInTheDocument()
    rerender(<GotoRecordButton tableMetaData={table([['code']])} />)
    const button = screen.getByRole('button', { name: 'Go to a Storage Bin record' })
    await user.click(button)
    const dialog = screen.getByRole('dialog', { name: 'Go To...' })
    expect(screen.getByLabelText('Id')).toHaveFocus()
    expect(dialog).toContainElement(screen.getByLabelText('Bin Code'))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(button).toHaveFocus()
  })

  it('opens the one matching record; Enter submits the option being typed in', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    vi.mocked(queryRecords).mockResolvedValue({ records: [record(7)] })
    render(<GotoRecordDialog open tableMetaData={table([['code'], ['aisle', 'shelf']])} onClose={onClose} />)
    const go = screen.getByRole('button', { name: 'Go to the Storage Bin record with this Bin Code' })
    expect(go).toBeDisabled()
    await user.type(screen.getByLabelText('Bin Code'), 'B-7{Enter}')
    expect(queryRecords).toHaveBeenCalledWith('bin', { filter: { criteria: [{ fieldName: 'code', operator: 'EQUALS', values: ['B-7'] }], booleanOperator: 'AND', skip: 0, limit: 2 } })
    expect(push).toHaveBeenCalledWith('/app/bin/7')
    expect(onClose).toHaveBeenCalled()
  })

  it('shows Material\'s messages for no match and for several matches', async () => {
    const user = userEvent.setup()
    vi.mocked(queryRecords).mockResolvedValueOnce({ records: [] }).mockResolvedValueOnce({ records: [record(1), record(2)] })
    render(<GotoRecordDialog open tableMetaData={table([['aisle', 'shelf']])} tableVariant={{ id: 2, type: 'store' }} onClose={vi.fn()} />)
    await user.type(screen.getByLabelText('Id'), '99{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent('Record not found.')
    await user.type(screen.getByLabelText('Aisle'), 'A{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent('More than 1 record was found...')
    expect(vi.mocked(queryRecords).mock.calls[1][1]).toEqual({
      filter: { criteria: [{ fieldName: 'aisle', operator: 'EQUALS', values: ['A'] }], booleanOperator: 'AND', skip: 0, limit: 2 },
      tableVariant: { id: 2, type: 'store' },
    })
    expect(push).not.toHaveBeenCalled()
  })

  it('reports a failed lookup, and cannot be dismissed when mayClose is false', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    vi.mocked(queryRecords).mockRejectedValue(new Error('Boom'))
    render(<GotoRecordDialog open mayClose={false} tableMetaData={table()} onClose={onClose} />)
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: 'Go To...' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Id'), '5{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent('Error: Boom')
    expect(onClose).not.toHaveBeenCalled()
  })
})
