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

/**
 * @file usePossibleValues — TanStack Query hook for fetching possible values with debounced search.
 */
'use client'

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
 * Fetches possible values for a single field, supporting table, process, and standalone
 * contexts. Used by `PossibleValueSelect` in forms and filter builders wherever the
 * backend provides a bounded list of valid options (e.g. enum-like FK fields).
 *
 * Results are cached for 30 seconds. Pass `enabled: false` to defer fetching until
 * the field becomes relevant (e.g. when a filter row's field type changes).
 *
 * @param options - Configuration including field name, context, optional external search
 *   term (pass `undefined` to use the hook's internal state), optional pre-selected IDs
 *   to pre-load labels, and optional `enabled` flag.
 * @returns `{ options, isLoading, isError, searchTerm, setSearchTerm }` —
 *   `options` is a `QPossibleValue[]` (id + label pairs, empty array while loading or on error);
 *   watch `isLoading` to show a spinner while the network request is in flight;
 *   `setSearchTerm` updates the internal term (ignored when `externalSearchTerm` is provided).
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
 * Hook that returns a debounced search setter for use with PossibleValueSelect.
 *
 * @param debounceMs - Debounce delay in milliseconds before the term is committed.
 * @returns The current debounced search term and a setter that applies the configured delay.
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
