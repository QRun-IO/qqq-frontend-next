// Tests for useRecord hook

import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useRecord } from './use-record'

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
