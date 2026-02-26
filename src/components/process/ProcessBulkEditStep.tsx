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

export interface ProcessBulkEditStepProps {
  step: QFrontendStepMetaData
  processName: string
  stepValues: Record<string, unknown>
  isLastStep: boolean
  isLoading: boolean
  onSubmit: (values: Record<string, unknown>) => Promise<void>
  onCancel: () => void
  onBack?: () => void
  canGoBack: boolean
}

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

  const toggleField = (fieldName: string) => {
    setEnabledFields((prev) => ({
      ...prev,
      [fieldName]: !prev[fieldName],
    }))
  }

  const enabledCount = Object.values(enabledFields).filter(Boolean).length

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
