/**
 * BulkLoadStep — renders a BULK_LOAD step with file upload UI for CSV import.
 *
 * Handles drag-and-drop or click-to-browse file selection, upload mode and
 * duplicate-handling selects, and sticky cancel/back/upload action buttons.
 */
'use client'

// BulkLoadStep — renders a BULK_LOAD step
// Provides file upload UI for CSV import with basic field mapping

import React, { useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { Upload, File, X, ChevronRight } from 'lucide-react'

import type { QFrontendStepMetaData } from '@/types'
import { cn } from '@/lib/utils/cn'

import { ProcessCancelDialog } from './ProcessCancelDialog'

/**
 * Props for the {@link BulkLoadStep} component.
 */
export interface BulkLoadStepProps {
  /** Metadata for the current process step. */
  step: QFrontendStepMetaData
  /** Current accumulated step values from the process state. */
  stepValues: Record<string, unknown>
  /** Whether a submission is in progress; disables controls while true. */
  isLoading: boolean
  /**
   * Called when the user submits the form.
   *
   * @param values - Merged step values including upload mode and file metadata.
   * @param file - The selected File object to upload.
   */
  onSubmit: (values: Record<string, unknown>, file?: File) => Promise<void>
  /** Called when the user confirms cancellation of the process. */
  onCancel: () => void
  /** Called when the user clicks Back; only rendered if `canGoBack` is true. */
  onBack?: () => void
  /** Whether a previous step exists to navigate back to. */
  canGoBack: boolean
  /** Whether this is the final step in the process (controls button label). */
  isLastStep: boolean
}

/** Internal React Hook Form values for the bulk load options selects. */
interface BulkLoadFormValues {
  /** Insert-only, update-only, or insert-or-update mode. */
  uploadMode?: string
  /** How to handle duplicate records encountered during import. */
  duplicateHandling?: string
}

/**
 * Renders a BULK_LOAD process step.
 *
 * Provides a drag-and-drop / click-to-browse file drop zone for CSV files,
 * upload mode and duplicate handling selects driven by React Hook Form, and
 * a sticky action bar with Cancel / Back / Upload buttons.
 *
 * @param props - {@link BulkLoadStepProps}
 */
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

  /**
   * Updates the selected file state.
   *
   * @param file - The newly selected file, or null to clear the selection.
   */
  const handleFileChange = (file: File | null) => {
    setSelectedFile(file)
  }

  /**
   * Handles the drop event on the drop zone, extracting the first dragged file.
   *
   * @param e - The React drag event from the drop zone element.
   */
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) setSelectedFile(file)
  }, [])

  /**
   * Prevents the browser default so the drop zone can receive files.
   *
   * @param e - The React drag event.
   */
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  /** Clears the drag-over highlight when the user drags out of the drop zone. */
  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  /**
   * React Hook Form submit handler; merges form values with the selected file
   * metadata and delegates to `onSubmit`.
   *
   * @param formValues - Validated form values from React Hook Form.
   */
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
          className="rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary"
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
            ? 'border-primary bg-primary/5'
            : 'border-border bg-muted hover:border-border',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
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
            <File className="h-10 w-10 text-primary" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">
              {selectedFile.name}
            </p>
            <p className="text-xs text-muted-foreground">
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
              className="mt-1 inline-flex items-center gap-1 rounded text-xs text-destructive hover:text-destructive/80 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <X className="h-3 w-3" aria-hidden="true" />
              Remove
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Drop your CSV file here, or click to browse
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
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
            className="text-sm font-medium text-foreground"
          >
            Upload Mode
          </label>
          <select
            id="bulk-load-upload-mode"
            {...register('uploadMode')}
            disabled={isLoading}
            data-qqq-id="bulk-load-upload-mode"
            className="rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted"
          >
            <option value="INSERT_ONLY">Insert only (skip duplicates)</option>
            <option value="UPDATE_ONLY">Update only (skip new records)</option>
            <option value="INSERT_OR_UPDATE">Insert or update</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="bulk-load-duplicate-handling"
            className="text-sm font-medium text-foreground"
          >
            Duplicate Handling
          </label>
          <select
            id="bulk-load-duplicate-handling"
            {...register('duplicateHandling')}
            disabled={isLoading}
            data-qqq-id="bulk-load-duplicate-handling"
            className="rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted"
          >
            <option value="OVERWRITE">Overwrite</option>
            <option value="SKIP">Skip</option>
            <option value="ERROR">Error on duplicate</option>
          </select>
        </div>
      </div>

      {/* Actions */}
      <div className="sticky bottom-0 z-10 -mx-6 border-t border-border bg-card px-6 py-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowCancelDialog(true)}
            disabled={isLoading}
            data-qqq-id="button-cancel"
            className={cn(
              'inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium',
              'text-foreground bg-card hover:bg-accent',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
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
                  'inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium',
                  'text-foreground bg-card hover:bg-accent',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  'disabled:cursor-not-allowed disabled:opacity-50',
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
                'text-primary-foreground bg-primary hover:bg-primary/90',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
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
