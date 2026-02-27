/** SelectField — native `<select>` field for static option lists, integrated with React Hook Form */
'use client'

import React from 'react'
import type { UseFormRegisterReturn, FieldError } from 'react-hook-form'

import { cn } from '@/lib/utils/cn'
import type { QPossibleValue } from '@/types'

/**
 * Props for the {@link SelectField} component.
 */
interface SelectFieldProps {
  /** The HTML `id` for the `<select>` element and its associated `<label>`. */
  id: string
  /** Human-readable field label rendered above the select. */
  label: string
  /** Return value of `register(fieldName)` from React Hook Form. */
  registration: UseFormRegisterReturn
  /** The list of selectable options rendered as `<option>` elements. */
  options: QPossibleValue[]
  /** Validation error; when present triggers error styling and an error message. */
  error?: FieldError
  /** When `true`, the select is non-interactive and visually dimmed. */
  disabled?: boolean
  /** When `true`, no blank placeholder option is prepended; an asterisk indicator is shown. */
  required?: boolean
  /** Text for the blank placeholder option prepended when `required` is false; defaults to `"-- Select {label} --"`. */
  placeholder?: string
  /** `data-qqq-id` attribute forwarded to the select element for CSS customization. */
  'data-qqq-id'?: string
}

/**
 * Renders a native `<select>` field for a static list of options.
 *
 * Unlike {@link PossibleValueSelect} (which fetches options asynchronously),
 * this component renders a fixed `options` array synchronously, making it
 * suitable for inline enum-like value sets that do not need server-side search.
 *
 * When `required` is false a blank placeholder option is prepended so the
 * user can deselect an existing value.
 *
 * @param props - See {@link SelectFieldProps}.
 */
export function SelectField({
  id,
  label,
  registration,
  options,
  error,
  disabled = false,
  required = false,
  placeholder,
  'data-qqq-id': dataQqqId,
}: SelectFieldProps) {
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
      <select
        id={id}
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
      >
        {!required && (
          <option value="">
            {placeholder ?? `-- Select ${label} --`}
          </option>
        )}
        {options.map((option) => (
          <option key={String(option.id)} value={String(option.id)}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-destructive" role="alert">
          {error.message}
        </p>
      )}
    </div>
  )
}
