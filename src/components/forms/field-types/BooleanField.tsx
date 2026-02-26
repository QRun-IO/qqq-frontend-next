'use client'

import React from 'react'
import type { Control, FieldError } from 'react-hook-form'
import { Controller } from 'react-hook-form'

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
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Controller
          name={name}
          control={control}
          render={({ field }) => (
            <button
              type="button"
              role="switch"
              id={id}
              aria-checked={Boolean(field.value)}
              aria-required={required}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              disabled={disabled}
              data-qqq-id={dataQqqId}
              onClick={() => !disabled && field.onChange(!field.value)}
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center',
                'rounded-full border-2 border-transparent',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                'transition-colors duration-200',
                Boolean(field.value)
                  ? 'bg-blue-600'
                  : 'bg-gray-200 dark:bg-gray-600',
                disabled && 'cursor-not-allowed opacity-50'
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm',
                  'transition-transform duration-200',
                  Boolean(field.value) ? 'translate-x-5' : 'translate-x-0'
                )}
              />
            </button>
          )}
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
