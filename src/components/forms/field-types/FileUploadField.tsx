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
 * @file FileUploadField — drag-and-drop file upload field with click-to-browse support, integrated with React Hook Form.
 */

'use client'

import React, { useRef, useState } from 'react'
import type { Control, FieldError } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import { Upload, X, File as FileIcon } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

/**
 * Props for the {@link FileUploadField} component.
 */
interface FileUploadFieldProps {
  /** The HTML `id` for the upload drop-zone region and its associated `<label>`. */
  id: string
  /** Human-readable field label rendered above the drop-zone. */
  label: string
  /** The React Hook Form field name used by the `Controller`. */
  name: string
  /** React Hook Form control object from the parent `useForm` instance. */
  control: Control<Record<string, unknown>>
  /** Validation error; when present triggers error styling and an error message. */
  error?: FieldError
  /** When `true`, the drop-zone is non-interactive and visually dimmed. */
  disabled?: boolean
  /** When `true`, an asterisk indicator is shown next to the label. */
  required?: boolean
  /** Forwarded to the hidden `<input type="file">` `accept` attribute (e.g. `"image/*,.pdf"`). */
  accept?: string
  /** Name of a previously uploaded file shown in the drop-zone before a new file is selected. */
  existingFileName?: string
  /** `data-qqq-id` attribute forwarded to the drop-zone region for CSS customization. */
  'data-qqq-id'?: string
}

/**
 * Drag-and-drop file upload field integrated with React Hook Form.
 *
 * Supports both click-to-browse (delegates to a visually hidden
 * `<input type="file">`) and native drag-and-drop.  A clear button removes
 * the selected file from the form state.  When a file is already selected
 * or `existingFileName` is provided, the file name is displayed with the
 * remove option.
 *
 * @param props - See {@link FileUploadFieldProps}.
 * @returns The rendered drag-and-drop upload zone with label and optional error message.
 */
export function FileUploadField({
  id,
  label,
  name,
  control,
  error,
  disabled = false,
  required = false,
  accept,
  existingFileName,
  'data-qqq-id': dataQqqId,
}: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  return (
    <div className="flex flex-col gap-1">
      <label
        className="text-sm font-medium text-foreground"
        data-qqq-id={dataQqqId ? `field-label-${dataQqqId}` : undefined}
      >
        {label}
        {required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
      </label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => {
          const currentFile = field.value instanceof File ? (field.value as File) : null
          const displayName = currentFile?.name ?? existingFileName

          /**
           * Updates the form field value with the first file from a FileList.
           *
           * @param files - The `FileList` from a file input or drag-drop event; no-op when empty or null.
           */
          const handleFiles = (files: FileList | null) => {
            if (files && files.length > 0) {
              field.onChange(files[0])
            }
          }

          return (
            <div>
              <div
                id={id}
                role="region"
                aria-label={`${label} upload area`}
                aria-describedby={error ? `${id}-error` : undefined}
                data-qqq-id={dataQqqId}
                onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                  if (!disabled) handleFiles(e.dataTransfer.files)
                }}
                className={cn(
                  'flex flex-col items-center justify-center rounded-md border-2 border-dashed p-6 text-center',
                  'transition-colors duration-150 cursor-pointer',
                  dragOver && !disabled ? 'border-primary bg-accent' : 'border-input',
                  disabled && 'cursor-not-allowed opacity-50',
                  error && 'border-destructive',
                  'hover:border-primary'
                )}
                onClick={() => !disabled && inputRef.current?.click()}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
                    e.preventDefault()
                    inputRef.current?.click()
                  }
                }}
                tabIndex={disabled ? -1 : 0}
              >
                {displayName ? (
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <FileIcon className="h-5 w-5 text-primary" aria-hidden="true" />
                    <span className="max-w-[200px] truncate">{displayName}</span>
                    {!disabled && (
                      <button
                        type="button"
                        aria-label={`Remove ${displayName}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          field.onChange(null)
                          if (inputRef.current) inputRef.current.value = ''
                        }}
                        className="ml-1 rounded p-0.5 text-muted-foreground hover:text-destructive focus:outline-none focus:ring-2 focus:ring-destructive"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <Upload className="mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-primary">Click to upload</span>{' '}
                      or drag and drop
                    </p>
                    {accept && (
                      <p className="mt-1 text-xs text-muted-foreground">{accept}</p>
                    )}
                  </>
                )}
              </div>
              <input
                ref={inputRef}
                type="file"
                id={`${id}-input`}
                accept={accept}
                disabled={disabled}
                aria-hidden="true"
                tabIndex={-1}
                className="sr-only"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
          )
        }}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-destructive" role="alert">
          {error.message}
        </p>
      )}
    </div>
  )
}
