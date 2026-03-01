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
 * @file ProcessBulkEditStep — renders a BULK_EDIT_FORM process step.
 */
/**
 * ProcessBulkEditStep — renders a BULK_EDIT_FORM process step.
 *
 * Displays each editable field with an opt-in checkbox toggle so users can
 * select only the fields they want to update across multiple records.  Only
 * the enabled fields are submitted; a `bulkEditEnabledFields` list is
 * appended to the values for backend tracking.
 */
'use client'

// ProcessBulkEditStep -- renders a BULK_EDIT_FORM step
// Provides form fields for bulk editing multiple records at once.
// Each field has an "enabled" toggle so users can choose which fields to update.

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
 * Props for the {@link ProcessBulkEditStep} component.
 */
export interface ProcessBulkEditStepProps {
  /** Metadata for the current process step, including `formFields`. */
  step: QFrontendStepMetaData
  /** Name of the owning process, forwarded to DynamicForm for possible-value lookups. */
  processName: string
  /** Current accumulated step values from the process state. */
  stepValues: Record<string, unknown>
  /** Whether this is the final step in the process (controls button label). */
  isLastStep: boolean
  /** Whether a submission is in progress; disables controls while true. */
  isLoading: boolean
  /**
   * Called when the user submits the form.
   *
   * @param values - Only the enabled fields' values plus `bulkEditEnabledFields`.
   */
  onSubmit: (values: Record<string, unknown>) => Promise<void>
  /** Called when the user confirms cancellation of the process. */
  onCancel: () => void
  /** Called when the user clicks Back; only rendered if `canGoBack` is true. */
  onBack?: () => void
  /** Whether a previous step exists to navigate back to. */
  canGoBack: boolean
}

/**
 * Renders a BULK_EDIT_FORM process step.
 *
 * Each field from `step.formFields` is presented with an opt-in checkbox; the
 * underlying DynamicForm field control only appears when the checkbox is checked.
 * Submit is disabled until at least one field is enabled.
 *
 * @param props - {@link ProcessBulkEditStepProps}
 * @returns The rendered bulk edit step form.
 */
export function ProcessBulkEditStep({
  step,
  processName,
  stepValues,
  isLastStep,
  isLoading,
  onSubmit,
  onCancel,
  onBack,
  canGoBack,
}: ProcessBulkEditStepProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const fields = step.formFields ?? []

  // Track which fields the user has opted to include in the bulk edit
  const [enabledFields, setEnabledFields] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const field of fields) {
      initial[field.name] = false
    }
    return initial
  })

  // Build Zod schema from field metadata (all optional since bulk edit fields are opt-in)
  const schema = useMemo(
    () => zodSchemaFromFields(fields.map((f) => ({ ...f, isRequired: false }))),
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
   * Toggles a field's enabled state in the `enabledFields` map.
   *
   * @param fieldName - The metadata name of the field to toggle.
   */
  const toggleField = (fieldName: string) => {
    setEnabledFields((prev) => ({
      ...prev,
      [fieldName]: !prev[fieldName],
    }))
  }

  /** Number of fields currently opted in for the bulk edit. */
  const enabledCount = Object.values(enabledFields).filter(Boolean).length

  /**
   * React Hook Form submit handler; filters values to only enabled fields and
   * appends the `bulkEditEnabledFields` list before calling `onSubmit`.
   *
   * @param values - All form values from React Hook Form.
   */
  const onFormSubmit = async (values: Record<string, unknown>) => {
    // Only submit values for enabled fields
    const filteredValues: Record<string, unknown> = {}
    const enabledFieldNames: string[] = []

    for (const field of fields) {
      if (enabledFields[field.name]) {
        filteredValues[field.name] = values[field.name]
        enabledFieldNames.push(field.name)
      }
    }

    // Include metadata about which fields are being bulk-edited
    filteredValues.bulkEditEnabledFields = enabledFieldNames

    await onSubmit(filteredValues)
  }

  // Help text from HELP_TEXT components
  const helpTextComponents = step.components.filter((c) => c.type === 'HELP_TEXT')

  return (
    <form
      onSubmit={handleSubmit(onFormSubmit)}
      noValidate
      className="space-y-6"
      data-qqq-id={`process-bulk-edit-step-${step.name}`}
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

      {/* Field selection info */}
      <div className="rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
        Select the fields you want to update. Only checked fields will be modified.
        {enabledCount > 0 && (
          <span className="ml-1 font-medium text-primary">
            {enabledCount} field{enabledCount !== 1 ? 's' : ''} selected.
          </span>
        )}
      </div>

      {/* Fields with toggle checkboxes */}
      {fields.length > 0 ? (
        <div className="space-y-4">
          {fields.map((field) => (
            <div
              key={field.name}
              className={cn(
                'rounded-lg border p-4 transition-colors duration-150',
                enabledFields[field.name]
                  ? 'border-primary/20 bg-primary/5'
                  : 'border-border bg-card'
              )}
              data-qqq-id={`bulk-edit-field-${field.name}`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id={`bulk-edit-toggle-${field.name}`}
                  checked={enabledFields[field.name] ?? false}
                  onChange={() => toggleField(field.name)}
                  disabled={isLoading}
                  className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-ring"
                  aria-label={`Include ${field.label} in bulk edit`}
                  data-qqq-id={`bulk-edit-toggle-${field.name}`}
                />
                <div className="flex-1">
                  <label
                    htmlFor={`bulk-edit-toggle-${field.name}`}
                    className="text-sm font-medium text-foreground cursor-pointer"
                  >
                    {field.label}
                  </label>
                  {enabledFields[field.name] && (
                    <div className="mt-2">
                      <DynamicForm
                        register={register}
                        control={control}
                        errors={errors}
                        fields={[field]}
                        possibleValueContext={{ type: 'process', processName }}
                        disabled={isLoading}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">
          No fields available for bulk editing.
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
              disabled={isLoading || enabledCount === 0}
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
