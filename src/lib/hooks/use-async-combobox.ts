'use client'

// useAsyncCombobox — shared fetch/debounce/abort/click-outside logic for async comboboxes
// Used by PossibleValueSingleSelect and PossibleValueMultiSelect in FilterBuilder

import { useState, useCallback, useRef, useEffect } from 'react'

import type { QPossibleValue } from '@/types'
import { fetchTablePossibleValues } from '@/lib/api/possible-values'
import { COMBOBOX_DEBOUNCE_MS } from '@/lib/constants'

interface UseAsyncComboboxOptions {
  tableName: string
  fieldName: string
  /** Called with fetched results — lets consumer update derived state (e.g. labelMap) */
  onOptionsFetched?: (results: QPossibleValue[]) => void
}

export interface UseAsyncComboboxResult {
  isOpen: boolean
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>
  searchTerm: string
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>
  options: QPossibleValue[]
  isLoading: boolean
  containerRef: React.RefObject<HTMLDivElement | null>
  inputRef: React.RefObject<HTMLInputElement | null>
  fetchOptions: (term: string) => Promise<void>
  debouncedFetch: (term: string) => void
}

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
