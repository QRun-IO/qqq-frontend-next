'use client'

import React from 'react'
import type { UseFormRegisterReturn, FieldError } from 'react-hook-form'

import { cn } from '@/lib/utils/cn'

interface DateTimeFieldProps {
  id: string
  label: string
  registration: UseFormRegisterReturn
  error?: FieldError
  disabled?: boolean
  required?: boolean
  'data-qqq-id'?: string
}

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
