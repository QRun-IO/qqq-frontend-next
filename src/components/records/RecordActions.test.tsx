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

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { qInstance } from '@/mocks/fixtures/q-instance'
import { RecordActions } from './RecordActions'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

describe('Copy routes preserve exact table and record identifiers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('encodes Copy identifiers in the quick action', () => {
    const table = { ...qInstance.tables.company, name: 'company / notes', editPermission: false, deletePermission: false }
    render(<RecordActions tableMetaData={table}
      record={{ tableName: table.name, values: { id: 'A/B?#%雪' } }}
      actionEntries={[]} resolveMenu={() => []} onAction={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy Companies record' }))
    expect(push).toHaveBeenCalledWith('/app/company%20%2F%20notes/A%2FB%3F%23%25%E9%9B%AA/copy')
  })

  it('delegates a metadata Copy menu item to the shared action handler', async () => {
    const table = { ...qInstance.tables.company, editPermission: false, deletePermission: false }
    const onAction = vi.fn()
    render(<RecordActions tableMetaData={table}
      record={{ tableName: table.name, values: { id: 3 } }}
      actionEntries={[{ kind: 'item', key: 'copy', label: 'Copy', id: 'copy', action: { type: 'copy' } }]}
      resolveMenu={() => []} onAction={onAction} />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Record actions menu' }), { key: 'Enter' })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Copy' }))
    expect(onAction).toHaveBeenCalledWith({ type: 'copy' })
  })
})
