// Tests for usePossibleValues and useDebouncedSearch hooks

import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { usePossibleValues, useDebouncedSearch } from './use-possible-values'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('usePossibleValues', () => {
  it('does not fetch when fieldName is empty', () => {
    const { result } = renderHook(
      () => usePossibleValues({ fieldName: '', context: { type: 'standalone' } }),
      { wrapper: createWrapper() }
    )
    expect(result.current.isLoading).toBe(false)
    expect(result.current.options).toEqual([])
  })

  it('does not fetch when enabled=false', () => {
    const { result } = renderHook(
      () => usePossibleValues({ fieldName: 'status', context: { type: 'standalone' }, enabled: false }),
      { wrapper: createWrapper() }
    )
    expect(result.current.isLoading).toBe(false)
    expect(result.current.options).toEqual([])
  })

  it('uses internal search term by default', () => {
    const { result } = renderHook(
      () => usePossibleValues({ fieldName: 'status', context: { type: 'standalone' } }),
      { wrapper: createWrapper() }
    )
    expect(result.current.searchTerm).toBe('')
  })

  it('setSearchTerm updates the internal search term', () => {
    const { result } = renderHook(
      () => usePossibleValues({ fieldName: 'status', context: { type: 'standalone' } }),
      { wrapper: createWrapper() }
    )

    act(() => {
      result.current.setSearchTerm('active')
    })

    expect(result.current.searchTerm).toBe('active')
  })

  it('uses external searchTerm when provided', () => {
    const { result } = renderHook(
      () => usePossibleValues({
        fieldName: 'status',
        context: { type: 'standalone' },
        searchTerm: 'external',
      }),
      { wrapper: createWrapper() }
    )
    expect(result.current.searchTerm).toBe('external')
  })

  it('fetches from table context via MSW', async () => {
    const { result } = renderHook(
      () => usePossibleValues({
        fieldName: 'companyId',
        context: { type: 'table', tableName: 'person' },
      }),
      { wrapper: createWrapper() }
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    // MSW mock exists for this; result may be empty but should not error
    expect(Array.isArray(result.current.options)).toBe(true)
  })

  it('fetches from process context', async () => {
    const { result } = renderHook(
      () => usePossibleValues({
        fieldName: 'targetTable',
        context: { type: 'process', processName: 'bulkImport' },
      }),
      { wrapper: createWrapper() }
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(Array.isArray(result.current.options)).toBe(true)
  })
})

describe('useDebouncedSearch', () => {
  it('returns empty string initially', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useDebouncedSearch(300))
    expect(result.current.debouncedTerm).toBe('')
    vi.useRealTimers()
  })

  it('debounces the search term update', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useDebouncedSearch(300))

    act(() => {
      result.current.setSearch('hello')
    })

    // Term should not have updated yet
    expect(result.current.debouncedTerm).toBe('')

    // Advance timers
    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.debouncedTerm).toBe('hello')
    vi.useRealTimers()
  })

  it('cancels previous timer on rapid typing', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useDebouncedSearch(300))

    act(() => {
      result.current.setSearch('h')
      result.current.setSearch('he')
      result.current.setSearch('hello')
    })

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    // Should have the final value only
    expect(result.current.debouncedTerm).toBe('hello')
    vi.useRealTimers()
  })
})
