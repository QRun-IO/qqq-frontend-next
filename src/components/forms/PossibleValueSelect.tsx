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
 * @file PossibleValueSelect — debounced async combobox for fields with a possibleValueSourceName.
 */

'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import type { Control, FieldError } from 'react-hook-form'
import { Controller, useWatch } from 'react-hook-form'
import { Check, ChevronDown, Loader2, X } from 'lucide-react'

import { cn } from '@/lib/utils/cn'
import type { QPossibleValue } from '@/types'
import type { PossibleValueContext } from '@/lib/hooks/use-possible-values'
import {
  fetchTablePossibleValues,
  fetchProcessPossibleValues,
  fetchPossibleValues,
} from '@/lib/api/possible-values'

/**
 * Props for the {@link PossibleValueSelect} component.
 */
interface PossibleValueSelectProps {
  /** The HTML `id` for the combobox trigger element and its associated label. */
  id: string
  /** Human-readable field label displayed above the combobox. */
  label: string
  /** The React Hook Form field name used by the `Controller`. */
  name: string
  /** React Hook Form control object from the parent `useForm` instance. */
  control: Control<Record<string, unknown>>
  /** The QQQ field name sent to the possible-values API as the field identifier. */
  fieldName: string
  /** Determines which possible-values endpoint is called (table, process, or standalone). */
  context: PossibleValueContext
  /** Validation error from React Hook Form; triggers error styling and an error message. */
  error?: FieldError
  /** When `true`, the combobox trigger is non-interactive and visually dimmed. */
  disabled?: boolean
  /** When `true`, an asterisk indicator is shown and `aria-required` is set. */
  required?: boolean
  /** Placeholder text shown when no option is selected; defaults to `"-- Select {label} --"`. */
  placeholder?: string
  /** `data-qqq-id` attribute forwarded to the combobox trigger for CSS customization. */
  'data-qqq-id'?: string
}

/**
 * Async combobox for QQQ fields that reference a possible-value source.
 *
 * On open, fetches an initial list of options from the backend. As the user
 * types in the search input, additional fetches are debounced by 300 ms to
 * reduce API traffic during fast typing. The dropdown closes on an outside
 * `mousedown` event (via a document-level listener) or when an option is
 * selected. Integrates with React Hook Form via `Controller` — the stored
 * form value is `option.id` (not the display label); the label is only used
 * for rendering the selected state in the trigger button.
 *
 * @param props - See {@link PossibleValueSelectProps}.
 * @returns The rendered labeled combobox with a searchable dropdown listbox.
 *   Shows a loading spinner while options are being fetched and a "No options
 *   found" message when the search returns an empty result set.
 */
export function PossibleValueSelect({
  id,
  label,
  name,
  control,
  fieldName,
  context,
  error,
  disabled = false,
  required = false,
  placeholder,
  'data-qqq-id': dataQqqId,
}: PossibleValueSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [options, setOptions] = useState<QPossibleValue[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [selectedOption, setSelectedOption] = useState<QPossibleValue | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestSequence = useRef(0)

  /**
   * Fetches possible values for the given search term from the appropriate
   * backend endpoint based on `context.type`.
   *
   * @param term - The search string typed by the user; an empty string returns
   *   the default/initial set of options.
   */
  const fetchOptions = useCallback(
    async (term: string) => {
      const sequence = ++requestSequence.current
      setIsLoading(true)
      setLoadFailed(false)
      try {
        const request = { searchTerm: term || undefined }
        let results: QPossibleValue[]
        if (context.type === 'table') {
          results = await fetchTablePossibleValues(context.tableName, fieldName, request)
        } else if (context.type === 'process') {
          results = await fetchProcessPossibleValues(context.processName, fieldName, request)
        } else {
          results = await fetchPossibleValues(fieldName, request)
        }
        if (sequence === requestSequence.current) setOptions(results)
      } catch {
        if (sequence === requestSequence.current) {
          setOptions([])
          setLoadFailed(true)
        }
      } finally {
        if (sequence === requestSequence.current) setIsLoading(false)
      }
    },
    [context, fieldName]
  )

  /**
   * Wraps {@link fetchOptions} in a 300 ms debounce, cancelling any pending
   * timer before scheduling a new one.
   *
   * @param term - The search string to debounce.
   */
  const debouncedFetch = useCallback(
    (term: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => fetchOptions(term), 300)
    },
    [fetchOptions]
  )

  useEffect(() => {
    if (isOpen) {
      fetchOptions(searchTerm)
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  //////////////////////////////////////////////////////////////////////////
  // A value this select did not choose itself (form defaults, process    //
  // values after Back, defaultProcessValues) shows its label, not its id //
  //////////////////////////////////////////////////////////////////////////
  const currentValue = useWatch({ control, name })
  const contextKey = JSON.stringify(context)
  useEffect(() => {
    if (currentValue === null || currentValue === undefined || currentValue === '') return
    if (selectedOption && String(selectedOption.id) === String(currentValue)) return
    let cancelled = false
    const request = { ids: String(currentValue) }
    const lookup = context.type === 'table' ? fetchTablePossibleValues(context.tableName, fieldName, request)
      : context.type === 'process' ? fetchProcessPossibleValues(context.processName, fieldName, request)
        : fetchPossibleValues(fieldName, request)
    lookup.then((results) => {
      const match = results.find((option) => String(option.id) === String(currentValue))
      if (!cancelled && match) setSelectedOption(match)
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [currentValue, contextKey, fieldName, selectedOption]) // eslint-disable-line react-hooks/exhaustive-deps

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

  /**
   * Handles changes to the search input inside the open dropdown.
   *
   * Updates the local search term state and triggers a debounced fetch.
   *
   * @param e - The change event from the search `<input>`.
   */
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value
    setSearchTerm(term)
    debouncedFetch(term)
  }

  return (
    <div className="flex flex-col gap-1">
      <label
        id={`${id}-label`}
        htmlFor={id}
        className="text-sm font-medium text-foreground"
        data-qqq-id={dataQqqId ? `field-label-${dataQqqId}` : undefined}
      >
        {label}
        {required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
      </label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => {
          // Sync selected option when field value changes externally
          const handleSelect = (option: QPossibleValue) => {
            field.onChange(option.id)
            setSelectedOption(option)
            setIsOpen(false)
            setSearchTerm('')
          }

          const handleClear = (e: React.MouseEvent) => {
            e.stopPropagation()
            field.onChange(null)
            setSelectedOption(null)
            setSearchTerm('')
          }

          const selectedMatches = selectedOption && String(selectedOption.id) === String(field.value)
          const displayValue = (selectedMatches ? selectedOption.label : null) ?? (field.value ? String(field.value) : '')

          return (
            <div ref={containerRef} className="relative">
              <div
                id={id}
                role="combobox"
                aria-labelledby={`${id}-label`}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                aria-required={required}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                aria-controls={`${id}-listbox`}
                data-qqq-id={dataQqqId}
                onClick={() => {
                  if (!disabled) {
                    setIsOpen((o) => !o)
                    if (!isOpen) {
                      setTimeout(() => inputRef.current?.focus(), 50)
                    }
                  }
                }}
                className={cn(
                  'flex min-h-10 w-full cursor-pointer items-center justify-between rounded-md border px-3 py-2',
                  'bg-background text-sm',
                  'focus-within:ring-2 focus-within:ring-ring focus-within:border-ring',
                  'transition-colors duration-150',
                  disabled && 'cursor-not-allowed opacity-50 bg-muted',
                  error ? 'border-destructive' : 'border-input'
                )}
              >
                <span
                  className={cn(
                    'flex-1 truncate text-sm',
                    displayValue
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                  )}
                >
                  {displayValue || placeholder || `-- Select ${label} --`}
                </span>
                <div className="flex items-center gap-1">
                  {Boolean(field.value) && !disabled && (
                    <button
                      type="button"
                      aria-label={`Clear ${label}`}
                      onClick={handleClear}
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-muted-foreground transition-transform duration-150',
                      isOpen && 'rotate-180'
                    )}
                    aria-hidden="true"
                  />
                </div>
              </div>

              {isOpen && !disabled && (
                <div
                  className={cn(
                    'absolute left-0 right-0 top-full z-50 mt-1',
                    'rounded-md border border-border bg-background shadow-lg',
                    'max-h-60 overflow-hidden'
                  )}
                >
                  <div className="border-b border-border p-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={searchTerm}
                      onChange={handleSearchChange}
                      placeholder="Search..."
                      aria-label={`Search ${label} options`}
                      className={cn(
                        'w-full rounded border border-input px-2 py-1 text-sm',
                        'bg-muted text-foreground',
                        'focus:outline-none focus:ring-1 focus:ring-ring',
                        'placeholder:text-muted-foreground'
                      )}
                    />
                  </div>
                  <ul
                    id={`${id}-listbox`}
                    role="listbox"
                    aria-label={`${label} options`}
                    className="max-h-44 overflow-y-auto"
                  >
                    {isLoading ? (
                      <li className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                        Loading...
                      </li>
                    ) : loadFailed ? (
                      <li role="alert" className="py-4 text-center text-sm text-destructive">
                        Options could not be loaded.
                      </li>
                    ) : options.length === 0 ? (
                      <li className="py-4 text-center text-sm text-muted-foreground">
                        No options found
                      </li>
                    ) : (
                      options.map((option) => {
                        const isSelected = String(field.value) === String(option.id)
                        return (
                          <li
                            key={String(option.id)}
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => handleSelect(option)}
                            className={cn(
                              'flex cursor-pointer items-center justify-between px-3 py-2 text-sm',
                              'hover:bg-accent',
                              isSelected && 'bg-accent text-primary'
                            )}
                          >
                            <span>{option.label}</span>
                            {isSelected && (
                              <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                            )}
                          </li>
                        )
                      })
                    )}
                  </ul>
                </div>
              )}
            </div>
          )
        }}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-destructive" role="alert">
          {error.message}
        </p>
      )}
    </div>
  )
}
