'use client'

import React, { useRef, useState } from 'react'
import type { Control, FieldError } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import { Upload, X, File as FileIcon } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

interface FileUploadFieldProps {
  id: string
  label: string
  name: string
  control: Control<Record<string, unknown>>
  error?: FieldError
  disabled?: boolean
  required?: boolean
  accept?: string
  existingFileName?: string
  'data-qqq-id'?: string
}

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
        className="text-sm font-medium text-gray-700 dark:text-gray-300"
        data-qqq-id={dataQqqId ? `field-label-${dataQqqId}` : undefined}
      >
        {label}
        {required && <span className="ml-1 text-red-500" aria-hidden="true">*</span>}
      </label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => {
          const currentFile = field.value instanceof File ? (field.value as File) : null
          const displayName = currentFile?.name ?? existingFileName

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
                  dragOver && !disabled ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600',
                  disabled && 'cursor-not-allowed opacity-50',
                  error && 'border-red-400',
                  'hover:border-blue-400 dark:hover:border-blue-500'
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
                  <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <FileIcon className="h-5 w-5 text-blue-500" aria-hidden="true" />
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
                        className="ml-1 rounded p-0.5 text-gray-400 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <Upload className="mb-2 h-8 w-8 text-gray-400" aria-hidden="true" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium text-blue-600 dark:text-blue-400">Click to upload</span>{' '}
                      or drag and drop
                    </p>
                    {accept && (
                      <p className="mt-1 text-xs text-gray-400">{accept}</p>
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
        <p id={`${id}-error`} className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error.message}
        </p>
      )}
    </div>
  )
}
