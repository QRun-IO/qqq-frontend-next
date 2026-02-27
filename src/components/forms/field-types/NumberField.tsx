/** NumberField — numeric input form field supporting integer, long, and decimal types with validation */
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
  /** Return value of `register(fieldName, { valueAsNumber: true })` from React Hook Form. */
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
  /** `data-qqq-id` attribute forwarded to the input for CSS customization. */
  'data-qqq-id'?: string
}

/**
 * Renders an accessible numeric input field with label and validation error display.
 *
 * Used for QQQ field types INTEGER, LONG (with `step={1}`), and DECIMAL
 * (with `step="any"`).  React Hook Form's `valueAsNumber` option ensures
 * the controlled value is a JavaScript number rather than a string.
 *
 * @param props - See {@link NumberFieldProps}.
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
  'data-qqq-id': dataQqqId,
}: NumberFieldProps) {
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
        aria-describedby={error ? `${id}-error` : undefined}
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
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-destructive" role="alert">
          {error.message}
        </p>
      )}
    </div>
  )
}
