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
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('offers metadata-configured quick filters in basic mode and opens the advanced builder', async () => {
    const user = userEvent.setup()
    const options = makeOptions()
    options.tableMetaData.supplementalMetaData = {
      materialDashboard: { defaultQuickFilterFieldNames: ['firstName'] },
    }
    captureRequests()

    render(<RecordQuery {...options} />, { wrapper: createWrapper() })

    expect(await screen.findByText('Alice')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Basic' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'First Name' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Advanced' }))
    expect(screen.getByRole('button', { name: 'Advanced' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Add condition')).toBeVisible()
  })

  it('edits a quick filter and sends its criterion to the records API', async () => {
    const user = userEvent.setup()
    const options = makeOptions()
    options.tableMetaData.supplementalMetaData = {
      materialDashboard: { defaultQuickFilterFieldNames: ['firstName'] },
    }
    const requests = captureRequests()

    render(<RecordQuery {...options} />, { wrapper: createWrapper() })
    expect(await screen.findByText('Alice')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'First Name' }))
    await user.type(screen.getByRole('textbox', { name: 'Filter value for First Name' }), 'Bob')
    await user.click(screen.getByRole('button', { name: 'Apply quick filter' }))

    await waitFor(() => expect(requests.some(({ action, body }) => action === 'query' &&
      body.filter.criteria?.some((criterion) => criterion.fieldName === 'firstName' && criterion.operator === 'EQUALS' && criterion.values[0] === 'Bob'))).toBe(true))
    expect(screen.getByRole('button', { name: /First Name.*Bob/ })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Clear First Name quick filter' }))
    await waitFor(() => expect(requests.at(-1)?.body.filter.criteria?.length).toBe(0))
    expect(screen.getByRole('button', { name: 'First Name' })).toBeVisible()
  })

  it('adds a metadata field as a quick filter and opens Advanced from the toolbar', async () => {
    const user = userEvent.setup()
    const options = makeOptions()
    options.tableMetaData.supplementalMetaData = {
      materialDashboard: { defaultQuickFilterFieldNames: ['firstName'] },
    }
    captureRequests()

    render(<RecordQuery {...options} />, { wrapper: createWrapper() })
    expect(await screen.findByText('Alice')).toBeVisible()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Add quick filter' }), 'lastName')
    expect(screen.getByRole('group', { name: 'Last Name quick filter' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: 'Last Name' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Remove Last Name quick filter' }))
    expect(screen.queryByRole('button', { name: 'Last Name' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Toggle advanced filter panel' }))
    expect(screen.getByRole('button', { name: 'Advanced' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Add condition')).toBeVisible()
  })

  it('confirms clearing filters and preserves the selected sort', async () => {
    const user = userEvent.setup()
    const options = makeOptions()
    options.tableMetaData.supplementalMetaData = {
      materialDashboard: { defaultQuickFilterFieldNames: ['firstName'] },
    }
    const requests = captureRequests()
    render(<RecordQuery {...options} />, { wrapper: createWrapper() })
    expect(await screen.findByText('Alice')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'First Name' }))
    await user.type(screen.getByRole('textbox', { name: 'Filter value for First Name' }), 'Bob')
    await user.click(screen.getByRole('button', { name: 'Apply quick filter' }))
    await waitFor(() => expect(requests.at(-1)?.body.filter.criteria?.length).toBe(1))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort field' }), 'lastName')
    await user.click(screen.getByRole('button', { name: 'Clear all filters' }))
    expect(screen.getByRole('alertdialog')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(requests.at(-1)?.body.filter.criteria?.length).toBe(1)

    await user.click(screen.getByRole('button', { name: 'Clear all filters' }))
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    await waitFor(() => expect(requests.filter(({ action }) => action === 'query').at(-1)?.body.filter.criteria?.length).toBe(0))
    expect(requests.filter(({ action }) => action === 'query').at(-1)?.body.filter.orderBys).toEqual([{ fieldName: 'lastName', isAscending: false }])
  })

  it('previews and removes a condition in Advanced mode', async () => {
    const user = userEvent.setup()
    const options = makeOptions()
    options.tableMetaData.supplementalMetaData = {
      materialDashboard: { defaultQuickFilterFieldNames: ['firstName'] },
    }
    const requests = captureRequests()
    render(<RecordQuery {...options} />, { wrapper: createWrapper() })
    expect(await screen.findByText('Alice')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'First Name' }))
    await user.type(screen.getByRole('textbox', { name: 'Filter value for First Name' }), 'Bob')
    await user.click(screen.getByRole('button', { name: 'Apply quick filter' }))
    await user.click(screen.getByRole('button', { name: 'Advanced' }))
    await user.click(screen.getByRole('button', { name: 'Remove First Name equals Bob' }))

    await waitFor(() => expect(requests.filter(({ action }) => action === 'query').at(-1)?.body.filter.criteria?.length).toBe(0))
  })

  it('explains why a multi-condition field cannot return to Basic mode', async () => {
    const user = userEvent.setup()
    const options = makeOptions()
    captureRequests()
    render(<RecordQuery {...options} />, { wrapper: createWrapper() })
    expect(await screen.findByText('Alice')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Advanced' }))
    await user.click(screen.getByText('Add condition'))
    await user.click(screen.getByText('Add condition'))
    const basic = screen.getByRole('button', { name: 'Basic' })
    expect(basic).toHaveAttribute('aria-disabled', 'true')
    await user.click(basic)
    expect(screen.getByRole('button', { name: 'Advanced' })).toHaveAttribute('aria-pressed', 'true')
    basic.focus()
    expect(await screen.findByRole('tooltip')).toHaveTextContent('more than 1 condition')
  })

  it('lists base records without joins until a join column, criterion or sort needs one', async () => {
    const options = makeOptions()
    const originalMetadata = structuredClone(options.allTables)
    const requests = captureRequests()

    render(<RecordQuery {...options} />, { wrapper: createWrapper() })

    expect(await screen.findByText('Alice')).toBeVisible()
    await waitFor(() => expect(requests.length).toBeGreaterThanOrEqual(1))
    expect(requests.every(({ body }) => !body.joins?.length)).toBe(true)
    expect(screen.getByRole('button', { name: 'Create new People record' })).toBeEnabled()
    // Material CSS hooks (QRun-IO/qqq#731)
    expect(screen.getByRole('button', { name: 'Create new People record' })).toHaveAttribute('data-qqq-id', 'button-create-new')
    expect(screen.getByRole('button', { name: 'Create new People record' })).toHaveAttribute('data-button-variant', 'gradient')
    expect(document.querySelector('[data-qqq-id="button-filter-builder"]')).toContainElement(screen.getByRole('button', { name: 'Toggle advanced filter panel' }))
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
