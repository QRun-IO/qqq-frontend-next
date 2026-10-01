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

describe('Material CSS hooks (QRun-IO/qqq#731)', () => {
  beforeEach(() => vi.clearAllMocks())

  const table = { ...qInstance.tables.company, name: 'salesOrder', editPermission: true, deletePermission: true, insertPermission: true }
  const record = { tableName: 'salesOrder', values: { id: 7 }, recordLabel: 'Order 7' }

  it('marks the button bar and quick action variants like Material', () => {
    render(<RecordActions tableMetaData={table} record={record} actionEntries={[]} resolveMenu={() => []} onAction={vi.fn()} />)
    const bar = document.querySelector('[data-qqq-id="record-view-button-bar-salesorder"]')
    expect(bar?.querySelector('[data-qqq-id="button-edit"]')).toHaveAttribute('data-button-variant', 'gradient')
    expect(bar?.querySelector('[data-qqq-id="button-delete"]')).toHaveAttribute('data-button-variant', 'contained')
  })

  it('marks the actions menu, its trigger and its items like Material', async () => {
    const entries = [
      { kind: 'item' as const, key: 'edit', label: 'Edit', id: 'edit', action: { type: 'edit' as const } },
      { kind: 'item' as const, key: 'copy', label: 'Copy', id: 'copy', action: { type: 'copy' as const } },
      { kind: 'item' as const, key: 'process', label: qInstance.processes.fulfillOrder.label, id: qInstance.processes.fulfillOrder.name, action: { type: 'runProcess' as const, process: qInstance.processes.fulfillOrder } },
      { kind: 'item' as const, key: 'delete', label: 'Delete', id: 'delete', action: { type: 'delete' as const } },
    ]
    render(<RecordActions tableMetaData={table} record={record} actionEntries={entries} resolveMenu={() => []} onAction={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: 'Record actions menu' })
    expect(trigger).toHaveAttribute('data-qqq-id', 'button-actions-menu')
    expect(trigger).toHaveAttribute('data-button-variant', 'outlined')
    expect(trigger.closest('[data-qqq-id="record-view-actions-menu-button"]')).toHaveClass('contents')
    fireEvent.keyDown(trigger, { key: 'Enter' })
    const menu = await screen.findByRole('menu')
    expect(menu).toHaveAttribute('data-qqq-id', 'record-view-actions-menu')
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveAttribute('data-qqq-id', 'menu-item-edit')
    expect(screen.getByRole('menuitem', { name: 'Copy' })).toHaveAttribute('data-qqq-id', 'menu-item-copy')
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveAttribute('data-qqq-id', 'menu-item-delete')
    expect(screen.getByRole('menuitem', { name: qInstance.processes.fulfillOrder.label })).toHaveAttribute(
      'data-qqq-id', `menu-item-${qInstance.processes.fulfillOrder.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`)
  })
})
