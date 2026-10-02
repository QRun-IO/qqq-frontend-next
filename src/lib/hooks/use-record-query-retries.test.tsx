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

// Tests for useRecordQuery hook

import { setTimeout as realSetTimeout } from 'node:timers'
import { act, cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { QTableMetaData } from '@/types'
import { RecordQueryContent } from '@/components/query/RecordQueryContent'
import { queryClient, queryKeys } from '@/lib/query-client'
import { getErrorStatusCode } from '@/lib/utils/error-utils'
import { qInstance } from '@/mocks/fixtures/q-instance'
import { server } from '@/mocks/node'
import { useRecordQuery } from './use-record-query'

const table: QTableMetaData = { ...qInstance.tables.person, capabilities: ['TABLE_QUERY', 'TABLE_COUNT'] }
const options = { tableName: table.name, tableMetaData: table, allTables: { [table.name]: table } }
const records = [{ tableName: table.name, recordLabel: 'Recovered row', values: { id: 1, firstName: 'Recovered row' } }]

function Wrapper({ children }: { children: React.ReactNode }) {
  // Use the production client, including its retry predicate, delay and error cache callbacks.
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function QueryContent() {
  const rq = useRecordQuery(options)
  return <RecordQueryContent
    tableName={table.name} tableMetaData={table} viewMode="card" activeFilterCount={0}
    {...rq.data} {...rq.pagination} {...rq.columns}
    sortOrder={rq.filter.sortOrder} onSortChange={rq.filter.setSort}
    onResetFilter={rq.filter.resetFilter} quickSearchTerm={rq.filter.quickSearchTerm}
    rowSelection={rq.selection.rowSelection} onRowSelectionChange={rq.selection.setRowSelection}
    onColumnWidthChange={rq.columns.setColumnWidth} density={rq.density}
    onPageChange={rq.pagination.setPage} onPageSizeChange={rq.pagination.setPageSize}
  />
}

// Hold each real HTTP response independently, including the last automatic attempt.
function controlledEndpoint(endpoint: 'query' | 'count') {
  const responses: Array<(response: Response) => void> = []
  server.use(http.post(`*/qqq/v1/table/${table.name}/${endpoint}`, () =>
    new Promise<Response>((resolve) => { responses.push(resolve) })))
  return responses
}

// Flush HTTP/React work without advancing the retry clock. Real IO can require
// another event-loop turn; only zero-duration fake timers (query notifications) run.
async function settle(assertion: () => void) {
  for (let turn = 0; turn < 100; turn++) {
    await act(async () => {
      await new Promise<void>((resolve) => { realSetTimeout(resolve, 1) })
      await vi.advanceTimersByTimeAsync(0)
    })
    try { assertion(); return } catch (error) { if (turn === 99) throw error }
  }
}

async function advance(milliseconds: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(milliseconds) })
}

function failureCount(endpoint: 'query' | 'count') {
  return queryClient.getQueryCache().findAll({ queryKey: queryKeys.tableRecords(table.name) })
    .find((query) => query.queryKey[3] === endpoint)?.state.fetchFailureCount
}

async function exhaustServerErrors(responses: Array<(response: Response) => void>, endpoint: 'query' | 'count', message: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await settle(() => { expect(responses).toHaveLength(attempt + 1) })
    responses[attempt](HttpResponse.json({ error: message }, { status: 500 }))
    await settle(() => { expect(failureCount(endpoint)).toBe(attempt + 1) })
    if (attempt < 3) await advance([1000, 2000, 4000][attempt])
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  queryClient.clear()
  localStorage.clear()
  server.use(
    http.post(`*/qqq/v1/table/${table.name}/query`, () => HttpResponse.json({ records })),
    http.post(`*/qqq/v1/table/${table.name}/count`, () => HttpResponse.json({ count: 1 })),
  )
})

afterEach(() => {
  cleanup()
  queryClient.clear()
  vi.useRealTimers()
})

describe('record query production retry lifecycle', () => {
  it('waits for the first attempt and three retries before an accessible terminal error, then recovers through Retry', async () => {
    const responses = controlledEndpoint('query')
    render(<QueryContent />, { wrapper: Wrapper })
    for (const [attempt, delay] of [1000, 2000, 4000].entries()) {
      await settle(() => { expect(responses).toHaveLength(attempt + 1) })
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      responses[attempt](HttpResponse.json({ error: 'Database query unavailable' }, { status: 500 }))
      await settle(() => { expect(failureCount('query')).toBe(attempt + 1) })
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      await advance(delay - 1)
      expect(responses).toHaveLength(attempt + 1)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      await advance(1)
    }
    await settle(() => { expect(responses).toHaveLength(4) })
    // A slow final response is still pending; reaching attempt four is not terminal.
    await advance(5000)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText('No records found')).not.toBeInTheDocument()
    responses[3](HttpResponse.json({ error: 'Database query unavailable' }, { status: 500 }))
    await settle(() => { expect(screen.getByRole('alert')).toHaveTextContent('Database query unavailable') })
    const alert = screen.getByRole('alert')
    expect(within(alert).getByRole('button', { name: 'Dismiss' })).toBeEnabled()
    await advance(8000)
    expect(responses).toHaveLength(4)
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
    await settle(() => { expect(responses).toHaveLength(5) })
    responses[4](HttpResponse.json({ records }))
    await settle(() => { expect(screen.getByRole('heading', { name: 'Recovered row' })).toBeInTheDocument() })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  })

  it('dismisses only the current terminal error without retrying or hiding a later distinct failure', async () => {
    const responses = controlledEndpoint('query')
    const view = render(<QueryContent />, { wrapper: Wrapper })
    await exhaustServerErrors(responses, 'query', 'First backend failure')
    await settle(() => { expect(screen.getByRole('alert')).toHaveTextContent('First backend failure') })
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    view.rerender(<QueryContent />)
    await advance(8000)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(responses).toHaveLength(4)
    act(() => { void queryClient.invalidateQueries({ queryKey: queryKeys.tableRecords(table.name) }) })
    await settle(() => { expect(responses).toHaveLength(5) })
    // Keep the same controlled handler and collect subsequent retry responses.
    for (let attempt = 0; attempt < 4; attempt++) {
      await settle(() => { expect(responses).toHaveLength(5 + attempt) })
      responses[4 + attempt](HttpResponse.json({ error: 'Later backend failure' }, { status: 500 }))
      await settle(() => { expect(failureCount('query')).toBe(attempt + 1) })
      if (attempt < 3) await advance([1000, 2000, 4000][attempt])
    }
    await settle(() => { expect(screen.getByRole('alert')).toHaveTextContent('Later backend failure') })
    expect(screen.queryByText('First backend failure')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
  })

  it('keeps successful records when the separate count exhausts its server-error retries', async () => {
    const responses = controlledEndpoint('count')
    const { result } = renderHook(() => useRecordQuery(options), { wrapper: Wrapper })
    await settle(() => { expect(result.current.data.records).toEqual(records) })
    await exhaustServerErrors(responses, 'count', 'Count temporarily unavailable')
    await settle(() => { expect(result.current.data.countError?.message).toBe('Count temporarily unavailable') })
    expect(result.current.data.records).toEqual(records)
    expect(result.current.data.isError).toBe(false)
    expect(result.current.data.error).toBeNull()
    expect(result.current.data.isLoading).toBe(false)
    expect(getErrorStatusCode(result.current.data.countError)).toBe(500)
    await advance(8000)
    expect(responses).toHaveLength(4)
  })

  it.each([403, 404])('shows HTTP %i immediately without an automatic retry', async (status) => {
    const responses = controlledEndpoint('query')
    render(<QueryContent />, { wrapper: Wrapper })
    await settle(() => { expect(responses).toHaveLength(1) })
    responses[0](HttpResponse.json({ error: 'Backend access detail' }, { status }))
    await settle(() => { expect(screen.getByRole('alert')).toHaveTextContent('Backend access detail') })
    expect(screen.getByRole('alert')).toHaveTextContent(status === 403
      ? 'You do not have permission to view these records.' : 'This table could not be found.')
    await advance(7000)
    expect(responses).toHaveLength(1)
  })
})
