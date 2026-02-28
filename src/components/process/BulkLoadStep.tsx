/**
 * BulkLoadStep — renders a BULK_LOAD step with differentiated UI by load type.
 *
 * Reads `QFrontendComponent.values.type` from the first bulk-load component to
 * select the appropriate credential or upload form:
 *
 * - `FILE_UPLOAD` (default) — drag-and-drop / click-to-browse CSV file upload
 * - `SFTP_CREDENTIALS` — SFTP host, username, password, and remote path fields
 * - `API_CREDENTIALS` — API endpoint URL and API key fields
 *
 * For any unknown type the component falls back to `FILE_UPLOAD` behavior.
 */
'use client'

// BulkLoadStep — renders a BULK_LOAD step with type-differentiated UI
// Handles FILE_UPLOAD, SFTP_CREDENTIALS, API_CREDENTIALS, and unknown types

import React, { useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { Upload, File, X, ChevronRight, Server, Key } from 'lucide-react'

import type { QFrontendStepMetaData, QComponentType } from '@/types'
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
   * @param values - Merged step values including credential or file metadata.
   * @param file - The selected File object to upload (FILE_UPLOAD mode only).
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

/** Internal React Hook Form values for the file-upload bulk load form. */
interface FileUploadFormValues {
  /** Insert-only, update-only, or insert-or-update mode. */
  uploadMode?: string
  /** How to handle duplicate records encountered during import. */
  duplicateHandling?: string
}

/** Internal React Hook Form values for the SFTP credentials form. */
interface SftpFormValues {
  /** SFTP server hostname or IP address. */
  sftpHost: string
  /** SFTP account username. */
  sftpUsername: string
  /** SFTP account password. */
  sftpPassword: string
  /** Remote file path on the SFTP server. */
  sftpRemotePath?: string
}

/** Internal React Hook Form values for the API credentials form. */
interface ApiFormValues {
  /** Base URL of the external API endpoint. */
  apiEndpoint: string
  /** API key or bearer token used to authenticate requests. */
  apiKey: string
}

/**
 * Resolves the bulk-load type from step component metadata.
 *
 * Reads `values.type` from the first bulk-load component found in the step's
 * `components` array.  Falls back to `'FILE_UPLOAD'` for unknown or absent types.
 *
 * @param step - The current step metadata.
 * @returns `'FILE_UPLOAD'`, `'SFTP_CREDENTIALS'`, `'API_CREDENTIALS'`, or `'FILE_UPLOAD'` as default.
 */
function resolveBulkLoadType(step: QFrontendStepMetaData): 'FILE_UPLOAD' | 'SFTP_CREDENTIALS' | 'API_CREDENTIALS' {
  const bulkLoadTypes: QComponentType[] = [
    'BULK_LOAD_FILE_MAPPING_FORM',
    'BULK_LOAD_VALUE_MAPPING_FORM',
    'BULK_LOAD_PROFILE_FORM',
  ]
  const bulkComp = step.components.find((c) => bulkLoadTypes.includes(c.type))
  const rawType = bulkComp?.values?.type

  if (rawType === 'SFTP_CREDENTIALS') return 'SFTP_CREDENTIALS'
  if (rawType === 'API_CREDENTIALS') return 'API_CREDENTIALS'
  return 'FILE_UPLOAD'
}

// ─── Sub-forms ────────────────────────────────────────────────────────────────

/**
 * Props shared by all sub-form renderers within {@link BulkLoadStep}.
 */
interface SubFormProps {
  stepValues: Record<string, unknown>
  isLoading: boolean
  onSubmit: (values: Record<string, unknown>, file?: File) => Promise<void>
  isLastStep: boolean
}

/**
 * File upload sub-form with drag-and-drop, upload mode, and duplicate-handling selects.
 */
function FileUploadForm({ stepValues, isLoading, onSubmit, isLastStep }: SubFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const { register, handleSubmit } = useForm<FileUploadFormValues>({
    defaultValues: {
      uploadMode: (stepValues.uploadMode as string) ?? 'INSERT_OR_UPDATE',
      duplicateHandling: (stepValues.duplicateHandling as string) ?? 'OVERWRITE',
    },
  })

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

  const onFormSubmit = async (formValues: FileUploadFormValues) => {
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

  return (
    <form id="bulk-load-sub-form" onSubmit={handleSubmit(onFormSubmit)} noValidate className="space-y-6">
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
              <p className="text-sm font-medium text-foreground">
                Drop your CSV file here, or click to browse
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Accepts .csv, .tsv, .txt files</p>
            </div>
          </div>
        )}
      </div>

      {/* Upload options */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="bulk-load-upload-mode" className="text-sm font-medium text-foreground">
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
          <label htmlFor="bulk-load-duplicate-handling" className="text-sm font-medium text-foreground">
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

      {/* Hidden submit triggers from outer action bar */}
      <input type="submit" id="bulk-load-submit-trigger" disabled={!selectedFile || isLoading} className="hidden" aria-hidden="true" />
    </form>
  )
}

/**
 * SFTP credentials sub-form with host, username, password, and optional remote path.
 */
function SftpCredentialsForm({ stepValues, isLoading, onSubmit, isLastStep }: SubFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<SftpFormValues>({
    defaultValues: {
      sftpHost: (stepValues.sftpHost as string) ?? '',
      sftpUsername: (stepValues.sftpUsername as string) ?? '',
      sftpPassword: (stepValues.sftpPassword as string) ?? '',
      sftpRemotePath: (stepValues.sftpRemotePath as string) ?? '',
    },
  })

  const onFormSubmit = async (formValues: SftpFormValues) => {
    await onSubmit({ ...stepValues, ...formValues })
  }

  return (
    <form id="bulk-load-sub-form" onSubmit={handleSubmit(onFormSubmit)} noValidate className="space-y-4">
      <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
        <Server className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Enter SFTP server credentials to connect and retrieve the import file.</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="sftp-host" className="text-sm font-medium text-foreground">
            SFTP Host <span className="text-destructive" aria-hidden="true">*</span>
          </label>
          <input
            id="sftp-host"
            type="text"
            {...register('sftpHost', { required: 'Host is required' })}
            disabled={isLoading}
            placeholder="sftp.example.com"
            data-qqq-id="bulk-load-sftp-host"
            aria-required="true"
            aria-invalid={errors.sftpHost ? 'true' : 'false'}
            className="rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted"
          />
          {errors.sftpHost && (
            <p className="text-xs text-destructive" role="alert">{errors.sftpHost.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="sftp-username" className="text-sm font-medium text-foreground">
            Username <span className="text-destructive" aria-hidden="true">*</span>
          </label>
          <input
            id="sftp-username"
            type="text"
            {...register('sftpUsername', { required: 'Username is required' })}
            disabled={isLoading}
            placeholder="username"
            data-qqq-id="bulk-load-sftp-username"
            aria-required="true"
            aria-invalid={errors.sftpUsername ? 'true' : 'false'}
            className="rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted"
          />
          {errors.sftpUsername && (
            <p className="text-xs text-destructive" role="alert">{errors.sftpUsername.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="sftp-password" className="text-sm font-medium text-foreground">
            Password <span className="text-destructive" aria-hidden="true">*</span>
          </label>
          <input
            id="sftp-password"
            type="password"
            {...register('sftpPassword', { required: 'Password is required' })}
            disabled={isLoading}
            placeholder="••••••••"
            data-qqq-id="bulk-load-sftp-password"
            aria-required="true"
            aria-invalid={errors.sftpPassword ? 'true' : 'false'}
            autoComplete="current-password"
            className="rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted"
          />
          {errors.sftpPassword && (
            <p className="text-xs text-destructive" role="alert">{errors.sftpPassword.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="sftp-remote-path" className="text-sm font-medium text-foreground">
            Remote Path
          </label>
          <input
            id="sftp-remote-path"
            type="text"
            {...register('sftpRemotePath')}
            disabled={isLoading}
            placeholder="/path/to/file.csv"
            data-qqq-id="bulk-load-sftp-remote-path"
            className="rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted"
          />
        </div>
      </div>

      <input type="submit" id="bulk-load-submit-trigger" className="hidden" aria-hidden="true" />
    </form>
  )
}

/**
 * API credentials sub-form with endpoint URL and API key fields.
 */
function ApiCredentialsForm({ stepValues, isLoading, onSubmit, isLastStep }: SubFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<ApiFormValues>({
    defaultValues: {
      apiEndpoint: (stepValues.apiEndpoint as string) ?? '',
      apiKey: (stepValues.apiKey as string) ?? '',
    },
  })

  const onFormSubmit = async (formValues: ApiFormValues) => {
    await onSubmit({ ...stepValues, ...formValues })
  }

  return (
    <form id="bulk-load-sub-form" onSubmit={handleSubmit(onFormSubmit)} noValidate className="space-y-4">
      <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
        <Key className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Enter the API credentials used to retrieve data for this import.</span>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="api-endpoint" className="text-sm font-medium text-foreground">
          API Endpoint URL <span className="text-destructive" aria-hidden="true">*</span>
        </label>
        <input
          id="api-endpoint"
          type="url"
          {...register('apiEndpoint', {
            required: 'Endpoint URL is required',
            pattern: {
              value: /^https?:\/\/.+/,
              message: 'Must be a valid http(s) URL',
            },
          })}
          disabled={isLoading}
          placeholder="https://api.example.com/data"
          data-qqq-id="bulk-load-api-endpoint"
          aria-required="true"
          aria-invalid={errors.apiEndpoint ? 'true' : 'false'}
          className="rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted"
        />
        {errors.apiEndpoint && (
          <p className="text-xs text-destructive" role="alert">{errors.apiEndpoint.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="api-key" className="text-sm font-medium text-foreground">
          API Key <span className="text-destructive" aria-hidden="true">*</span>
        </label>
        <input
          id="api-key"
          type="password"
          {...register('apiKey', { required: 'API key is required' })}
          disabled={isLoading}
          placeholder="••••••••••••••••"
          data-qqq-id="bulk-load-api-key"
          aria-required="true"
          aria-invalid={errors.apiKey ? 'true' : 'false'}
          autoComplete="off"
          className="rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted"
        />
        {errors.apiKey && (
          <p className="text-xs text-destructive" role="alert">{errors.apiKey.message}</p>
        )}
      </div>

      <input type="submit" id="bulk-load-submit-trigger" className="hidden" aria-hidden="true" />
    </form>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Renders a BULK_LOAD process step with UI differentiated by the component's load type.
 *
 * Reads `QFrontendComponent.values.type` from the step's bulk-load component and
 * renders the appropriate credential or upload form.  The action bar (Cancel / Back /
 * Upload) submits the currently active sub-form via a hidden button trigger.
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
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const bulkLoadType = resolveBulkLoadType(step)

  // Help text from components
  const helpTextComponents = step.components.filter((c) => c.type === 'HELP_TEXT')

  const subFormProps: SubFormProps = { stepValues, isLoading, onSubmit, isLastStep }

  return (
    <div className="space-y-6" data-qqq-id={`process-bulk-load-step-${step.name}`}>
      {/* Help text */}
      {helpTextComponents.map((comp, idx) => (
        <div
          key={idx}
          className="rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary"
        >
          {String(comp.values?.text ?? '')}
        </div>
      ))}

      {/* Bulk-load type indicator badge */}
      {bulkLoadType !== 'FILE_UPLOAD' && (
        <div
          className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary"
          data-qqq-id="bulk-load-type-badge"
        >
          {bulkLoadType === 'SFTP_CREDENTIALS' ? (
            <>
              <Server className="h-3 w-3" aria-hidden="true" />
              SFTP Connection
            </>
          ) : (
            <>
              <Key className="h-3 w-3" aria-hidden="true" />
              API Connection
            </>
          )}
        </div>
      )}

      {/* Sub-form selected by bulk-load type */}
      {bulkLoadType === 'SFTP_CREDENTIALS' ? (
        <SftpCredentialsForm {...subFormProps} />
      ) : bulkLoadType === 'API_CREDENTIALS' ? (
        <ApiCredentialsForm {...subFormProps} />
      ) : (
        <FileUploadForm {...subFormProps} />
      )}

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
              disabled={isLoading}
              data-qqq-id="button-upload"
              onClick={() => {
                // Trigger sub-form submit via the hidden input
                const trigger = document.getElementById('bulk-load-submit-trigger')
                if (trigger instanceof HTMLInputElement) trigger.click()
              }}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
                'text-primary-foreground bg-primary hover:bg-primary/90',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'transition-colors duration-150'
              )}
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
              {isLoading
                ? bulkLoadType === 'FILE_UPLOAD'
                  ? 'Uploading...'
                  : 'Connecting...'
                : isLastStep
                ? bulkLoadType === 'FILE_UPLOAD'
                  ? 'Upload & Submit'
                  : 'Connect & Submit'
                : bulkLoadType === 'FILE_UPLOAD'
                ? 'Upload & Continue'
                : 'Connect & Continue'}
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
