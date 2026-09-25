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
 * @file NumberField — numeric input form field supporting integer, long, and decimal types with validation.
 */

'use client'

import React from 'react'
import type { UseFormRegisterReturn, FieldError } from 'react-hook-form'

import { cn } from '@/lib/utils/cn'

/**
 * Props for the {@link NumberField} component.
 */
interface NumberFieldProps {
  /** The HTML `id` for the `<input>` element and its associated `<label>`. */
  id: string
  /** Human-readable field label rendered above the input. */
  label: string
  /** Return value of `register(fieldName)` from React Hook Form. */
  registration: UseFormRegisterReturn
  /** Validation error; when present triggers error styling and an error message. */
  error?: FieldError
  /** When `true`, the input is non-interactive and visually dimmed. */
  disabled?: boolean
  /** Placeholder text shown when the field is empty. */
  placeholder?: string
  /** When `true`, an asterisk indicator is shown and `aria-required` is set. */
  required?: boolean
  /**
   * The `step` attribute for the numeric input.
   * Use `1` for integers/longs; use `"any"` for decimals.
   */
  step?: string | number
  /** Minimum allowed value from field metadata; displayed as hint text below the input. */
  minValue?: number | string | null
  /** Maximum allowed value from field metadata; displayed as hint text below the input. */
  maxValue?: number | string | null
  /** `data-qqq-id` attribute forwarded to the input for CSS customization. */
  'data-qqq-id'?: string
  /** Id of help text that describes this control. */
  describedBy?: string
}

/**
 * Renders an accessible numeric input field with label, optional min/max hint, and validation error display.
 *
 * Used for QQQ field types INTEGER, LONG (with `step={1}`), and DECIMAL
 * (with `step="any"`). Values remain input strings until schema validation,
 * preserving an empty input separately from a numeric zero.
 *
 * When `minValue` or `maxValue` is provided, a hint line is rendered below
 * the input showing the allowed range or bound before any error message.
 *
 * @param props - See {@link NumberFieldProps}.
 * @returns The rendered numeric input field with label, optional constraint hint, and optional error message.
 */
export function NumberField({
  id,
  label,
  registration,
  error,
  disabled = false,
  placeholder,
  required = false,
  step,
  minValue,
  maxValue,
  'data-qqq-id': dataQqqId,
  describedBy,
}: NumberFieldProps) {
  const hintId = (minValue != null || maxValue != null) ? `${id}-hint` : undefined
  const describedByIds = [hintId, error ? `${id}-error` : undefined, describedBy].filter(Boolean).join(' ') || undefined

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="text-sm font-medium text-foreground"
        data-qqq-id={dataQqqId ? `field-label-${dataQqqId}` : undefined}
      >
        {label}
        {required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
      </label>
      <input
        id={id}
        type="number"
        step={step}
        {...registration}
        disabled={disabled}
        placeholder={placeholder}
        aria-required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedByIds}
        data-qqq-id={dataQqqId}
        className={cn(
          'w-full rounded-md border px-3 py-2 text-sm text-foreground',
          'bg-background',
          'placeholder:text-muted-foreground',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring',
          'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground',
          'transition-colors duration-150',
          error
            ? 'border-destructive focus:ring-destructive'
            : 'border-input'
        )}
      />
      {(minValue != null || maxValue != null) && (
        <p id={hintId} className="mt-0.5 text-xs text-muted-foreground">
          {minValue != null && maxValue != null
            ? `Range: ${minValue} \u2013 ${maxValue}`
            : minValue != null
            ? `Minimum: ${minValue}`
            : `Maximum: ${maxValue}`}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-destructive" role="alert">
          {error.message}
        </p>
      )}
    </div>
  )
}
