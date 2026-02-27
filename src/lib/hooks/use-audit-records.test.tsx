// Tests for useAuditRecords hook

import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useAuditRecords } from './use-audit-records'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useAuditRecords', () => {
  it('fetches audit records for person:1', async () => {
    const { result } = renderHook(
      () => useAuditRecords({ tableName: 'person', primaryKey: 1 }),
      { wrapper: createWrapper() }
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isError).toBe(false)
    expect(Array.isArray(result.current.auditRecords)).toBe(true)
  })

  it('returns empty array when enabled=false', () => {
    const { result } = renderHook(
      () => useAuditRecords({ tableName: 'person', primaryKey: 1, enabled: false }),
      { wrapper: createWrapper() }
    )
    expect(result.current.isLoading).toBe(false)
    expect(result.current.auditRecords).toEqual([])
  })

  it('returns empty array as default when no data', () => {
    const { result } = renderHook(
      () => useAuditRecords({ tableName: 'person', primaryKey: 1, enabled: false }),
      { wrapper: createWrapper() }
    )
    expect(result.current.auditRecords).toEqual([])
  })
})
