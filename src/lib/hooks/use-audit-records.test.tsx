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

// Tests for useAuditRecords and the audit API (GetAuditsForRecord process, audit table fallback)

import { beforeEach, describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

import type { QInstance, QRecord } from '@/types'
import apiClient from '@/lib/api/client'
import { auditSource, groupAuditRows } from '@/lib/api/audits'
import { useAuditRecords } from './use-audit-records'

vi.mock('@/lib/api/client', () => ({ default: { post: vi.fn(), get: vi.fn() } }))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

function auditRow(id: number, message: string, detail?: { id: number; fieldName: string; message: string; oldValue?: string | null; newValue?: string | null }): QRecord {
  return {
    tableName: 'audit',
    values: {
      id, recordId: 7, message, timestamp: `2026-01-0${id}T10:00:00Z`, auditUserId: 3,
      ...(detail ? { 'auditDetail.id': detail.id, 'auditDetail.fieldName': detail.fieldName, 'auditDetail.message': detail.message,
        'auditDetail.oldValue': detail.oldValue ?? null, 'auditDetail.newValue': detail.newValue ?? null } : {}),
    },
    displayValues: { auditUserId: 'Alice (sample)', auditTableId: 'Record Lab' },
  }
}

const rows = [
  auditRow(2, 'Record was Edited', { id: 5, fieldName: 'title', message: 'Changed Title from "A" to "B"', oldValue: 'A', newValue: 'B' }),
  auditRow(2, 'Record was Edited', { id: 6, fieldName: 'hint', message: 'Removed "x" from Hint', oldValue: 'x' }),
  auditRow(1, 'Record was Inserted'),
]

beforeEach(() => vi.mocked(apiClient.post).mockReset())

describe('groupAuditRows', () => {
  it('groups detail rows into one entry per audit, keeping order and backend sentences', () => {
    const entries = groupAuditRows(rows)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({ id: 2, user: 'Alice (sample)', action: 'UPDATE', message: 'Record was Edited', auditTableName: 'Record Lab' })
    expect(entries[0].fieldChanges.map((change) => change.message)).toEqual(['Changed Title from "A" to "B"', 'Removed "x" from Hint'])
    expect(entries[1]).toMatchObject({ id: 1, action: 'INSERT', fieldChanges: [] })
  })
})

describe('auditSource', () => {
  const base = { tables: {}, processes: {} } as unknown as QInstance
  it('prefers the process, falls back to the audit table, and reports none otherwise', () => {
    expect(auditSource({ ...base, processes: { GetAuditsForRecord: { hasPermission: true } } } as unknown as QInstance)).toBe('process')
    expect(auditSource({ ...base, processes: { GetAuditsForRecord: { hasPermission: false } }, tables: { audit: { readPermission: true } } } as unknown as QInstance)).toBe('table')
    expect(auditSource({ ...base, tables: { audit: { readPermission: false } } } as unknown as QInstance)).toBeNull()
    expect(auditSource(base)).toBeNull()
  })
})

describe('useAuditRecords', () => {
  it('runs GetAuditsForRecord for the record and groups its rows', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ type: 'COMPLETE', values: { audits: rows } })
    const { result } = renderHook(
      () => useAuditRecords({ source: 'process', tableName: 'recordLab', primaryKey: 7 }),
      { wrapper: createWrapper() }
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isError).toBe(false)
    expect(result.current.auditRecords).toHaveLength(2)
    const [url, body] = vi.mocked(apiClient.post).mock.calls[0]
    expect(url).toBe('/processes/GetAuditsForRecord/init')
    expect(JSON.parse((body as FormData).get('values') as string)).toEqual({ tableName: 'recordLab', recordId: '7', isSortAscending: false, limit: 1000 })
  })

  it('queries the audit table joined to its details without process permission', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ records: rows })
    const { result } = renderHook(
      () => useAuditRecords({ source: 'table', tableName: 'recordLab', primaryKey: 7 }),
      { wrapper: createWrapper() }
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.auditRecords[0].fieldChanges).toHaveLength(2)
    const [url, body] = vi.mocked(apiClient.post).mock.calls[0]
    expect(url).toBe('/table/audit/query')
    expect(body).toMatchObject({
      filter: { criteria: [{ fieldName: 'auditTable.name', values: ['recordLab'] }, { fieldName: 'recordId', values: ['7'] }], limit: 1000 },
      joins: [{ joinTable: 'auditTable' }, { joinTable: 'auditDetail', type: 'LEFT', select: true }],
    })
  })

  it('reports a process error instead of an empty history', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ type: 'ERROR', error: 'boom' })
    const { result } = renderHook(
      () => useAuditRecords({ source: 'process', tableName: 'recordLab', primaryKey: 7 }),
      { wrapper: createWrapper() }
    )
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toBe('boom')
  })

  it('does not load when disabled or when no audit source is available', () => {
    const disabled = renderHook(
      () => useAuditRecords({ source: 'process', tableName: 'person', primaryKey: 1, enabled: false }),
      { wrapper: createWrapper() }
    )
    const unavailable = renderHook(
      () => useAuditRecords({ source: null, tableName: 'person', primaryKey: 1 }),
      { wrapper: createWrapper() }
    )
    expect(disabled.result.current.auditRecords).toEqual([])
    expect(unavailable.result.current.auditRecords).toEqual([])
    expect(apiClient.post).not.toHaveBeenCalled()
  })
})
