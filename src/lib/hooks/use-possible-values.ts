'use client'

// usePossibleValues — TanStack Query hook for fetching possible values with debounced search

import { useQuery } from '@tanstack/react-query'
import { useState, useCallback, useRef } from 'react'

import type { QPossibleValue } from '@/types'
import {
  fetchTablePossibleValues,
  fetchProcessPossibleValues,
  fetchPossibleValues,
} from '@/lib/api/possible-values'
import { queryKeys } from '@/lib/query-client'

export type PossibleValueContext =
  | { type: 'table'; tableName: string }
  | { type: 'process'; processName: string }
  | { type: 'standalone' }

export interface UsePossibleValuesOptions {
  fieldName: string
  context: PossibleValueContext
  searchTerm?: string
  initialIds?: (string | number)[]
  enabled?: boolean
  debounceMs?: number
}

export interface UsePossibleValuesResult {
  options: QPossibleValue[]
  isLoading: boolean
  isError: boolean
  searchTerm: string
  setSearchTerm: (term: string) => void
}

/**
 * Hook for fetching possible values with optional search.
 * Handles table, process, and standalone contexts.
 */
export function usePossibleValues({
  fieldName,
  context,
  searchTerm: externalSearchTerm,
  initialIds,
  enabled = true,
}: Omit<UsePossibleValuesOptions, 'debounceMs'>): UsePossibleValuesResult {
  const [internalSearchTerm, setInternalSearchTerm] = useState(externalSearchTerm ?? '')

  const activeTerm = externalSearchTerm !== undefined ? externalSearchTerm : internalSearchTerm

  const queryFn = () => {
    const request = {
      searchTerm: activeTerm || undefined,
      ids: initialIds?.join(',') || undefined,
    }

    if (context.type === 'table') {
      return fetchTablePossibleValues(context.tableName, fieldName, request)
    } else if (context.type === 'process') {
      return fetchProcessPossibleValues(context.processName, fieldName, request)
    } else {
      return fetchPossibleValues(fieldName, request)
    }
  }

  const queryKey =
    context.type === 'table'
      ? queryKeys.tablePossibleValues(context.tableName, fieldName, activeTerm)
      : [...queryKeys.possibleValues(), context.type, fieldName, activeTerm]

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn,
    enabled: enabled && Boolean(fieldName),
    staleTime: 1000 * 30, // 30 seconds for search results
  })

  return {
    options: data ?? [],
    isLoading,
    isError,
    searchTerm: activeTerm,
    setSearchTerm: setInternalSearchTerm,
  }
}

/**
 * Hook that returns a debounced search setter for use with PossibleValueSelect
 */
export function useDebouncedSearch(debounceMs = 300) {
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setSearch = useCallback(
    (term: string) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      timerRef.current = setTimeout(() => {
        setDebouncedTerm(term)
      }, debounceMs)
    },
    [debounceMs]
  )

  return { debouncedTerm, setSearch }
}
