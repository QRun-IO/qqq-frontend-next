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
        className="text-sm font-medium text-foreground"
        data-qqq-id={dataQqqId ? `field-label-${dataQqqId}` : undefined}
      >
        {label}
        {required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
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
            'w-full rounded-md border px-3 py-2 pr-10 text-sm text-foreground',
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
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          disabled={disabled}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2',
            'text-muted-foreground hover:text-foreground',
            'focus:outline-none focus:ring-2 focus:ring-ring rounded',
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
        <p id={`${id}-error`} className="mt-1 text-sm text-destructive" role="alert">
          {error.message}
        </p>
      )}
    </div>
  )
}
