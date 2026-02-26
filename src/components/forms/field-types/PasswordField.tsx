'use client'

import React, { useState } from 'react'
import type { UseFormRegisterReturn, FieldError } from 'react-hook-form'
import { Eye, EyeOff } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

interface PasswordFieldProps {
  id: string
  label: string
  registration: UseFormRegisterReturn
  error?: FieldError
  disabled?: boolean
  placeholder?: string
  maxLength?: number
  required?: boolean
  'data-qqq-id'?: string
}

export function PasswordField({
  id,
  label,
  registration,
  error,
  disabled = false,
  placeholder,
  maxLength,
  required = false,
  'data-qqq-id': dataQqqId,
}: PasswordFieldProps) {
  const [showPassword, setShowPassword] = useState(false)

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
      <div className="relative">
        <input
          id={id}
          type={showPassword ? 'text' : 'password'}
          {...registration}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={maxLength}
          aria-required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          data-qqq-id={dataQqqId}
          className={cn(
            'w-full rounded-md border px-3 py-2 pr-10 text-sm text-gray-900',
            'bg-white dark:bg-gray-800 dark:text-gray-100',
            'placeholder:text-gray-400 dark:placeholder:text-gray-500',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            'disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:bg-gray-700',
            'transition-colors duration-150',
            error
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-300 dark:border-gray-600'
          )}
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          disabled={disabled}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2',
            'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 rounded',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error.message}
        </p>
      )}
    </div>
  )
}
