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

// Tests for ShareButton / ShareDialog (#665)

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/lib/api/sharing', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api/sharing')>()
  return { ...original, getSharedRecords: vi.fn(), insertSharedRecord: vi.fn(), editSharedRecord: vi.fn(), deleteSharedRecord: vi.fn() }
})
vi.mock('@/lib/api/possible-values', () => ({ fetchPossibleValues: vi.fn(async () => [{ id: 'user:sample:bob', label: 'Bob' }, { id: 'user:sample:casey', label: 'Casey' }]) }))
vi.mock('@/lib/context/q-context', () => ({ useQContext: () => ({ userId: 'sample:alice' }) }))

import type { QRecord, QTableMetaData } from '@/types'
import { deleteSharedRecord, editSharedRecord, getSharedRecords, insertSharedRecord } from '@/lib/api/sharing'
import { ShareButton } from './ShareDialog'

const table = {
  name: 'savedReport', label: 'Report', primaryKeyField: 'id', fields: {}, sections: [],
  shareableTableMetaData: { thisTableOwnerIdFieldName: 'userId', audiencePossibleValueSourceName: 'sampleSharingAudience' },
} as unknown as QTableMetaData
const record = (owner: string): QRecord => ({ tableName: 'savedReport', recordLabel: 'Pet Species Report', values: { id: 1, userId: owner } })

describe('ShareButton', () => {
  beforeEach(() => {
    vi.mocked(getSharedRecords).mockReset().mockResolvedValue([])
    vi.mocked(insertSharedRecord).mockReset().mockResolvedValue()
    vi.mocked(editSharedRecord).mockReset().mockResolvedValue()
    vi.mocked(deleteSharedRecord).mockReset().mockResolvedValue()
  })

  it('is disabled with the reason for someone who does not own the record', () => {
    render(<ShareButton tableMetaData={table} record={record('sample:casey')} />)
    const button = screen.getByRole('button', { name: 'Share' })
    expect(button).toBeDisabled()
    expect(button).toHaveAccessibleDescription('Only the owner of a Report may share it.')
  })

  it('lets the owner share with an audience and scope, change the scope and remove the share', async () => {
    const user = userEvent.setup()
    render(<ShareButton tableMetaData={table} record={record('sample:alice')} />)
    await user.click(screen.getByRole('button', { name: 'Share' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Share Report: Pet Species Report' })).toBeInTheDocument()
    await within(dialog).findByRole('heading', { name: 'Current Shares (0)' })
    const share = within(dialog).getByRole('button', { name: 'Share' })
    expect(share).toBeDisabled()
    await waitFor(() => expect(within(dialog).getAllByRole('option').map((option) => option.textContent)).toContain('Bob'))
    await user.selectOptions(within(dialog).getByLabelText('User or Group'), 'user:sample:bob')
    await user.selectOptions(within(dialog).getByLabelText('Scope'), 'READ_WRITE')
    vi.mocked(getSharedRecords).mockResolvedValue([{ shareId: 9, scopeId: 'READ_WRITE', audienceType: 'user', audienceId: 'sample:bob', audienceLabel: 'Bob' }])
    await user.click(share)
    expect(insertSharedRecord).toHaveBeenCalledWith('savedReport', 1, 'user', 'sample:bob', 'READ_WRITE')
    await within(dialog).findByRole('heading', { name: 'Current Shares (1)' })
    await user.selectOptions(within(dialog).getByLabelText('Scope for Bob'), 'READ_ONLY')
    expect(editSharedRecord).toHaveBeenCalledWith('savedReport', 1, 9, 'READ_ONLY')
    await user.click(within(dialog).getByRole('button', { name: 'Remove share with Bob' }))
    expect(deleteSharedRecord).toHaveBeenCalledWith('savedReport', 1, 9)
  })

  it('shows a backend refusal inside the dialog', async () => {
    const user = userEvent.setup()
    vi.mocked(insertSharedRecord).mockRejectedValue(new Error('You are not the owner of this record, so you may not share it.'))
    render(<ShareButton tableMetaData={table} record={record('sample:alice')} />)
    await user.click(screen.getByRole('button', { name: 'Share' }))
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => expect(within(dialog).getAllByRole('option').map((option) => option.textContent)).toContain('Casey'))
    await user.selectOptions(within(dialog).getByLabelText('User or Group'), 'user:sample:casey')
    await user.click(within(dialog).getByRole('button', { name: 'Share' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Error sharing record: You are not the owner of this record')
  })
})
