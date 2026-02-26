'use client'

import React from 'react'
import type { UseFormRegisterReturn, FieldError } from 'react-hook-form'

import { cn } from '@/lib/utils/cn'
import type { QPossibleValue } from '@/types'

interface SelectFieldProps {
  id: string
  label: string
  registration: UseFormRegisterReturn
  options: QPossibleValue[]
  error?: FieldError
  disabled?: boolean
  required?: boolean
  placeholder?: string
  'data-qqq-id'?: string
}

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
