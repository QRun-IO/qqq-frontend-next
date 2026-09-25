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
import { useRecordQuery } from '@/lib/hooks/use-record-query'
import { getErrorStatusCode } from '@/lib/utils/error-utils'
import { qInstance } from '@/mocks/fixtures/q-instance'
import { server } from '@/mocks/node'
import { QContextProvider } from '@/lib/context/q-context'
import { RecordQuery } from './RecordQuery'

const records = [{ tableName: 'person', recordLabel: 'Alice', values: { id: 1, firstName: 'Alice' } }]

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}><QContextProvider>{children}</QContextProvider></QueryClientProvider>
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

  it('lists base records without joins until a join column, criterion or sort needs one', async () => {
    const options = makeOptions()
    const originalMetadata = structuredClone(options.allTables)
    const requests = captureRequests()

    render(<RecordQuery {...options} />, { wrapper: createWrapper() })

    expect(await screen.findByText('Alice')).toBeVisible()
    await waitFor(() => expect(requests.length).toBeGreaterThanOrEqual(1))
    expect(requests.every(({ body }) => !body.joins?.length)).toBe(true)
    expect(screen.getByRole('button', { name: 'Create new People record' })).toBeEnabled()
    expect(options.allTables).toEqual(originalMetadata)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('sends a LEFT join, named for a single-hop path, for a visible readable join column', async () => {
    const options = makeOptions()
    options.tableMetaData.exposedJoins = [{ ...options.tableMetaData.exposedJoins[2], joinPath: [{ name: 'personCompany', type: 'MANY_TO_ONE', leftTable: 'person', rightTable: 'company' }] }]
    localStorage.setItem('qqq-person-columns', JSON.stringify({ 'company.name': true }))
    const requests = captureRequests()
    const { result } = renderHook(() => useRecordQuery(options), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.data.records).toEqual(records))
    expect(requests.find(({ action }) => action === 'query')?.body.joins).toEqual([{ joinTable: 'company', select: true, type: 'LEFT', joinName: 'personCompany' }])
  })

  it.each(['missing target', 'denied target', 'denied exposed target', 'denied bridge'] as const)(
    'never joins through a %s, even when a column asks for it', async (state) => {
      const options = makeOptions()
      const supplier = options.tableMetaData.exposedJoins[3]
      options.tableMetaData.exposedJoins = [supplier]
      if (state === 'missing target') delete options.allTables.supplier
      else if (state === 'denied target') options.allTables.supplier.readPermission = false
      else if (state === 'denied exposed target') options.tableMetaData.exposedJoins = [{ ...supplier, joinTable: { ...supplier.joinTable!, readPermission: false } }]
      else options.allTables.company.readPermission = false
      localStorage.setItem('qqq-person-columns', JSON.stringify({ 'supplier.name': true }))
      const requests = captureRequests()
      const { result } = renderHook(() => useRecordQuery(options), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.data.records).toEqual(records))
      expect(requests.every(({ body }) => !body.joins?.length)).toBe(true)
    }
  )

  it('keeps joined criteria and sorting from a view and exposes the server denial', async () => {
    const options = makeOptions()
    const requests = captureRequests((body) => Boolean(body.filter.subFilters?.length))
    const { result } = renderHook(() => useRecordQuery(options), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.data.records).toEqual(records))

    act(() => result.current.applyView({
      userFilter: { booleanOperator: 'AND', criteria: [], orderBys: [], skip: 0, limit: 25, subFilters: [{
        booleanOperator: 'OR', subFilters: [], orderBys: [], skip: 0, limit: 0,
        criteria: [{ fieldName: 'order.id', operator: 'EQUALS', values: [17] }],
      }] },
      sortOrder: [{ fieldName: 'order.id', isAscending: false }],
      columnVisibility: {}, columnOrder: [], columnWidths: {}, pageSize: 25, filterMode: 'advanced',
    }))

    await waitFor(() => expect(result.current.data.isError).toBe(true))
    expect(getErrorStatusCode(result.current.data.error)).toBe(403)
    const denied = requests.find(({ action, body }) => action === 'query' && body.filter.subFilters?.length)
    expect(denied?.body.filter.subFilters?.[0].criteria).toEqual([{ fieldName: 'order.id', operator: 'EQUALS', values: [17] }])
    expect(denied?.body.filter.orderBys).toEqual([{ fieldName: 'order.id', isAscending: false }])
    // the order table is not readable, so it is never joined automatically
    expect(denied?.body.joins).toBeUndefined()
  })

  it('shows a denied count as an error even when the records query succeeds', async () => {
    const options = makeOptions()
    captureRequests((_body, action) => action === 'count')

    render(<RecordQuery {...options} />, { wrapper: createWrapper() })

    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission to view these records.')
  })
})
