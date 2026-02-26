'use client'

// BooleanField — toggle switch for boolean form fields
// Supports three-state cycling (null -> true -> false -> null) when field is NOT required.
// When required, uses two-state (true/false) only.

import React, { useCallback } from 'react'
import type { Control, FieldError } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import { Minus } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

interface BooleanFieldProps {
  id: string
  label: string
  name: string
  control: Control<Record<string, unknown>>
  error?: FieldError
  disabled?: boolean
  required?: boolean
  'data-qqq-id'?: string
}

/**
 * Resolves the current boolean state from a field value.
 * Returns true, false, or null (for indeterminate/three-state).
 */
function resolveBoolState(value: unknown): boolean | null {
  if (value === null || value === undefined) return null
  if (value === true || value === 'true') return true
  if (value === false || value === 'false') return false
  return null
}

/**
 * Returns the aria-checked value for the current boolean state.
 * Uses role="checkbox" (not "switch") because checkbox supports aria-checked="mixed"
 * for the indeterminate/null state in three-state mode.
 */
function ariaCheckedValue(state: boolean | null): 'true' | 'false' | 'mixed' {
  if (state === true) return 'true'
  if (state === false) return 'false'
  return 'mixed'
}

export function BooleanField({
  id,
  label,
  name,
  control,
  error,
  disabled = false,
  required = false,
  'data-qqq-id': dataQqqId,
}: BooleanFieldProps) {
  // Cycle logic depends on whether the field is required
  const getNextValue = useCallback(
    (current: boolean | null): boolean | null => {
      if (required) {
        // Two-state: true <-> false
        return !current
      }
      // Three-state: null -> true -> false -> null
      if (current === null) return true
      if (current === true) return false
      return null
    },
    [required]
  )

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Controller
          name={name}
          control={control}
          render={({ field }) => {
            const boolState = resolveBoolState(field.value)
            const ariaVal = ariaCheckedValue(boolState)

            return (
              <button
                type="button"
                role="checkbox"
                id={id}
                aria-checked={ariaVal}
                aria-required={required}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                disabled={disabled}
                data-qqq-id={dataQqqId}
                onClick={() => {
                  if (!disabled) {
                    field.onChange(getNextValue(boolState))
                  }
                }}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center',
                  'rounded-full border-2 border-transparent',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                  'transition-colors duration-200',
                  boolState === true
                    ? 'bg-green-600'
                    : boolState === false
                      ? 'bg-gray-200 dark:bg-gray-600'
                      : 'bg-gray-300 dark:bg-gray-500',
                  disabled && 'cursor-not-allowed opacity-50'
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'pointer-events-none inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm',
                    'transition-transform duration-200',
                    boolState === true
                      ? 'translate-x-5'
                      : boolState === false
                        ? 'translate-x-0'
                        : 'translate-x-2.5'
                  )}
                >
                  {/* Show dash indicator for null/indeterminate state */}
                  {boolState === null && (
                    <Minus className="h-3 w-3 text-gray-400" aria-hidden="true" />
                  )}
                </span>
              </button>
            )
          }}
        />
        <label
          htmlFor={id}
          className={cn(
            'text-sm font-medium text-gray-700 dark:text-gray-300',
            disabled && 'opacity-50'
          )}
          data-qqq-id={dataQqqId ? `field-label-${dataQqqId}` : undefined}
        >
          {label}
          {required && <span className="ml-1 text-red-500" aria-hidden="true">*</span>}
        </label>
      </div>
      {error && (
        <p id={`${id}-error`} className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error.message}
        </p>
      )}
    </div>
  )
}
