'use client'

// ProcessFormStep — renders a FORM step using DynamicForm from Package 3

import React, { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, ChevronRight, X } from 'lucide-react'

import type { QFrontendStepMetaData } from '@/types'
import { zodSchemaFromFields } from '@/lib/utils/zod-from-metadata'
import { cn } from '@/lib/utils/cn'

import { DynamicForm } from '@/components/forms/DynamicForm'
import { ProcessCancelDialog } from './ProcessCancelDialog'

export interface ProcessFormStepProps {
  step: QFrontendStepMetaData
  processName: string
  stepValues: Record<string, unknown>
  isLastStep: boolean
  isLoading: boolean
  onSubmit: (values: Record<string, unknown>, file?: File) => Promise<void>
  onCancel: () => void
  onBack?: () => void
  canGoBack: boolean
}

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
