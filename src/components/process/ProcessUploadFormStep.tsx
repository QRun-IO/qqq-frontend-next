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
 * @file ProcessUploadFormStep — renders an UPLOAD_FORM process step.
 *
 * Provides a simple file upload UI for process steps that use the `UPLOAD_FORM`
 * component type.  Unlike `BulkLoadStep`, this step is a single-purpose file
 * uploader without bulk-load-specific options (upload mode, duplicate handling).
 *
 * Accepted file types are read from the component's `values.acceptedTypes` field;
 * if absent, all file types are accepted.
 */
'use client'

import React, { useState, useCallback } from 'react'
import { Upload, File, X, ChevronRight } from 'lucide-react'

import type { QFrontendStepMetaData } from '@/types'
import { cn } from '@/lib/utils/cn'

import { ProcessCancelDialog } from './ProcessCancelDialog'

/**
 * Props for the {@link ProcessUploadFormStep} component.
 */
export interface ProcessUploadFormStepProps {
  /** Metadata for the current process step. */
  step: QFrontendStepMetaData
  /** Current accumulated step values from the process state. */
  stepValues: Record<string, unknown>
  /** Whether a submission is in progress; disables controls while true. */
  isLoading: boolean
  /**
   * Called when the user submits the form.
   *
   * @param values - Merged step values including file metadata.
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

/**
 * Resolves the accepted MIME / extension types from the UPLOAD_FORM component.
 *
 * @param step - The current step metadata.
 * @returns A comma-separated accept string for the file input, or `'*'` for all types.
 */
function resolveAcceptedTypes(step: QFrontendStepMetaData): string {
  const uploadComp = step.components.find((c) => (c.type as string) === 'UPLOAD_FORM')
  const accepted = uploadComp?.values?.acceptedTypes
  if (typeof accepted === 'string' && accepted.length > 0) return accepted
  return '*'
}

/**
 * Renders an UPLOAD_FORM process step.
 *
 * Dispatched from `ProcessRun` when `resolveStepType` returns `'UPLOAD_FORM'`.
 * Provides a drag-and-drop / click-to-browse file drop zone (keyboard-accessible
 * via Enter/Space) and a sticky action bar.  The Upload button is disabled until
 * a file is selected (`selectedFile === null`).  Accepted MIME / extension types
 * come from `resolveAcceptedTypes`; when none are declared the `<input>` accepts
 * all types (`accept="*"`).  On submit, `fileName` and `fileSize` are merged into
 * `stepValues` so the backend receives metadata alongside the multipart upload.
 *
 * @param props - {@link ProcessUploadFormStepProps}
 * @returns A `<div>` with optional help-text banners, a file drop zone, and a
 *   sticky Cancel / Back / Upload & Continue|Submit action bar.
 */
export function ProcessUploadFormStep({
  step,
  stepValues,
  isLoading,
  onSubmit,
  onCancel,
  onBack,
  canGoBack,
  isLastStep,
}: ProcessUploadFormStepProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)

  const acceptedTypes = resolveAcceptedTypes(step)

  const handleFileChange = (file: File | null) => setSelectedFile(file)

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

  const handleDragLeave = () => setIsDragOver(false)

  const handleSubmit = async () => {
    if (!selectedFile) return
    await onSubmit(
      {
        ...stepValues,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
      },
      selectedFile
    )
  }

  // Help text from HELP_TEXT components
  const helpTextComponents = step.components.filter((c) => c.type === 'HELP_TEXT')

  return (
    <div className="space-y-6" data-qqq-id={`process-upload-form-step-${step.name}`}>
      {/* Help text */}
      {helpTextComponents.map((comp, idx) => (
        <div
          key={idx}
          className="rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary"
          data-qqq-id={`process-help-text-${step.name}-${idx}`}
        >
          {String(comp.values?.text ?? '')}
        </div>
      ))}

      {/* File drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop file here or click to select"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            document.getElementById('upload-form-file-input')?.click()
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
        data-qqq-id="upload-form-dropzone"
      >
        <input
          id="upload-form-file-input"
          type="file"
          accept={acceptedTypes}
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          aria-label="Select file to upload"
          data-qqq-id="upload-form-file-input"
        />

        {selectedFile ? (
          <div className="flex flex-col items-center gap-2">
            <File className="h-10 w-10 text-primary" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
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
              <p className="text-sm font-medium text-foreground">Drop your file here, or click to browse</p>
              {acceptedTypes !== '*' && (
                <p className="mt-1 text-xs text-muted-foreground">Accepted: {acceptedTypes}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="sticky bottom-0 z-10 -mx-6 border-t border-border bg-card px-6 py-3 md:relative md:bottom-auto">
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
              type="button"
              onClick={handleSubmit}
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
    </div>
  )
}
