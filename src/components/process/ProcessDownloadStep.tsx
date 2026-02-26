'use client'

// ProcessDownloadStep -- renders a DOWNLOAD_FORM step
// Shows any viewFields as context and provides a download button for the result file

import React, { useState } from 'react'
import { Download, ChevronRight, X } from 'lucide-react'

import type { QFrontendStepMetaData, QFieldMetaData } from '@/types'
import { cn } from '@/lib/utils/cn'

import { ProcessCancelDialog } from './ProcessCancelDialog'

export interface ProcessDownloadStepProps {
  step: QFrontendStepMetaData
  stepValues: Record<string, unknown>
  isLoading: boolean
  onSubmit: (values: Record<string, unknown>) => Promise<void>
  onCancel: () => void
  onBack?: () => void
  canGoBack: boolean
  isLastStep: boolean
}

function resolveDownloadUrl(stepValues: Record<string, unknown>): string | null {
  // Check common step value keys used for download URLs
  const candidates = [
    'downloadUrl',
    'downloadURL',
    'serverFilePath',
    'filePath',
    'fileUrl',
    'fileURL',
    'resultUrl',
    'resultURL',
  ]

  for (const key of candidates) {
    const val = stepValues[key]
    if (typeof val === 'string' && val.length > 0) {
      return val
    }
  }

  return null
}

function resolveFileName(stepValues: Record<string, unknown>): string {
  const candidates = ['fileName', 'filename', 'downloadFileName']
  for (const key of candidates) {
    const val = stepValues[key]
    if (typeof val === 'string' && val.length > 0) {
      return val
    }
  }
  return 'download'
}

function formatFieldValue(field: QFieldMetaData, value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '\u2014'
  }
  if (field.type === 'BOOLEAN') {
    return value === true || value === 'true' || value === 1 ? 'Yes' : 'No'
  }
  return String(value)
}

export function ProcessDownloadStep({
  step,
  stepValues,
  isLoading,
  onSubmit,
  onCancel,
  onBack,
  canGoBack,
  isLastStep,
}: ProcessDownloadStepProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const viewFields = step.viewFields ?? []
  const downloadUrl = resolveDownloadUrl(stepValues)
  const fileName = resolveFileName(stepValues)

  // Help text from HELP_TEXT components
  const helpTextComponents = step.components.filter((c) => c.type === 'HELP_TEXT')

  return (
    <div className="space-y-6" data-qqq-id="process-download-step">
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

      {/* View fields as context */}
      {viewFields.length > 0 && (
        <dl
          className="divide-y divide-border rounded-xl border border-border"
          data-qqq-id="process-download-view-fields"
        >
          {viewFields.map((field) => (
            <div
              key={field.name}
              className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4"
            >
              <dt className="text-sm font-medium text-muted-foreground sm:w-1/3 sm:flex-shrink-0">
                {field.label}
              </dt>
              <dd className="text-sm text-foreground sm:flex-1">
                {formatFieldValue(field, stepValues[field.name])}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {/* Download area */}
      <div
        className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-muted p-8 text-center"
        data-qqq-id="process-download-area"
      >
        <Download
          className="h-10 w-10 text-primary"
          aria-hidden="true"
        />
        {downloadUrl ? (
          <>
            <p className="text-sm font-medium text-foreground">
              Your file is ready for download.
            </p>
            <a
              href={downloadUrl}
              download={fileName}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
                'text-primary-foreground bg-primary hover:bg-primary/90',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                'transition-colors duration-150'
              )}
              data-qqq-id="button-download-file"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download {fileName}
            </a>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No download available. The file may still be processing.
          </p>
        )}
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
              type="button"
              onClick={() => onSubmit(stepValues)}
              disabled={isLoading}
              data-qqq-id="button-next"
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
                'text-primary-foreground bg-primary hover:bg-primary/90',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'transition-colors duration-150'
              )}
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
              {isLastStep ? 'Finish' : 'Next'}
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
