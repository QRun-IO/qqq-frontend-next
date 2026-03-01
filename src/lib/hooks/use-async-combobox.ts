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
 * @file use-async-combobox — shared fetch/debounce/abort/click-outside logic for async comboboxes.
 */
'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

import type { QPossibleValue } from '@/types'
import { fetchTablePossibleValues } from '@/lib/api/possible-values'
import { COMBOBOX_DEBOUNCE_MS } from '@/lib/constants'

/**
 * Configuration options for {@link useAsyncCombobox}.
 */
interface UseAsyncComboboxOptions {
  /** The QQQ table name whose possible values should be fetched. */
  tableName: string
  /** The field name within the table whose possible values should be fetched. */
  fieldName: string
  /** Called with fetched results — lets consumer update derived state (e.g. labelMap) */
  onOptionsFetched?: (results: QPossibleValue[]) => void
}

/**
 * All state and refs returned by {@link useAsyncCombobox}.
 *
 * Consumers spread these onto their combobox markup to wire up open/close,
 * typing, and option display with no additional fetch logic.
 */
export interface UseAsyncComboboxResult {
  /** Whether the dropdown is currently open. */
  isOpen: boolean
  /** Setter to programmatically open or close the dropdown. */
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>
  /** The current search term typed by the user. */
  searchTerm: string
  /** Setter for the search term; triggers a debounced fetch. */
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>
  /** The most recently fetched list of possible values to display. */
  options: QPossibleValue[]
  /** True while a network request is in-flight. */
  isLoading: boolean
  /** Attach to the outermost container element to enable click-outside close. */
  containerRef: React.RefObject<HTMLDivElement | null>
  /** Attach to the text input element for focus management. */
  inputRef: React.RefObject<HTMLInputElement | null>
  /** Immediately fetches options for the given search term, cancelling any prior in-flight request. */
  fetchOptions: (term: string) => Promise<void>
  /** Debounced wrapper around {@link fetchOptions} using {@link COMBOBOX_DEBOUNCE_MS}. */
  debouncedFetch: (term: string) => void
}

/**
 * Encapsulates all async fetch, debounce, AbortController, and click-outside logic
 * needed by possible-value combobox inputs in the FilterBuilder.
 *
 * Used by `PossibleValueSingleSelect` and `PossibleValueMultiSelect` to avoid
 * duplicating identical stateful logic in each component.
 *
 * @param options - The table name, field name, and optional result callback.
 * @returns A {@link UseAsyncComboboxResult} with all combobox state, refs, and fetch helpers.
 */
export function useAsyncCombobox({
  tableName,
  fieldName,
  onOptionsFetched,
}: UseAsyncComboboxOptions): UseAsyncComboboxResult {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [options, setOptions] = useState<QPossibleValue[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  // Keep onOptionsFetched in a ref so fetchOptions callback doesn't change when it does
  const onOptionsFetchedRef = useRef(onOptionsFetched)
  useEffect(() => {
    onOptionsFetchedRef.current = onOptionsFetched
  }, [onOptionsFetched])

  /**
   * Fetches possible values for the configured table/field, filtered by the given search term.
   *
   * Cancels any pending in-flight request via AbortController before starting a new one.
   * Updates `options` and calls `onOptionsFetched` with the results on success.
   * Clears `options` on non-abort error. Does not update state if the request was aborted.
   *
   * @param term - The search string to filter possible values by; empty string fetches all.
   */
  const fetchOptions = useCallback(
    async (term: string) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      const controller = new AbortController()
      abortControllerRef.current = controller

      setIsLoading(true)
      try {
        const results = await fetchTablePossibleValues(tableName, fieldName, {
          searchTerm: term || undefined,
        })
        if (!controller.signal.aborted) {
          setOptions(results)
          onOptionsFetchedRef.current?.(results)
        }
      } catch {
        if (!controller.signal.aborted) {
          setOptions([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    },
    [tableName, fieldName]
  )

  /**
   * Debounced wrapper around {@link fetchOptions}.
   *
   * Clears any pending timer and starts a new one each time it is called.
   * Fires after {@link COMBOBOX_DEBOUNCE_MS} milliseconds of inactivity,
   * preventing excessive network requests while the user is typing.
   *
   * @param term - The search string to pass to {@link fetchOptions} after the debounce delay.
   */
  const debouncedFetch = useCallback(
    (term: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => fetchOptions(term), COMBOBOX_DEBOUNCE_MS)
    },
    [fetchOptions]
  )

  // Fetch on open
  useEffect(() => {
    if (isOpen) {
      fetchOptions(searchTerm)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (abortControllerRef.current) abortControllerRef.current.abort()
    }
  }, [])

  return {
    isOpen,
    setIsOpen,
    searchTerm,
    setSearchTerm,
    options,
    isLoading,
    containerRef,
    inputRef,
    fetchOptions,
    debouncedFetch,
  }
}
