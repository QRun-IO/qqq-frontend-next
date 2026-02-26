'use client'

// BulkLoadStep — renders a BULK_LOAD step
// Provides file upload UI for CSV import with basic field mapping

import React, { useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { Upload, File, X, ChevronRight } from 'lucide-react'

import type { QFrontendStepMetaData } from '@/types'
import { cn } from '@/lib/utils/cn'

import { ProcessCancelDialog } from './ProcessCancelDialog'

export interface BulkLoadStepProps {
  step: QFrontendStepMetaData
  stepValues: Record<string, unknown>
  isLoading: boolean
  onSubmit: (values: Record<string, unknown>, file?: File) => Promise<void>
  onCancel: () => void
  onBack?: () => void
  canGoBack: boolean
  isLastStep: boolean
}

interface BulkLoadFormValues {
  uploadMode?: string
  duplicateHandling?: string
}

export function BulkLoadStep({
  step,
  stepValues,
  isLoading,
  onSubmit,
  onCancel,
  onBack,
  canGoBack,
  isLastStep,
}: BulkLoadStepProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)

  const { register, handleSubmit } = useForm<BulkLoadFormValues>({
    defaultValues: {
      uploadMode: (stepValues.uploadMode as string) ?? 'INSERT_OR_UPDATE',
      duplicateHandling: (stepValues.duplicateHandling as string) ?? 'OVERWRITE',
    },
  })

  const handleFileChange = (file: File | null) => {
    setSelectedFile(file)
  }

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) setSelectedFile(file)
  }, [])

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const onFormSubmit = async (formValues: BulkLoadFormValues) => {
    if (!selectedFile) return
    await onSubmit(
      {
        ...stepValues,
        ...formValues,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
      },
      selectedFile
    )
  }

  // Help text from components
  const helpTextComponents = step.components.filter((c) => c.type === 'HELP_TEXT')

  return (
    <form
      onSubmit={handleSubmit(onFormSubmit)}
      noValidate
      className="space-y-6"
      data-qqq-id={`process-bulk-load-step-${step.name}`}
    >
      {/* Help text */}
      {helpTextComponents.map((comp, idx) => (
        <div
          key={idx}
          className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-300"
        >
          {String(comp.values?.text ?? '')}
        </div>
      ))}

      {/* File drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop CSV file here or click to select"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            document.getElementById('bulk-load-file-input')?.click()
          }
        }}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center',
          'cursor-pointer transition-colors duration-150',
          isDragOver
            ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400 dark:border-gray-700 dark:bg-gray-800/50',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
        )}
        data-qqq-id="bulk-load-dropzone"
      >
        <input
          id="bulk-load-file-input"
          type="file"
          accept=".csv,.tsv,.txt"
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          aria-label="Select CSV file"
          data-qqq-id="bulk-load-file-input"
        />

        {selectedFile ? (
          <div className="flex flex-col items-center gap-2">
            <File className="h-10 w-10 text-blue-500" aria-hidden="true" />
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {selectedFile.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleFileChange(null)
              }}
              aria-label="Remove selected file"
              data-qqq-id="button-remove-file"
              className="mt-1 inline-flex items-center gap-1 rounded text-xs text-red-500 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 dark:text-red-400"
            >
              <X className="h-3 w-3" aria-hidden="true" />
              Remove
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="h-10 w-10 text-gray-400 dark:text-gray-500" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Drop your CSV file here, or click to browse
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Accepts .csv, .tsv, .txt files
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Upload options */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="bulk-load-upload-mode"
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Upload Mode
          </label>
          <select
            id="bulk-load-upload-mode"
            {...register('uploadMode')}
            disabled={isLoading}
            data-qqq-id="bulk-load-upload-mode"
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="INSERT_ONLY">Insert only (skip duplicates)</option>
            <option value="UPDATE_ONLY">Update only (skip new records)</option>
            <option value="INSERT_OR_UPDATE">Insert or update</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="bulk-load-duplicate-handling"
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Duplicate Handling
          </label>
          <select
            id="bulk-load-duplicate-handling"
            {...register('duplicateHandling')}
            disabled={isLoading}
            data-qqq-id="bulk-load-duplicate-handling"
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="OVERWRITE">Overwrite</option>
            <option value="SKIP">Skip</option>
            <option value="ERROR">Error on duplicate</option>
          </select>
        </div>
      </div>

      {/* Actions */}
      <div className="sticky bottom-0 z-10 -mx-6 border-t border-gray-200 bg-white px-6 py-3 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowCancelDialog(true)}
            disabled={isLoading}
            data-qqq-id="button-cancel"
            className={cn(
              'inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium',
              'text-gray-700 bg-white hover:bg-gray-50',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'dark:border-gray-600 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700',
              'transition-colors duration-150'
            )}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Cancel
          </button>

          <div className="flex items-center gap-3">
            {canGoBack && onBack && (
              <button
                type="button"
                onClick={onBack}
                disabled={isLoading}
                data-qqq-id="button-back"
                className={cn(
                  'inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium',
                  'text-gray-700 bg-white hover:bg-gray-50',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  'dark:border-gray-600 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700',
                  'transition-colors duration-150'
                )}
              >
                Back
              </button>
            )}

            <button
              type="submit"
              disabled={isLoading || !selectedFile}
              data-qqq-id="button-upload"
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
                'text-white bg-blue-600 hover:bg-blue-700',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'transition-colors duration-150'
              )}
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
              {isLoading ? 'Uploading...' : isLastStep ? 'Upload & Submit' : 'Upload & Continue'}
            </button>
          </div>
        </div>
      </div>

      <ProcessCancelDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        onConfirm={onCancel}
      />
    </form>
  )
}
