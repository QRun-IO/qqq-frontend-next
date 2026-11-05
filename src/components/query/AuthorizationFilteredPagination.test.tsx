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

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { QTableMetaData } from '@/types'
import { useRecordQuery } from '@/lib/hooks/use-record-query'
import { authorizationFilteredPagination, paginationSourceTables } from '@/lib/utils/query-pagination'
import { qInstance } from '@/mocks/fixtures/q-instance'
import { server } from '@/mocks/node'
import { RecordQueryContent } from './RecordQueryContent'

let client: QueryClient
let table: QTableMetaData
let sources: Record<string, QTableMetaData>

function Screen() {
  const rq = useRecordQuery({ tableName: table.name, tableMetaData: table, allTables: { [table.name]: table } })
  return <RecordQueryContent
    allTables={sources}
    tableName={table.name} tableMetaData={table} viewMode="card" activeFilterCount={0}
    {...rq.data} {...rq.pagination} {...rq.columns}
    sortOrder={rq.filter.sortOrder} onSortChange={rq.filter.setSort}
    onResetFilter={rq.filter.resetFilter} quickSearchTerm={rq.filter.quickSearchTerm}
    rowSelection={rq.selection.rowSelection} onRowSelectionChange={rq.selection.setRowSelection}
    onColumnWidthChange={rq.columns.setColumnWidth} density={rq.density}
    onPageChange={rq.pagination.setPage} onPageSizeChange={rq.pagination.setPageSize}
  />
}

beforeEach(() => {
  localStorage.clear()
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  table = { ...qInstance.tables.person, capabilities: ['TABLE_QUERY', 'TABLE_COUNT'], supplementalMetaData: {
    queryPagination: { authorizationFiltered: true },
  } }
  sources = { archive: { ...qInstance.tables.person, name: 'record_files_archive_source', label: 'Retained Source Archives', readPermission: true, isHidden: false,
    supplementalMetaData: { queryPagination: { sourceBrowser: true } } } }
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

afterEach(() => { cleanup(); client.clear(); vi.restoreAllMocks() })

it('requests one later page after an empty authorized page, permits back navigation, and never counts', async () => {
  const offsets: number[] = []
  let countCalls = 0
  let revoked = false
  server.use(
    http.post('*/qqq/v1/table/person/query', async ({ request }) => {
      const body = await request.json() as { filter: { skip?: number; limit: number } }
      const skip = body.filter.skip ?? 0
      offsets.push(skip)
      expect(body.filter.limit).toBe(50)
      return HttpResponse.json({ records: skip === 50 && !revoked ? [{ tableName: 'person', recordLabel: 'Visible later', values: { id: 99, firstName: 'Visible later' } }] : [] })
    }),
    http.post('*/qqq/v1/table/person/count', () => { countCalls++; return HttpResponse.json({ count: 999 }) }),
  )
  render(<QueryClientProvider client={client}><Screen /></QueryClientProvider>)
  expect(await screen.findByText('No authorized records on this page')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled()
  expect(screen.getByText('0 visible records on page 1')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Retained Source Archives' })).toHaveAttribute('href', '/app/record_files_archive_source')
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
  await waitFor(() => expect(screen.getByText('1 visible records on page 2')).toBeInTheDocument())
  expect(offsets).toEqual([0, 50])
  expect(countCalls).toBe(0)
  revoked = true
  fireEvent.click(screen.getByRole('button', { name: 'Previous page' }))
  await waitFor(() => expect(screen.getByText('0 visible records on page 1')).toBeInTheDocument())
  await waitFor(() => expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
  await waitFor(() => expect(screen.getByText('0 visible records on page 2')).toBeInTheDocument())
  expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled()
  expect(countCalls).toBe(0)
})

it('preserves ordinary empty tables and rejects a truthy string opt-in', async () => {
  table = { ...table, supplementalMetaData: { queryPagination: { authorizationFiltered: 'true' } } }
  server.use(http.post('*/qqq/v1/table/person/query', () => HttpResponse.json({ records: [] })),
    http.post('*/qqq/v1/table/person/count', () => HttpResponse.json({ count: 0 })))
  render(<QueryClientProvider client={client}><Screen /></QueryClientProvider>)
  expect(await screen.findByText('No records found')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Next page' })).not.toBeInTheDocument()
  expect(screen.queryByText(/Completeness is unknown/)).not.toBeInTheDocument()
})

it('does not turn malformed navigation metadata into arbitrary links', () => {
  sources.denied = { ...sources.archive, name: 'denied', readPermission: false }
  sources.hidden = { ...sources.archive, name: 'hidden', isHidden: true }
  sources.bad = { ...sources.archive, name: '../secret' }
  sources.missing = { ...sources.archive, name: undefined } as unknown as QTableMetaData
  sources.nullName = { ...sources.archive, name: null } as unknown as QTableMetaData
  sources.truthyRead = { ...sources.archive, readPermission: 'true' } as unknown as QTableMetaData
  sources.truthySource = { ...sources.archive, supplementalMetaData: { queryPagination: { sourceBrowser: 'true' } } }
  expect(paginationSourceTables(sources)).toEqual([sources.archive])
  expect(authorizationFilteredPagination(undefined)).toBe(false)
})
