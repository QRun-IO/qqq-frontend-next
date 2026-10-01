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

// Tests for useRecord hook

import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useRecord } from './use-record'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/node'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useRecord', () => {
  it('fetches a record from MSW mock (person:1)', async () => {
    const { result } = renderHook(
      () => useRecord({ tableName: 'person', primaryKey: 1 }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.isError).toBe(false)
    expect(result.current.record).toBeDefined()
    expect(result.current.record?.tableName).toBe('person')
  })

  it('separates base, expanded and variant records in the same query cache', async () => {
    const requests: string[] = []
    const handler = ({ request }: { request: Request }) => {
      const url = new URL(request.url)
      const mode = url.searchParams.get('includeAssociations') + ':' + url.searchParams.get('tableVariant')
      requests.push(mode)
      return HttpResponse.json({ record: { tableName: 'person', values: { id: 1, mode }, recordLabel: mode } })
    }
    server.use(http.get('/qqq/v1/table/person/1', handler))
    const { result } = renderHook(() => ({
      base: useRecord({ tableName: 'person', primaryKey: 1, includeAssociations: false }),
      expanded: useRecord({ tableName: 'person', primaryKey: 1, includeAssociations: true }),
      variant: useRecord({ tableName: 'person', primaryKey: 1, includeAssociations: false, tableVariant: '{"type":"tenant","id":2}' }),
    }), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.variant.record).toBeDefined())
    expect(result.current.base.record?.values.mode).toBe('false:null')
    expect(result.current.expanded.record?.values.mode).toBe('true:null')
    expect(result.current.variant.record?.values.mode).toBe('false:{"type":"tenant","id":2}')
    expect(requests).toHaveLength(3)
  })

  it('returns isError for a 404 record', async () => {
    const { result } = renderHook(
      () => useRecord({ tableName: 'person', primaryKey: 99999 }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.isError).toBe(true)
    expect(result.current.record).toBeUndefined()
  })

  it('does not fetch when enabled=false', () => {
    const { result } = renderHook(
      () => useRecord({ tableName: 'person', primaryKey: 1, enabled: false }),
      { wrapper: createWrapper() }
    )

    // Should not be loading (disabled)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.record).toBeUndefined()
  })

  it('does not fetch when tableName is empty', () => {
    const { result } = renderHook(
      () => useRecord({ tableName: '', primaryKey: 1 }),
      { wrapper: createWrapper() }
    )
    expect(result.current.isLoading).toBe(false)
  })

  it('exposes refetch function', async () => {
    const { result } = renderHook(
      () => useRecord({ tableName: 'person', primaryKey: 1 }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(typeof result.current.refetch).toBe('function')
  })
})
