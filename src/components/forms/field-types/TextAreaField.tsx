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
 * @file TextAreaField — multi-line text form field (QQQ `TEXT`) with label, quiet length counter and error line.
 */

'use client'

import React from 'react'
import type { UseFormRegisterReturn, FieldError } from 'react-hook-form'

import { cn } from '@/lib/utils/cn'
import { transformInputValue } from '@/lib/utils/form-layout'
import { FieldFooter } from '../FieldFooter'
import type { LengthLimit } from '../FieldFooter'

/** Props for the {@link TextAreaField} component. */
interface TextAreaFieldProps {
  /** The HTML `id` for the `<textarea>` and its label. */
  id: string
  /** Human-readable field label. */
  label: string
  /** Return value of `register(fieldName)` from React Hook Form. */
  registration: UseFormRegisterReturn
  /** Validation error; when present triggers error styling and an error message. */
  error?: FieldError
  /** When `true`, the field is non-interactive. */
  disabled?: boolean
  /** Placeholder text shown when the field is empty. */
  placeholder?: string
  /** Forwarded to the `maxlength` attribute (set only when the field refuses over-long values). */
  maxLength?: number
  /** Counts characters against the field's limit; the counter shows only near or past it. */
  lengthLimit?: LengthLimit
  /** When `true`, an asterisk is shown and `aria-required` is set. */
  required?: boolean
  /** `data-qqq-id` forwarded to the textarea. */
  'data-qqq-id'?: string
  /** Id of help text that describes this control. */
  describedBy?: string
  /** Changes the value as the user types (a case behavior), keeping the caret. */
  transform?: (value: string) => string
  /** Content shown beside the label (the field's help button). */
  labelExtra?: React.ReactNode
}

/**
 * Renders a multi-line text input.
 *
 * @param props - See {@link TextAreaFieldProps}.
 * @returns The labelled textarea with its footer.
 */
export function TextAreaField({
  id,
  label,
  registration,
  error,
  disabled = false,
  placeholder,
  maxLength,
  lengthLimit,
  required = false,
  'data-qqq-id': dataQqqId,
  describedBy,
  transform,
  labelExtra,
}: TextAreaFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center">
        <label htmlFor={id} className="text-sm font-medium text-foreground" data-qqq-id={`field-label-${dataQqqId}`}>
          {label}
          {required && <span className="ml-0.5 text-muted-foreground" aria-hidden="true">*</span>}
        </label>
        {labelExtra}
      </div>
      <textarea
        id={id}
        placeholder={placeholder}
        {...registration}
        onChange={(event) => {
          if (transform) transformInputValue(event.currentTarget, transform)
          void registration.onChange(event)
        }}
        disabled={disabled}
        maxLength={maxLength}
        aria-required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={[error ? `${id}-error` : undefined, describedBy].filter(Boolean).join(' ') || undefined}
        data-qqq-id={dataQqqId}
        rows={4}
        className={cn(
          'w-full resize-y rounded-md border bg-background px-3 py-2 text-sm text-foreground transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring disabled:cursor-not-allowed disabled:bg-muted',
          error ? 'border-destructive focus:ring-destructive' : 'border-input'
        )}
      />
      <FieldFooter id={id} error={error?.message} limit={lengthLimit} />
    </div>
  )
}
