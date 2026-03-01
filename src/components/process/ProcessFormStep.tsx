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
 * @file ProcessFormStep — renders a FORM (or EDIT_FORM) process step.
 *
 * Builds a Zod validation schema from step field metadata, pre-populates
 * default values from the current `stepValues`, and delegates rendering to
 * `DynamicForm`.  FILE_UPLOAD / BLOB fields are extracted and forwarded as a
 * separate multipart payload via `onSubmit`.
 */
'use client'

import React, { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, ChevronRight, X } from 'lucide-react'

import type { QFrontendStepMetaData } from '@/types'
import { zodSchemaFromFields } from '@/lib/utils/zod-from-metadata'
import { cn } from '@/lib/utils/cn'

import { DynamicForm } from '@/components/forms/DynamicForm'
import { ProcessCancelDialog } from './ProcessCancelDialog'

/**
 * Props for the {@link ProcessFormStep} component.
 */
export interface ProcessFormStepProps {
  /** Metadata for the current process step, including `formFields` and `components`. */
  step: QFrontendStepMetaData
  /** Name of the owning process, forwarded to DynamicForm for possible-value lookups. */
  processName: string
  /** Current accumulated step values used to pre-populate form defaults. */
  stepValues: Record<string, unknown>
  /** Whether this is the final step in the process (controls button label). */
  isLastStep: boolean
  /** Whether a submission is in progress; disables controls while true. */
  isLoading: boolean
  /**
   * Called when the form is submitted successfully.
   *
   * @param values - Validated field values (FILE_UPLOAD fields removed).
   * @param file - The selected file for FILE_UPLOAD / BLOB fields, if any.
   */
  onSubmit: (values: Record<string, unknown>, file?: File) => Promise<void>
  /** Called when the user confirms cancellation of the process. */
  onCancel: () => void
  /** Called when the user clicks Back; only rendered if `canGoBack` is true. */
  onBack?: () => void
  /** Whether a previous step exists to navigate back to. */
  canGoBack: boolean
}

/**
 * Renders a FORM process step driven by `step.formFields` metadata.
 *
 * Dispatched from `ProcessRun` when `resolveStepType` returns `'FORM'`.
 * Constructs a Zod schema via `zodSchemaFromFields`, wires React Hook Form with
 * that schema as the resolver, and renders all fields via `DynamicForm`.  On
 * submit, FILE_UPLOAD or BLOB fields are stripped from the serialised values map
 * and forwarded as a distinct `file` argument so the caller can issue a
 * multipart/form-data request.  HELP_TEXT component banners are rendered above
 * the field list; an empty-step message is shown when there are no fields and
 * no help text.
 *
 * @param props - {@link ProcessFormStepProps}
 * @returns A `<form>` containing optional help-text banners, the dynamic field
 *   list via `DynamicForm`, and a sticky Cancel / Back / Next|Submit action bar.
 */
export function ProcessFormStep({
  step,
  processName,
  stepValues,
  isLastStep,
  isLoading,
  onSubmit,
  onCancel,
  onBack,
  canGoBack,
}: ProcessFormStepProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const fields = step.formFields ?? []

  // Build Zod schema from field metadata
  const schema = useMemo(
    () => zodSchemaFromFields(fields),
    [fields]
  )

  // Build default values from existing step values
  const defaultValues: Record<string, unknown> = {}
  for (const field of fields) {
    const existing = stepValues[field.name]
    if (existing !== undefined) {
      defaultValues[field.name] = existing
    } else if (field.defaultValue !== undefined) {
      defaultValues[field.name] = field.defaultValue
    } else if (field.type === 'BOOLEAN') {
      defaultValues[field.name] = false
    } else {
      defaultValues[field.name] = ''
    }
  }

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Record<string, unknown>>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  /**
   * React Hook Form submit handler.
   *
   * Detects a FILE_UPLOAD or BLOB field, strips it from the serialised values,
   * and passes the raw File object separately so the parent can send it as
   * multipart form data.
   *
   * @param values - All validated form values from React Hook Form.
   */
  const onFormSubmit = async (values: Record<string, unknown>) => {
    // Extract file from values if any FILE_UPLOAD field exists
    let file: File | undefined
    const fileField = fields.find((f) =>
      f.adornments?.some((a) => a.type === 'FILE_UPLOAD') || f.type === 'BLOB'
    )
    if (fileField && values[fileField.name] instanceof File) {
      file = values[fileField.name] as File
      // Remove file from values — it's sent separately as multipart
      const valuesWithoutFile = Object.fromEntries(
        Object.entries(values).filter(([k]) => k !== fileField.name)
      )
      await onSubmit(valuesWithoutFile, file)
    } else {
      await onSubmit(values)
    }
  }

  // Help text from HELP_TEXT components
  const helpTextComponents = step.components.filter((c) => c.type === 'HELP_TEXT')

  return (
    <form
      onSubmit={handleSubmit(onFormSubmit)}
      noValidate
      className="space-y-6"
      data-qqq-id={`process-form-step-${step.name}`}
    >
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

      {/* Dynamic form fields */}
      {fields.length > 0 && (
        <DynamicForm
          register={register}
          control={control}
          errors={errors}
          fields={fields}
          possibleValueContext={{ type: 'process', processName }}
          disabled={isLoading}
        />
      )}

      {fields.length === 0 && helpTextComponents.length === 0 && (
        <div className="text-sm text-muted-foreground">
          No fields to fill in for this step.
        </div>
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
              type="submit"
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
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              )}
              {isLoading ? 'Processing...' : isLastStep ? 'Submit' : 'Next'}
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
