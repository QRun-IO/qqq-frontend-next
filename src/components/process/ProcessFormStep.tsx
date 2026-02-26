'use client'

// ProcessFormStep — renders a FORM step using DynamicForm from Package 3

import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, ChevronRight, X } from 'lucide-react'

import type { QFrontendStepMetaData } from '@/types'
import { zodSchemaFromFields } from '@/lib/utils/zod-from-metadata'
import { cn } from '@/lib/utils/cn'

import { DynamicForm } from '@/components/forms/DynamicForm'

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
  const fields = step.formFields ?? []

  // Build Zod schema from field metadata
  const schema = zodSchemaFromFields(fields)

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
          className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-300"
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
        <div className="text-sm text-gray-500 dark:text-gray-400">
          No fields to fill in for this step.
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
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
            disabled={isLoading}
            data-qqq-id="button-next"
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
              'text-white bg-blue-600 hover:bg-blue-700',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
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
    </form>
  )
}
