'use client'

// PossibleValueSelect — async combobox for fields with possibleValueSourceName
// Debounced search hits the backend possible values endpoint

import React, { useState, useRef, useEffect, useCallback } from 'react'
import type { Control, FieldError } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import { Check, ChevronDown, Loader2, X } from 'lucide-react'

import { cn } from '@/lib/utils/cn'
import type { QPossibleValue } from '@/types'
import type { PossibleValueContext } from '@/lib/hooks/use-possible-values'
import {
  fetchTablePossibleValues,
  fetchProcessPossibleValues,
  fetchPossibleValues,
} from '@/lib/api/possible-values'

interface PossibleValueSelectProps {
  id: string
  label: string
  name: string
  control: Control<Record<string, unknown>>
  fieldName: string
  context: PossibleValueContext
  error?: FieldError
  disabled?: boolean
  required?: boolean
  placeholder?: string
  'data-qqq-id'?: string
}

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
  const [selectedOption, setSelectedOption] = useState<QPossibleValue | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchOptions = useCallback(
    async (term: string) => {
      setIsLoading(true)
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
        setOptions(results)
      } catch {
        setOptions([])
      } finally {
        setIsLoading(false)
      }
    },
    [context, fieldName]
  )

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

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value
    setSearchTerm(term)
    debouncedFetch(term)
  }

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="text-sm font-medium text-gray-700 dark:text-gray-300"
        data-qqq-id={dataQqqId ? `field-label-${dataQqqId}` : undefined}
      >
        {label}
        {required && <span className="ml-1 text-red-500" aria-hidden="true">*</span>}
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

          const displayValue = selectedOption?.label ?? (field.value ? String(field.value) : '')

          return (
            <div ref={containerRef} className="relative">
              <div
                id={id}
                role="combobox"
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
                  'bg-white text-sm dark:bg-gray-800',
                  'focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500',
                  'transition-colors duration-150',
                  disabled && 'cursor-not-allowed opacity-50 bg-gray-100 dark:bg-gray-700',
                  error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                )}
              >
                <span
                  className={cn(
                    'flex-1 truncate text-sm',
                    displayValue
                      ? 'text-gray-900 dark:text-gray-100'
                      : 'text-gray-400 dark:text-gray-500'
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
                      className="rounded p-0.5 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-gray-400 transition-transform duration-150',
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
                    'rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800',
                    'max-h-60 overflow-hidden'
                  )}
                >
                  <div className="border-b border-gray-200 p-2 dark:border-gray-700">
                    <input
                      ref={inputRef}
                      type="text"
                      value={searchTerm}
                      onChange={handleSearchChange}
                      placeholder="Search..."
                      aria-label={`Search ${label} options`}
                      className={cn(
                        'w-full rounded border border-gray-200 px-2 py-1 text-sm',
                        'bg-gray-50 text-gray-900 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600',
                        'focus:outline-none focus:ring-1 focus:ring-blue-500',
                        'placeholder:text-gray-400'
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
                      <li className="flex items-center justify-center py-4 text-sm text-gray-500">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                        Loading...
                      </li>
                    ) : options.length === 0 ? (
                      <li className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
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
                              'hover:bg-gray-100 dark:hover:bg-gray-700',
                              isSelected && 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            )}
                          >
                            <span>{option.label}</span>
                            {isSelected && (
                              <Check className="h-4 w-4 text-blue-600" aria-hidden="true" />
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
        <p id={`${id}-error`} className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error.message}
        </p>
      )}
    </div>
  )
}
