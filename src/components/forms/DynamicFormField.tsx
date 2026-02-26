'use client'

// DynamicFormField — renders a single form field based on QFieldMetaData type
// Used by DynamicForm to render each field in a metadata-driven form

import React from 'react'
import type { Control, UseFormRegister, FieldError, FieldErrors } from 'react-hook-form'

import type { QFieldMetaData } from '@/types'
import type { PossibleValueContext } from '@/lib/hooks/use-possible-values'

import { TextField } from './field-types/TextField'
import { NumberField } from './field-types/NumberField'
import { BooleanField } from './field-types/BooleanField'
import { DateField } from './field-types/DateField'
import { DateTimeField } from './field-types/DateTimeField'
import { PasswordField } from './field-types/PasswordField'
import { FileUploadField } from './field-types/FileUploadField'
import { PossibleValueSelect } from './PossibleValueSelect'

interface DynamicFormFieldProps {
  field: QFieldMetaData
  register: UseFormRegister<Record<string, unknown>>
  control: Control<Record<string, unknown>>
  errors: FieldErrors<Record<string, unknown>>
  disabled?: boolean
  possibleValueContext?: PossibleValueContext
}

export function DynamicFormField({
  field,
  register,
  control,
  errors,
  disabled = false,
  possibleValueContext,
}: DynamicFormFieldProps) {
  if (field.isHidden) return null
  if (!field.isEditable && !disabled) return null

  const fieldId = `field-${field.name}`
  const fieldError = errors[field.name] as FieldError | undefined
  const isDisabled = disabled || !field.isEditable
  const dataQqqId = field.name

  // Fields with possibleValues use PossibleValueSelect (async combobox)
  if (field.possibleValueSourceName) {
    const pvContext: PossibleValueContext = possibleValueContext ?? { type: 'standalone' }
    return (
      <PossibleValueSelect
        id={fieldId}
        label={field.label}
        name={field.name}
        control={control as Control<Record<string, unknown>>}
        fieldName={field.name}
        context={pvContext}
        error={fieldError}
        disabled={isDisabled}
        required={field.isRequired}
        data-qqq-id={dataQqqId}
      />
    )
  }

  // Check for FILE_UPLOAD adornment (overrides type rendering)
  const hasFileUpload = field.adornments?.some((a) => a.type === 'FILE_UPLOAD')
  if (hasFileUpload || field.type === 'BLOB') {
    return (
      <FileUploadField
        id={fieldId}
        label={field.label}
        name={field.name}
        control={control as Control<Record<string, unknown>>}
        error={fieldError}
        disabled={isDisabled}
        required={field.isRequired}
        data-qqq-id={dataQqqId}
      />
    )
  }

  switch (field.type) {
    case 'STRING':
      return (
        <TextField
          id={fieldId}
          label={field.label}
          registration={register(field.name)}
          error={fieldError}
          disabled={isDisabled}
          maxLength={field.maxLength}
          required={field.isRequired}
          data-qqq-id={dataQqqId}
        />
      )

    case 'TEXT':
    case 'HTML':
      return (
        <div className="flex flex-col gap-1">
          <label
            htmlFor={fieldId}
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
            data-qqq-id={`field-label-${dataQqqId}`}
          >
            {field.label}
            {field.isRequired && (
              <span className="ml-1 text-red-500" aria-hidden="true">*</span>
            )}
          </label>
          <textarea
            id={fieldId}
            {...register(field.name)}
            disabled={isDisabled}
            aria-required={field.isRequired}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? `${fieldId}-error` : undefined}
            data-qqq-id={dataQqqId}
            rows={4}
            className={`w-full rounded-md border px-3 py-2 text-sm text-gray-900 bg-white dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-gray-700 transition-colors duration-150 resize-y ${
              fieldError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {fieldError && (
            <p id={`${fieldId}-error`} className="text-xs text-red-600 dark:text-red-400" role="alert">
              {fieldError.message}
            </p>
          )}
        </div>
      )

    case 'INTEGER':
    case 'LONG':
      return (
        <NumberField
          id={fieldId}
          label={field.label}
          registration={register(field.name, { valueAsNumber: true })}
          error={fieldError}
          disabled={isDisabled}
          required={field.isRequired}
          step={1}
          data-qqq-id={dataQqqId}
        />
      )

    case 'DECIMAL':
      return (
        <NumberField
          id={fieldId}
          label={field.label}
          registration={register(field.name, { valueAsNumber: true })}
          error={fieldError}
          disabled={isDisabled}
          required={field.isRequired}
          step="any"
          data-qqq-id={dataQqqId}
        />
      )

    case 'BOOLEAN':
      return (
        <BooleanField
          id={fieldId}
          label={field.label}
          name={field.name}
          control={control as Control<Record<string, unknown>>}
          error={fieldError}
          disabled={isDisabled}
          required={field.isRequired}
          data-qqq-id={dataQqqId}
        />
      )

    case 'DATE':
      return (
        <DateField
          id={fieldId}
          label={field.label}
          registration={register(field.name)}
          error={fieldError}
          disabled={isDisabled}
          required={field.isRequired}
          data-qqq-id={dataQqqId}
        />
      )

    case 'DATE_TIME':
      return (
        <DateTimeField
          id={fieldId}
          label={field.label}
          registration={register(field.name)}
          error={fieldError}
          disabled={isDisabled}
          required={field.isRequired}
          data-qqq-id={dataQqqId}
        />
      )

    case 'TIME':
      return (
        <div className="flex flex-col gap-1">
          <label
            htmlFor={fieldId}
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
            data-qqq-id={`field-label-${dataQqqId}`}
          >
            {field.label}
            {field.isRequired && (
              <span className="ml-1 text-red-500" aria-hidden="true">*</span>
            )}
          </label>
          <input
            id={fieldId}
            type="time"
            {...register(field.name)}
            disabled={isDisabled}
            aria-required={field.isRequired}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? `${fieldId}-error` : undefined}
            data-qqq-id={dataQqqId}
            className={`w-full rounded-md border px-3 py-2 text-sm text-gray-900 bg-white dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-gray-700 transition-colors duration-150 ${
              fieldError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {fieldError && (
            <p id={`${fieldId}-error`} className="text-xs text-red-600 dark:text-red-400" role="alert">
              {fieldError.message}
            </p>
          )}
        </div>
      )

    case 'PASSWORD':
      return (
        <PasswordField
          id={fieldId}
          label={field.label}
          registration={register(field.name)}
          error={fieldError}
          disabled={isDisabled}
          maxLength={field.maxLength}
          required={field.isRequired}
          data-qqq-id={dataQqqId}
        />
      )

    default:
      return (
        <TextField
          id={fieldId}
          label={field.label}
          registration={register(field.name)}
          error={fieldError}
          disabled={isDisabled}
          maxLength={field.maxLength}
          required={field.isRequired}
          data-qqq-id={dataQqqId}
        />
      )
  }
}
