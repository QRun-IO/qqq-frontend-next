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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import type { QAuditRecord, QTableMetaData } from '@/types'
import { useAuditRecords } from '@/lib/hooks/use-audit-records'
import { AuditHistoryDialog } from './AuditHistoryDialog'

vi.mock('@/lib/hooks/use-audit-records', () => ({ useAuditRecords: vi.fn() }))

const tableMetaData = { name: 'recordLab', label: 'Record Lab', fields: {} } as QTableMetaData
const records: QAuditRecord[] = [
  { id: 1, auditTableName: 'audit', recordId: 7, timestamp: '2026-01-05T18:00:00Z', user: 'Alice', action: 'UPDATE', message: 'First', fieldChanges: [] },
  { id: 2, auditTableName: 'audit', recordId: 7, timestamp: '2026-01-05T17:00:00Z', user: 'Bob', action: 'UPDATE', message: 'Second', fieldChanges: [] },
  { id: 3, auditTableName: 'audit', recordId: 7, timestamp: '2026-01-03T18:00:00Z', user: 'Alice', action: 'INSERT', message: 'Third', fieldChanges: [] },
]

beforeEach(() => {
  localStorage.clear()
  vi.mocked(useAuditRecords).mockReset()
  vi.mocked(useAuditRecords).mockReturnValue({
    auditRecords: records, total: 12, isLoading: false, isError: false, error: null, refetch: vi.fn(),
  } as unknown as ReturnType<typeof useAuditRecords>)
})

describe('AuditHistoryDialog', () => {
  it('groups audits by local date and reports a capped result', () => {
    render(<AuditHistoryDialog open onOpenChange={vi.fn()} source="process" tableMetaData={tableMetaData} primaryKey={7} recordLabel="Record 7" />)
    expect(screen.getByText('Showing first 3 of 12 audit details for this record')).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2)
  })

  it('restores and persists the selected audit sort direction', () => {
    localStorage.setItem('audit.sortDirection', 'true')
    render(<AuditHistoryDialog open onOpenChange={vi.fn()} source="process" tableMetaData={tableMetaData} primaryKey={7} recordLabel="Record 7" />)
    expect(vi.mocked(useAuditRecords)).toHaveBeenLastCalledWith(expect.objectContaining({ isSortAscending: true }))
    const descending = screen.getByRole('button', { name: 'Sort by time descending (newest to oldest)' })
    fireEvent.click(descending)
    expect(localStorage.getItem('audit.sortDirection')).toBe('false')
    expect(vi.mocked(useAuditRecords)).toHaveBeenLastCalledWith(expect.objectContaining({ isSortAscending: false }))
  })
})
