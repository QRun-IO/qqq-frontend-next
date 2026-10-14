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

import { describe, expect, it } from 'vitest'

import type { QTableMetaData } from '@/types'

import { emptyStateText } from './RecordQueryContent'

const table = (helpContents?: QTableMetaData['helpContents']) => ({ name: 'assistant_budget', label: 'Budgets', helpContents } as QTableMetaData)

describe('emptyStateText', () => {
  it('explains an empty, unfiltered table from its help slot', () => {
    const text = emptyStateText(table({ help: [{ content: 'Spending limits.\n\n**How rows get created:** the qbit seeds one.', format: 'MARKDOWN', roles: ['ALL_SCREENS'] }] }), false)
    expect(text).toEqual({ title: 'No Budgets yet', description: 'Spending limits. How rows get created: the qbit seeds one.', wideDescription: true })
  })

  it('suggests changing filters when filtered, even with help', () => {
    const text = emptyStateText(table({ help: [{ content: 'Spending limits.', roles: ['ALL_SCREENS'] }] }), true)
    expect(text.title).toBe('No records found')
    expect(text.description).toBe('Try adjusting your filters or search term.')
  })

  it('keeps the generic text without help or with help for other screens only', () => {
    expect(emptyStateText(table(), false).title).toBe('No records found')
    expect(emptyStateText(table({ help: [{ content: 'Edit only.', roles: ['EDIT_SCREEN'] }] }), false).title).toBe('No records found')
  })
})
