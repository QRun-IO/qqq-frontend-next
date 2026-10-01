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
 * @file FileUploadField — file upload for BLOB / FILE_UPLOAD fields: a "Choose file" button
 * or a drag-and-drop zone (the FILE_UPLOAD adornment's `format`), with the record's current
 * file, React Hook Form integration and keyboard access.
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
  /** The HTML `id` for the upload control. */
  id: string
  /** Human-readable field label. */
  label: string
  /** The React Hook Form field name used by the `Controller`. */
  name: string
  /** React Hook Form control object from the parent `useForm` instance. */
  control: Control<Record<string, unknown>>
  /** Validation error; when present triggers error styling and an error message. */
  error?: FieldError
  /** When `true`, the control is non-interactive and visually dimmed. */
  disabled?: boolean
  /** When `true`, an asterisk indicator is shown next to the label. */
  required?: boolean
  /** Forwarded to the hidden `<input type="file">` `accept` attribute (e.g. `"image/*,.pdf"`). */
  accept?: string
  /** `button` (default): a "Choose file to upload" button; `dragAndDrop`: a drop zone. */
  format?: 'button' | 'dragAndDrop'
  /** The file the record already holds (edit screen), shown with a remove action. */
  currentFile?: { name: string; url?: string }
  /** @deprecated Use `currentFile`. Name of a previously uploaded file. */
  existingFileName?: string
  /** `data-qqq-id` attribute for CSS customization. */
  'data-qqq-id'?: string
}

/**
 * File upload field integrated with React Hook Form.
 *
 * The value is a `File` once chosen, the record's original value while untouched,
 * and `null` when the current file is removed (saved as a cleared file).
 *
 * @param props - See {@link FileUploadFieldProps}.
 * @returns The upload control with label, current file and optional error message.
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
  format = 'button',
  currentFile,
  existingFileName,
  'data-qqq-id': dataQqqId,
}: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const initialValue = useRef<{ captured: boolean; value: unknown }>({ captured: false, value: null })
  const [dragOver, setDragOver] = useState(false)
  const current = currentFile ?? (existingFileName ? { name: existingFileName } : undefined)
  const labelId = `${id}-label`

  return (
    <div className="flex flex-col gap-1">
      <span id={labelId} className="text-sm font-medium text-foreground" data-qqq-id={dataQqqId ? `field-label-${dataQqqId}` : undefined}>
        {label}
        {required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
      </span>
      <Controller
        name={name}
        control={control}
        render={({ field }) => {
          if (!initialValue.current.captured) initialValue.current = { captured: true, value: field.value ?? null }
          const selected = field.value instanceof File ? field.value : null
          const showsCurrent = Boolean(current) && !selected && field.value !== null && field.value !== '' && field.value !== undefined

          const choose = () => { if (!disabled) inputRef.current?.click() }
          const handleFiles = (files: FileList | null) => {
            if (files && files.length > 0) field.onChange(files[0])
          }
          const clearSelection = () => {
            field.onChange(initialValue.current.value instanceof File ? null : initialValue.current.value)
            if (inputRef.current) inputRef.current.value = ''
          }

          return (
            <div className="space-y-2">
              {showsCurrent && current && (
                <div className="flex items-center gap-2 text-sm" data-qqq-id={dataQqqId ? `${dataQqqId}-current-file` : undefined}>
                  <span className="text-muted-foreground">Current File:</span>
                  {current.url
                    ? <a href={current.url} target="_blank" rel="noopener noreferrer"
                        className="text-primary underline pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center">{current.name}</a>
                    : <span className="text-foreground">{current.name}</span>}
                  {!disabled && (
                    <button type="button" aria-label={`Remove current file ${current.name}`} title="Remove current file"
                      data-qqq-id={dataQqqId ? `${dataQqqId}-remove-current` : undefined}
                      onClick={() => field.onChange(null)}
                      className="rounded p-0.5 text-muted-foreground hover:text-destructive focus:outline-none focus:ring-2 focus:ring-destructive">
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}
              {!selected && current && field.value === null && (
                <p className="text-sm text-muted-foreground" role="status">The current file will be removed when you save.</p>
              )}

              {format === 'dragAndDrop' ? (
                <div
                  id={id}
                  role="group"
                  aria-labelledby={labelId}
                  aria-describedby={error ? `${id}-error` : undefined}
                  data-qqq-id={dataQqqId}
                  data-upload-format="dragAndDrop"
                  onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(false)
                    if (!disabled) handleFiles(e.dataTransfer.files)
                  }}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed p-6 text-center',
                    'transition-colors duration-150',
                    dragOver && !disabled ? 'border-primary bg-accent' : 'border-input',
                    disabled && 'cursor-not-allowed opacity-50',
                    error && !dragOver && 'border-destructive'
                  )}
                >
                  <Upload className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">{dragOver && !disabled ? 'Drop file here' : 'Drag and drop a file'}</p>
                  <p className="text-xs text-muted-foreground">or</p>
                  <button type="button" onClick={choose} disabled={disabled} aria-describedby={labelId}
                    data-qqq-id={dataQqqId ? `${dataQqqId}-browse` : undefined}
                    className="rounded-md border border-input bg-card px-3 py-1.5 text-sm font-medium text-primary hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed">
                    Browse files
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3" data-qqq-id={dataQqqId} data-upload-format="button">
                  <button id={id} type="button" onClick={choose} disabled={disabled}
                    aria-labelledby={`${labelId} ${id}`}
                    aria-describedby={error ? `${id}-error` : undefined}
                    data-qqq-id={dataQqqId ? `${dataQqqId}-choose` : undefined}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium',
                      'bg-card text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring',
                      'disabled:cursor-not-allowed disabled:opacity-50',
                      error ? 'border-destructive' : 'border-input'
                    )}>
                    <Upload className="h-4 w-4" aria-hidden="true" />
                    Choose file to upload
                  </button>
                </div>
              )}

              {selected && (
                <div className="flex items-center gap-2 text-sm text-foreground" data-qqq-id={dataQqqId ? `${dataQqqId}-selected-file` : undefined}>
                  <FileIcon className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span className="max-w-[240px] truncate">{selected.name}</span>
                  {!disabled && (
                    <button type="button" aria-label={`Remove ${selected.name}`} onClick={clearSelection}
                      className="rounded p-0.5 text-muted-foreground hover:text-destructive focus:outline-none focus:ring-2 focus:ring-destructive">
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}

              <input
                ref={inputRef}
                type="file"
                id={`${id}-input`}
                accept={accept}
                disabled={disabled}
                aria-hidden="true"
                tabIndex={-1}
                className="sr-only"
                data-qqq-id={dataQqqId ? `${dataQqqId}-file-input` : undefined}
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
