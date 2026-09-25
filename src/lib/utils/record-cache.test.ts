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

import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryObserver } from '@tanstack/react-query'

import { queryKeys } from '@/lib/query-client'
import { forgetDeletedRecord, isRecordQuery } from './record-cache'

describe('forgetDeletedRecord (#541)', () => {
  it('never refetches the deleted record, even when its view still observes it under the string route key', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
    const readRecord = vi.fn().mockResolvedValue({ tableName: 'person', values: { id: 5 } })
    const readList = vi.fn().mockResolvedValue({ records: [] })
    const viewKey = [...queryKeys.tableRecord('person', '5'), { includeAssociations: false }]
    const observer = new QueryObserver(client, { queryKey: viewKey, queryFn: readRecord })
    const unsubscribe = observer.subscribe(() => undefined)
    await vi.waitFor(() => expect(readRecord).toHaveBeenCalledTimes(1))
    await client.fetchQuery({ queryKey: [...queryKeys.tableRecord('person', '5'), { includeAssociations: true }], queryFn: readRecord })
    await client.fetchQuery({ queryKey: [...queryKeys.tableRecords('person'), 'query', 'hash'], queryFn: readList })
    await client.fetchQuery({ queryKey: [...queryKeys.tableRecord('person', 6), { includeAssociations: false }], queryFn: readRecord })
    expect(readRecord).toHaveBeenCalledTimes(3)

    // The record's own value holds the numeric key; the route used the string.
    await forgetDeletedRecord(client, 'person', 5)

    expect(readRecord).toHaveBeenCalledTimes(3)
    expect(client.getQueryCache().find({ queryKey: viewKey, exact: true })?.state.isInvalidated).toBe(true)
    expect(client.getQueryCache().find({ queryKey: [...queryKeys.tableRecord('person', '5'), { includeAssociations: true }], exact: true })).toBeUndefined()
    expect(client.getQueryCache().find({ queryKey: [...queryKeys.tableRecords('person'), 'query', 'hash'], exact: true })?.state.isInvalidated).toBe(true)
    // Another record of the table stays cached (marked stale for its next mount).
    expect(client.getQueryCache().find({ queryKey: [...queryKeys.tableRecord('person', 6), { includeAssociations: false }], exact: true })).toBeDefined()
    unsubscribe()
  })

  it('matches a record key regardless of the primary key form and ignores other tables and counts', () => {
    const client = new QueryClient()
    const cache = client.getQueryCache()
    const make = (key: readonly unknown[]) => cache.build(client, { queryKey: key })
    expect(isRecordQuery(make(queryKeys.tableRecord('person', '5')), 'person', 5)).toBe(true)
    expect(isRecordQuery(make([...queryKeys.tableRecord('person', 5), 'audits']), 'person', '5')).toBe(true)
    expect(isRecordQuery(make(queryKeys.tableRecord('pet', 5)), 'person', 5)).toBe(false)
    expect(isRecordQuery(make(queryKeys.tableCount('person', '5')), 'person', 5)).toBe(false)
  })
})
