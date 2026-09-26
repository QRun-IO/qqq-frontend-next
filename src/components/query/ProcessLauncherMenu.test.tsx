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

// Material CSS hooks on the query screen's actions menu (QRun-IO/qqq#731).

import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { QProcessMetaData, QTableMetaData } from '@/types'
import { ProcessLauncherMenu } from './ProcessLauncherMenu'

const table = {
  name: 'person', label: 'Person', primaryKeyField: 'id', fields: {},
  capabilities: ['TABLE_QUERY', 'TABLE_UPDATE', 'TABLE_DELETE'], editPermission: true, deletePermission: true,
} as unknown as QTableMetaData
const process = (name: string, label: string, extra: Partial<QProcessMetaData> = {}) =>
  ({ name, label, tableName: 'person', isHidden: false, hasPermission: true, ...extra }) as QProcessMetaData

describe('ProcessLauncherMenu Material CSS hooks', () => {
  it('wraps each item in a layout-neutral menu-item-{sanitized label} hook', () => {
    const allProcesses = {
      'person.bulkEdit': process('person.bulkEdit', 'Edit People', { isHidden: true }),
      'person.bulkDelete': process('person.bulkDelete', 'Delete People', { isHidden: true }),
      greet: process('greet', 'Greet People!'),
    }
    render(<ProcessLauncherMenu tableMetaData={table} allProcesses={allProcesses} processes={[allProcesses.greet]}
      selectionCount={1} onLaunch={vi.fn()} onBlocked={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }))
    const hooks = [...screen.getByRole('menu').querySelectorAll('[data-qqq-id^="menu-item-"]')]
    expect(hooks.map((hook) => hook.getAttribute('data-qqq-id'))).toEqual(['menu-item-bulk-edit', 'menu-item-bulk-delete', 'menu-item-greet-people'])
    expect(hooks.every((hook) => hook.classList.contains('contents') && hook.getAttribute('role') === 'none')).toBe(true)
    expect(hooks[2]).toContainElement(screen.getByRole('menuitem', { name: 'Greet People!' }))
    // Next's own item id stays for tests
    expect(screen.getByRole('menuitem', { name: 'Greet People!' })).toHaveAttribute('data-qqq-id', 'process-launcher-item-greet')
  })
})
