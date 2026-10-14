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
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { axe } from 'jest-axe'
import { getQueryColumns } from '@/lib/utils/query-columns'
import type { QTableMetaData } from '@/types'
import { ColumnHeaderMenu } from './ColumnHeaderMenu'
import { METADATA } from '../../../tests/e2e/api-mocks'

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(cleanup)
const column = getQueryColumns(METADATA.tables.person as unknown as QTableMetaData).find(
  (c) => c.name === 'status'
)!
const actions = {
  onSort: vi.fn(),
  onHide: vi.fn(),
  onPin: vi.fn(),
  onCopyPageValues: vi.fn(),
  onCopyFullQueryValues: vi.fn(),
  onColumnStats: vi.fn(),
}

it.each([
  { allowed: false, fields: ['status'], visible: false },
  { allowed: true, fields: [], visible: false },
  { allowed: true, fields: ['id'], visible: false },
  { allowed: true, fields: ['status'], visible: true },
])(
  'shows Analyze only with permission and a listed field: %j',
  async ({ allowed, fields, visible }) => {
    const onAnalyze = vi.fn()
    render(
      <ColumnHeaderMenu
        column={column}
        hasRows
        {...actions}
        onAnalyze={allowed ? onAnalyze : undefined}
        analyzeFields={fields}
      />
    )
    fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' })
    await screen.findByRole('menu')
    expect(Boolean(screen.queryByRole('menuitem', { name: 'Analyze' }))).toBe(visible)
    expect(screen.getByRole('menuitem', { name: 'Column statistics' })).toBeVisible()
    expect(await axe(screen.getByRole('menu'))).toHaveNoViolations()
    if (visible) {
      expect(screen.getByRole('menuitem', { name: 'Analyze' })).toHaveAttribute(
        'data-qqq-id',
        'column-menu-analyze'
      )
      fireEvent.click(screen.getByRole('menuitem', { name: 'Analyze' }))
      expect(onAnalyze).toHaveBeenCalledWith('status', 'Status')
    }
  }
)
