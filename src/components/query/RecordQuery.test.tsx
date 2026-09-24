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

import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import type { QTableMetaData } from '@/types'
import type { QueryRecordsRequest } from '@/lib/api/tables'
import { useRecordQuery, type SavedView } from '@/lib/hooks/use-record-query'
import { getErrorStatusCode } from '@/lib/utils/error-utils'
import { qInstance } from '@/mocks/fixtures/q-instance'
import { server } from '@/mocks/node'
import { RecordQuery } from './RecordQuery'

const records = [{ tableName: 'person', recordLabel: 'Alice', values: { id: 1, firstName: 'Alice' } }]

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

function makeOptions() {
  const allTables = structuredClone(qInstance.tables)
  allTables.order.readPermission = false
  allTables.person.exposedJoins = [
    { label: 'Orders', isMany: true, joinTable: allTables.order },
    {
      label: 'Order Lines', isMany: true, joinTable: allTables.orderLine,
      joinPath: [
        { name: 'personOrder', type: 'ONE_TO_MANY', leftTable: 'person', rightTable: 'order' },
        { name: 'lineOrder', type: 'MANY_TO_ONE', leftTable: 'orderLine', rightTable: 'order' },
      ],
    },
    { label: 'Company', isMany: false, joinTable: allTables.company },
    {
      label: 'Suppliers', isMany: true, joinTable: allTables.supplier,
      joinPath: [
        { name: 'personCompany', type: 'MANY_TO_ONE', leftTable: 'person', rightTable: 'company' },
        { name: 'companySupplier', type: 'ONE_TO_MANY', leftTable: 'company', rightTable: 'supplier' },
      ],
    },
  ]
  return { tableName: 'person', tableMetaData: allTables.person, allTables }
}

function captureRequests(deny: (body: QueryRecordsRequest, action: string) => boolean = () => false) {
  const requests: { body: QueryRecordsRequest; action: string }[] = []
  server.use(http.post('/qqq/v1/table/person/:action', async ({ request, params }) => {
    const body = await request.json() as QueryRecordsRequest
    const action = String(params.action)
    requests.push({ body, action })
    if (deny(body, action)) return HttpResponse.json({ error: 'Permission denied' }, { status: 403 })
    return HttpResponse.json(action === 'query' ? { records } : { count: 1 })
  }))
  return requests
}

describe('RecordQuery joined read permissions', () => {
  beforeEach(() => localStorage.clear())

  it('lists base records with readable joins and retains full metadata and create controls', async () => {
    const options = makeOptions()
    const originalMetadata = structuredClone(options.allTables)
    const requests = captureRequests((body) => body.joins?.some((join) =>
      join.joinTable === 'order' || join.joinTable === 'orderLine') ?? false)

    render(<RecordQuery {...options} />, { wrapper: createWrapper() })

    expect(await screen.findByText('Alice')).toBeVisible()
    await waitFor(() => expect(requests).toHaveLength(2))
    for (const { body } of requests) {
      expect(body.joins).toEqual([
        { joinTable: 'company', select: true, type: 'INNER' },
        { joinTable: 'supplier', select: true, type: 'LEFT' },
      ])
    }
    expect(screen.getByRole('button', { name: 'Create new People record' })).toBeEnabled()
    expect(options.allTables).toEqual(originalMetadata)
    expect(options.tableMetaData.exposedJoins[0].joinTable?.insertPermission).toBe(true)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('omits a join with an intermediate table absent from permission metadata', async () => {
    const options = makeOptions()
    options.tableMetaData.exposedJoins = [options.tableMetaData.exposedJoins[3]]
    delete options.allTables.company
    const requests = captureRequests()
    const { result } = renderHook(() => useRecordQuery(options), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.data.records).toEqual(records))
    await waitFor(() => expect(requests).toHaveLength(2))
    expect(requests.every(({ body }) => !body.joins?.length)).toBe(true)
  })

  it.each(['missing target', 'denied target', 'denied exposed target'] as const)(
    'omits a join with a %s', async (state) => {
      const options = makeOptions()
      const joinTable = structuredClone(options.allTables.company)
      options.tableMetaData.exposedJoins = [{ label: 'Company', isMany: false, joinTable }]
      if (state === 'missing target') delete options.allTables.company
      else if (state === 'denied target') options.allTables.company.readPermission = false
      else joinTable.readPermission = false
      const requests = captureRequests()
      const { result } = renderHook(() => useRecordQuery(options), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.data.records).toEqual(records))
      await waitFor(() => expect(requests).toHaveLength(2))
      expect(requests.every(({ body }) => !body.joins?.length)).toBe(true)
    }
  )

  it('retains a readable join through a bridge hidden from navigation', async () => {
    const options = makeOptions()
    options.tableMetaData.exposedJoins = [options.tableMetaData.exposedJoins[3]]
    options.allTables.company.isHidden = true
    const requests = captureRequests()
    const { result } = renderHook(() => useRecordQuery(options), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.data.records).toEqual(records))
    await waitFor(() => expect(requests).toHaveLength(2))
    for (const { body } of requests) {
      expect(body.joins).toEqual([{ joinTable: 'supplier', select: true, type: 'LEFT' }])
    }
  })

  it('waits for all-table metadata before requesting automatic joins', async () => {
    const options = makeOptions()
    const requests = captureRequests()
    const initialProps: { allTables: Record<string, QTableMetaData> | undefined } = { allTables: undefined }
    const { result, rerender } = renderHook(
      ({ allTables }) => useRecordQuery({ ...options, allTables }),
      { initialProps, wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.data.isFetching).toBe(false))
    expect(requests).toHaveLength(0)
    rerender({ allTables: options.allTables })
    await waitFor(() => expect(result.current.data.records).toEqual(records))
    await waitFor(() => expect(requests).toHaveLength(2))
  })

  it('preserves saved joined criteria and sorting and exposes the server denial', async () => {
    const options = makeOptions()
    const view: SavedView = {
      id: 'restricted-view', name: 'Orders', createdAt: '2026-09-10T00:00:00Z',
      filter: {
        booleanOperator: 'AND', criteria: [], orderBys: [],
        subFilters: [{
          booleanOperator: 'OR', subFilters: [], orderBys: [], skip: 0, limit: 0,
          criteria: [{ fieldName: 'order.id', operator: 'EQUALS', values: [17] }],
        }],
      },
      sortOrder: [{ fieldName: 'order.id', isAscending: false }],
      columnVisibility: {}, columnOrder: [],
    }
    const originalView = structuredClone(view)
    const requests = captureRequests((body) => Boolean(body.filter.subFilters?.length || body.filter.orderBys?.length))
    const { result } = renderHook(() => useRecordQuery(options), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.data.records).toEqual(records))

    act(() => result.current.views.loadView(view))

    await waitFor(() => expect(result.current.data.isError).toBe(true))
    expect(getErrorStatusCode(result.current.data.error)).toBe(403)
    await waitFor(() => expect(requests.filter(({ body }) => body.filter.subFilters?.length)).toHaveLength(2))
    const savedRequests = requests.filter(({ body }) => body.filter.subFilters?.length)
    expect(savedRequests.find(({ action }) => action === 'query')?.body.filter).toEqual({
      ...view.filter, orderBys: view.sortOrder, skip: 0, limit: 25,
    })
    expect(savedRequests.find(({ action }) => action === 'count')?.body.filter.subFilters).toEqual(view.filter.subFilters)
    expect(result.current.filter.sortOrder).toEqual(view.sortOrder)
    expect(view).toEqual(originalView)
  })

  it('shows a denied count as an error even when the records query succeeds', async () => {
    const options = makeOptions()
    captureRequests((_body, action) => action === 'count')

    render(<RecordQuery {...options} />, { wrapper: createWrapper() })

    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission to view these records.')
  })
})
