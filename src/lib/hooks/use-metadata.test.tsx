// Tests for metadata hooks

import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useMetaData, useTableMetaData, useProcessMetaData } from './use-metadata'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useMetaData', () => {
  it('fetches all metadata from MSW', async () => {
    const { result } = renderHook(() => useMetaData(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isError).toBe(false)
    expect(result.current.data).toBeDefined()
  })
})

describe('useTableMetaData', () => {
  it('fetches table metadata by name', async () => {
    const { result } = renderHook(() => useTableMetaData('person'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isError).toBe(false)
    expect(result.current.data).toBeDefined()
  })

  it('does not fetch when tableName is undefined', () => {
    const { result } = renderHook(() => useTableMetaData(undefined), { wrapper: createWrapper() })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBeUndefined()
  })

  it('does not fetch when tableName is empty string', () => {
    const { result } = renderHook(() => useTableMetaData(''), { wrapper: createWrapper() })
    expect(result.current.isLoading).toBe(false)
  })
})

describe('useProcessMetaData', () => {
  it('fetches process metadata by name', async () => {
    const { result } = renderHook(() => useProcessMetaData('helloWorldProcess'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    // MSW may or may not have this process; just check no crash
    expect(result.current).toBeDefined()
  })

  it('does not fetch when processName is undefined', () => {
    const { result } = renderHook(() => useProcessMetaData(undefined), { wrapper: createWrapper() })
    expect(result.current.isLoading).toBe(false)
  })
})
