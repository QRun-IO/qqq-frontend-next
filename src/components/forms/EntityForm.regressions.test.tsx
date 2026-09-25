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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { QFieldMetaData, QRecord, QTableMetaData } from '@/types'
import apiClient from '@/lib/api/client'
import { EntityForm } from './EntityForm'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }))

function field(name: string, extra: Partial<QFieldMetaData> = {}): QFieldMetaData {
  return { name, label: name[0].toUpperCase() + name.slice(1), type: 'STRING', isRequired: false, isEditable: true, isHeavy: false, isHidden: false, adornments: [], ...extra }
}

const table: QTableMetaData = {
  name: 'lab', label: 'Lab', isHidden: false, primaryKeyField: 'id',
  fields: {
    id: field('id', { type: 'INTEGER', isEditable: false }),
    title: field('title', { isRequired: true, maxLength: 4 }),
    secret: field('secret', { type: 'PASSWORD' }),
    big: field('big', { type: 'LONG' }),
    stamp: field('stamp', { type: 'DATE_TIME' }),
    owner: field('owner', { type: 'STRING' }),
    flag: field('flag', { type: 'BOOLEAN', defaultValue: 'true' }),
    createDate: field('createDate', { type: 'DATE_TIME', isEditable: false }),
  },
  sections: [{ name: 'main', label: 'Main', isHidden: false, fieldNames: ['id', 'title', 'secret', 'big', 'stamp', 'owner', 'flag', 'createDate'] }],
  capabilities: [], exposedJoins: [], readPermission: true, insertPermission: true, editPermission: true, deletePermission: true,
  usesVariants: false, variantTableLabel: '',
}

const stored: QRecord = {
  tableName: 'lab',
  values: { id: 7, title: 'Old', secret: '************', big: 9007199254740992, stamp: '2024-07-04T13:15:00.123456Z', owner: 'sample:bob', flag: false, createDate: '2024-01-01T00:00:00Z' },
  displayValues: { id: '7', title: 'Old', secret: '************', big: '9007199254740993', stamp: '2024-07-04T13:15:00.123456Z', owner: 'sample:bob', flag: 'No', createDate: '2024-01-01T00:00:00Z' },
}

function renderForm(record?: QRecord) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><EntityForm tableMetaData={table} record={record} /></QueryClientProvider>)
}

describe('Record form regressions (#649)', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('keeps focus while typing so a field does not remount when it becomes dirty', async () => {
    const user = userEvent.setup()
    renderForm(stored)
    const title = screen.getByLabelText(/^Title/)
    await user.clear(title)
    await user.type(title, 'Newer title')
    expect(title).toHaveFocus()
    expect(title).toHaveValue('Newer title')
  })

  it('edit never re-sends a masked password, a LONG, an unchanged date-time or read-only values', async () => {
    const user = userEvent.setup()
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue({ records: [{ tableName: 'lab', values: { id: 7 } }] })
    renderForm(stored)
    expect(screen.getByLabelText(/^Secret/)).toHaveValue('')
    expect(screen.getByLabelText(/^Id/)).toBeDisabled()
    const title = screen.getByLabelText(/^Title/)
    await user.clear(title)
    // Record forms leave maxLength to the server's too-long policy.
    await user.type(title, 'Longer than four')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1))
    const body = put.mock.calls[0][1] as FormData
    expect(Object.fromEntries(body.entries())).toEqual({ title: 'Longer than four', owner: 'sample:bob', flag: 'false' })
  })

  it('sends a changed date-time as the UTC instant and a typed LONG exactly', async () => {
    const user = userEvent.setup()
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue({ records: [{ tableName: 'lab', values: { id: 7 } }] })
    renderForm(stored)
    fireEvent.change(screen.getByLabelText(/^Big/), { target: { value: '9007199254740993' } })
    fireEvent.change(screen.getByLabelText(/^Stamp/), { target: { value: '2024-01-15T09:15' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1))
    const body = put.mock.calls[0][1] as FormData
    expect(body.get('big')).toBe('9007199254740993')
    expect(body.get('stamp')).toBe(new Date(2024, 0, 15, 9, 15).toISOString().replace(/\.\d{3}Z$/, 'Z'))
  })

  it('create applies metadata defaults and shows the backend error message once, keeping the values', async () => {
    const user = userEvent.setup()
    const error = new AxiosError('Request failed with status code 400', 'ERR_BAD_REQUEST', undefined, undefined,
      { status: 400, statusText: '', headers: {}, config: { headers: new AxiosHeaders() }, data: { error: 'Error inserting Lab: Another record already exists with this Title' } })
    const post = vi.spyOn(apiClient, 'post').mockRejectedValue(error)
    renderForm()
    expect(screen.getByRole('checkbox', { name: 'Flag' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByLabelText(/^Id/)).toBeNull()
    await user.type(screen.getByLabelText(/^Title/), 'Dupe')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    expect((post.mock.calls[0][1] as FormData).get('flag')).toBe('true')
    expect(await screen.findByText('Error inserting Lab: Another record already exists with this Title')).toBeVisible()
    expect(screen.getByLabelText(/^Title/)).toHaveValue('Dupe')
  })
})
