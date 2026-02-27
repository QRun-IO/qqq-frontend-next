/** DateTimeField — datetime-local input form field with label, validation error display, and accessibility attributes */
'use client'

import React from 'react'
import type { UseFormRegisterReturn, FieldError } from 'react-hook-form'

import { cn } from '@/lib/utils/cn'

/**
 * Props for the {@link DateTimeField} component.
 */
interface DateTimeFieldProps {
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
  /** When `true`, an asterisk indicator is shown and `aria-required` is set. */
  required?: boolean
  /** `data-qqq-id` attribute forwarded to the input for CSS customization. */
  'data-qqq-id'?: string
}

/**
 * Renders an accessible datetime-local input field with label and validation error display.
 *
 * Uses `<input type="datetime-local">` which provides combined date + time
 * picker UI in supported browsers.  The value format is `YYYY-MM-DDTHH:mm`
 * as managed by the browser.
 *
 * @param props - See {@link DateTimeFieldProps}.
 */
export function DateTimeField({
  id,
  label,
  registration,
  error,
  disabled = false,
  required = false,
  'data-qqq-id': dataQqqId,
}: DateTimeFieldProps) {
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
        type="datetime-local"
        {...registration}
        disabled={disabled}
        aria-required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        data-qqq-id={dataQqqId}
        className={cn(
          'w-full rounded-md border px-3 py-2 text-sm text-foreground',
          'bg-background',
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
