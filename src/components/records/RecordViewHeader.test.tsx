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
// Phone action sheet: focus management and routes (QRun-IO/qqq#694, #649)

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { QTableMetaData } from '@/types'
import { RecordViewHeader } from './RecordViewHeader'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const table = {
  name: 'person', label: 'Person', primaryKeyField: 'id', fields: { id: { name: 'id', label: 'Id', type: 'INTEGER' } },
  insertPermission: true, editPermission: true, deletePermission: true, readPermission: true,
  capabilities: ['TABLE_QUERY', 'TABLE_GET', 'TABLE_INSERT', 'TABLE_UPDATE', 'TABLE_DELETE'],
} as unknown as QTableMetaData

function renderHeader() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <RecordViewHeader
        tableMetaData={table}
        record={{ tableName: 'person', values: { id: 5 }, recordLabel: 'Morgan Sample' }}
        t1Fields={[]}
        viewMode="tabs"
        setViewMode={vi.fn()}
        hideActions={false}
        navigateFrom={{ path: '/app/person', label: 'Person' }}
      />
    </QueryClientProvider>
  )
}

describe('RecordViewHeader phone action sheet', () => {
  beforeEach(() => vi.clearAllMocks())

  it('moves focus into the sheet, and Escape closes it back onto the trigger', async () => {
    const user = userEvent.setup()
    renderHeader()
    const trigger = screen.getByRole('button', { name: 'Record actions' })
    await user.click(trigger)
    expect(screen.getByRole('button', { name: 'Close actions menu' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Record actions' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('returns focus to the trigger when the delete dialog opened from the sheet closes', async () => {
    const user = userEvent.setup()
    renderHeader()
    const trigger = screen.getByRole('button', { name: 'Record actions' })
    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: 'Delete Person' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
    expect(document.body).not.toHaveFocus()
  })
})
