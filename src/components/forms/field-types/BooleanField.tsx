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

/** BooleanField — three-state toggle switch for boolean form fields integrated with React Hook Form */
'use client'

// BooleanField — toggle switch for boolean form fields
// Supports three-state cycling (null -> true -> false -> null) when field is NOT required.
// When required, uses two-state (true/false) only.

import React, { useCallback } from 'react'
import type { Control, FieldError } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import { Minus } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

/**
 * Props for the {@link BooleanField} component.
 */
interface BooleanFieldProps {
  /** The HTML `id` for the toggle button and its associated label. */
  id: string
  /** Human-readable field label rendered next to the toggle. */
  label: string
  /** The React Hook Form field name used by the `Controller`. */
  name: string
  /** React Hook Form control object from the parent `useForm` instance. */
  control: Control<Record<string, unknown>>
  /** Validation error; when present triggers error styling and message. */
  error?: FieldError
  /** When `true`, the toggle is non-interactive and visually dimmed. */
  disabled?: boolean
  /**
   * When `true`, cycling is two-state only (true/false).
   * When `false`, a null/indeterminate state is included in the cycle.
   */
  required?: boolean
  /** `data-qqq-id` attribute forwarded to the toggle button for CSS customization. */
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

/**
 * Toggle switch for boolean form fields integrated with React Hook Form.
 *
 * When `required` is true the toggle cycles between `true` and `false`.
 * When `required` is false it cycles through `null → true → false → null`,
 * where `null` represents the indeterminate (unset) state displayed with a
 * dash indicator and `aria-checked="mixed"`.
 *
 * @param props - See {@link BooleanFieldProps}.
 */
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
  /**
   * Returns the next value in the boolean cycle given the current state.
   *
   * @param current - The current boolean state (`true`, `false`, or `null`).
   * @returns The next boolean state in the cycle.
   */
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
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  'transition-colors duration-200',
                  boolState === true
                    ? 'bg-green-600'
                    : boolState === false
                      ? 'bg-muted'
                      : 'bg-muted',
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
                    <Minus className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                  )}
                </span>
              </button>
            )
          }}
        />
        <label
          htmlFor={id}
          className={cn(
            'text-sm font-medium text-foreground',
            disabled && 'opacity-50'
          )}
          data-qqq-id={dataQqqId ? `field-label-${dataQqqId}` : undefined}
        >
          {label}
          {required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
        </label>
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-destructive" role="alert">
          {error.message}
        </p>
      )}
    </div>
  )
}
