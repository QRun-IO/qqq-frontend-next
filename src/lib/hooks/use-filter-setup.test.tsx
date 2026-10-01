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

/** @file Variant isolation for report preview requests and cached rows. */
import React from 'react'
import { describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'

import type { QTableMetaData } from '@/types'
import { server } from '@/mocks/node'
import { qInstance } from '@/mocks/fixtures/q-instance'
import { emptyFilter } from '@/lib/utils/filter-utils'
import type { TableVariant } from '@/lib/api/tables'
import { useFilterSetupPreview } from './use-filter-setup'

const table: QTableMetaData = { ...qInstance.tables.person, usesVariants: true, capabilities: ['TABLE_QUERY', 'TABLE_COUNT'] }
function Wrapper({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('report preview variants', () => {
  it.each([undefined, { name: 'test', path: 'test', version: 'v1' }])('scopes rows/count and clears old rows while switching (%j)', async (api) => {
    const requests: { kind: string; tableVariant?: TableVariant }[] = []
    let releaseSouth: (() => void) | undefined
    const pendingSouth = new Promise<void>(resolve => { releaseSouth = resolve })
    const prefix = api ? '/qqq/v1/test/v1' : '/qqq/v1'
    server.use(http.post(`${prefix}/table/person/:kind`, async ({ request, params }) => {
      const body = await request.json() as { tableVariant?: TableVariant }
      requests.push({ kind: String(params.kind), tableVariant: body.tableVariant })
      if (!body.tableVariant) return HttpResponse.json({ error: 'Missing variant' }, { status: 500 })
      if (body.tableVariant.id === '2') await pendingSouth
      return HttpResponse.json(params.kind === 'count' ? { count: body.tableVariant.id === '1' ? 2 : 1 } : {
        records: [{ tableName: 'person', values: { id: 1, firstName: body.tableVariant.id === '1' ? 'North' : 'South' } }],
      })
    }))
    const { result, rerender } = renderHook(({ variant }: { variant: TableVariant | null }) =>
      useFilterSetupPreview({ table, api, tableVariant: variant, filter: emptyFilter(), includeDistinct: false, enabled: true }),
    { wrapper: Wrapper, initialProps: { variant: null as TableVariant | null } })
    expect(result.current.isFetching).toBe(false)
    expect(requests).toEqual([])
    rerender({ variant: { type: 'store', id: '1', name: 'North Store' } })
    await waitFor(() => expect(result.current.totalCount).toBe(2))
    expect(result.current.records[0].values.firstName).toBe('North')
    rerender({ variant: { type: 'store', id: '2', name: 'South Store' } })
    await waitFor(() => expect(requests.filter(r => r.tableVariant?.id === '2')).toHaveLength(2))
    expect(result.current.records).toEqual([])
    expect(result.current.totalCount).toBeNull()
    releaseSouth!()
    await waitFor(() => expect(result.current.totalCount).toBe(1))
    expect(result.current.records[0].values.firstName).toBe('South')
    expect(requests).toEqual([
      { kind: 'query', tableVariant: { type: 'store', id: '1', name: 'North Store' } },
      { kind: 'count', tableVariant: { type: 'store', id: '1', name: 'North Store' } },
      { kind: 'query', tableVariant: { type: 'store', id: '2', name: 'South Store' } },
      { kind: 'count', tableVariant: { type: 'store', id: '2', name: 'South Store' } },
    ])
  })
})


describe('report preview capabilities', () => {
  it.each([undefined, { name: 'test', path: 'test', version: 'v1' }])('clears an unsupported cached query error while keeping the count (%j)', async (api) => {
    const prefix = api ? '/qqq/v1/test/v1' : '/qqq/v1'
    server.use(http.post(`${prefix}/table/person/:kind`, ({ params }) => params.kind === 'count'
      ? HttpResponse.json({ count: 7 }) : HttpResponse.json({ message: 'Query unavailable' }, { status: 500 })))
    const { result, rerender } = renderHook(({ capabilities }: { capabilities: QTableMetaData['capabilities'] }) => useFilterSetupPreview({
      table: { ...table, usesVariants: false, capabilities }, api,
      filter: emptyFilter(), includeDistinct: false, enabled: true,
    }), { wrapper: Wrapper, initialProps: { capabilities: table.capabilities } })
    await waitFor(() => expect(result.current.error).not.toBeNull())
    await waitFor(() => expect(result.current.totalCount).toBe(7))
    rerender({ capabilities: ['TABLE_COUNT'] })
    expect(result.current.error).toBeNull()
    expect(result.current.totalCount).toBe(7)
  })

  it.each([undefined, { name: 'test', path: 'test', version: 'v1' }])('counts without requesting unsupported rows, including refresh (%j)', async (api) => {
    const requests: string[] = []
    const prefix = api ? '/qqq/v1/test/v1' : '/qqq/v1'
    server.use(http.post(`${prefix}/table/person/:kind`, ({ params }) => {
      requests.push(String(params.kind))
      return HttpResponse.json(params.kind === 'count' ? { count: 7 } : { records: [] })
    }))
    const { result } = renderHook(() => useFilterSetupPreview({
      table: { ...table, usesVariants: false, capabilities: ['TABLE_COUNT'] },
      api, filter: emptyFilter(), includeDistinct: false, enabled: true,
    }), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.totalCount).toBe(7))
    expect(requests).toEqual(['count'])
    expect(result.current.records).toEqual([])
    act(() => result.current.refresh())
    await waitFor(() => expect(requests).toEqual(['count', 'count']))
    await waitFor(() => expect(result.current.isFetching).toBe(false))
  })

  it.each([undefined, { name: 'test', path: 'test', version: 'v1' }])('hides cached rows and count when capabilities are removed (%j)', async (api) => {
    const requests: string[] = []
    const prefix = api ? '/qqq/v1/test/v1' : '/qqq/v1'
    server.use(http.post(`${prefix}/table/person/:kind`, ({ params }) => {
      requests.push(String(params.kind))
      return HttpResponse.json(params.kind === 'count' ? { count: 1 } : {
        records: [{ tableName: 'person', values: { id: 1, firstName: 'Ada' } }],
      })
    }))
    const { result, rerender } = renderHook(({ capabilities }: { capabilities: QTableMetaData['capabilities'] }) => useFilterSetupPreview({
      table: { ...table, usesVariants: false, capabilities }, api,
      filter: emptyFilter(), includeDistinct: false, enabled: true,
    }), { wrapper: Wrapper, initialProps: { capabilities: table.capabilities } })
    await waitFor(() => expect(result.current.records).toHaveLength(1))
    await waitFor(() => expect(result.current.totalCount).toBe(1))
    await waitFor(() => expect(result.current.isFetching).toBe(false))
    const before = [...requests]
    rerender({ capabilities: ['TABLE_COUNT'] })
    expect(result.current.records).toEqual([])
    expect(result.current.totalCount).toBe(1)
    rerender({ capabilities: [] })
    expect(result.current.records).toEqual([])
    expect(result.current.totalCount).toBeNull()
    expect(result.current.isLoading).toBe(false)
    await act(async () => result.current.refresh())
    expect(requests).toEqual(before)
  })
})
