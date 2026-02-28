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

/** PasswordField — password input with show/hide toggle, validation error display, and accessibility attributes */
'use client'

import React, { useState } from 'react'
import type { UseFormRegisterReturn, FieldError } from 'react-hook-form'
import { Eye, EyeOff } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

/**
 * Props for the {@link PasswordField} component.
 */
interface PasswordFieldProps {
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
  /** Forwarded to the `<input>` `maxlength` attribute. */
  maxLength?: number
  /** When `true`, an asterisk indicator is shown and `aria-required` is set. */
  required?: boolean
  /** `data-qqq-id` attribute forwarded to the input for CSS customization. */
  'data-qqq-id'?: string
}

/**
 * Renders a password input field with a show/hide toggle button.
 *
 * Toggling visibility switches the underlying `<input>` between `type="password"`
 * and `type="text"`.  The button is labelled via `aria-label` and is excluded
 * from form submission focus order concerns because it has `type="button"`.
 *
 * @param props - See {@link PasswordFieldProps}.
 */
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
