'use client'

// DynamicFormField — renders a single form field based on QFieldMetaData type
// Used by DynamicForm to render each field in a metadata-driven form
// Includes help tooltip support via field.helpContents

import React from 'react'
import type { Control, UseFormRegister, FieldError, FieldErrors } from 'react-hook-form'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { HelpCircle } from 'lucide-react'

import type { QFieldMetaData } from '@/types'
import type { PossibleValueContext } from '@/lib/hooks/use-possible-values'
import { cn } from '@/lib/utils/cn'

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

/** Renders a help tooltip icon next to a field label when helpContents is available */
function FieldHelpTooltip({ field }: { field: QFieldMetaData }) {
  const helpContent = field.helpContents?.[0]
  if (!helpContent?.content) return null

  const helpId = `field-help-content-${field.name}`

  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <button
            type="button"
            tabIndex={0}
            data-qqq-id={`field-help-${field.name}`}
            aria-label={`Help for ${field.label}`}
            className={cn(
              'ml-1 inline-flex items-center rounded-full p-0.5',
              'text-muted-foreground hover:text-foreground',
              'focus:outline-none focus:ring-2 focus:ring-ring'
            )}
          >
            <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            id={helpId}
            side="top"
            sideOffset={4}
            className={cn(
              'z-50 max-w-xs rounded-md border border-border bg-popover px-3 py-2 text-sm shadow-md',
              'text-popover-foreground',
              'animate-in fade-in-0 zoom-in-95'
            )}
          >
            {helpContent.title && (
              <p className="mb-1 font-semibold">{helpContent.title}</p>
            )}
            <p>{helpContent.content}</p>
            {helpContent.links && helpContent.links.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {helpContent.links.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs text-primary hover:underline"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )}
            <TooltipPrimitive.Arrow className="fill-border" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}

/** Wraps a field rendering with an optional help tooltip and aria-describedby linkage */
function FieldWithHelp({
  field,
  children,
}: {
  field: QFieldMetaData
  children: React.ReactNode
}) {
  const hasHelp = field.helpContents && field.helpContents.length > 0 && field.helpContents[0]?.content

  if (!hasHelp) {
    return <>{children}</>
  }

  return (
    <div
      className="relative"
      aria-describedby={`field-help-content-${field.name}`}
    >
      {children}
    </div>
  )
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

  const hasHelp = field.helpContents && field.helpContents.length > 0 && field.helpContents[0]?.content
  const helpDescribedBy = hasHelp ? `field-help-content-${field.name}` : undefined

  // Fields with possibleValues use PossibleValueSelect (async combobox)
  if (field.possibleValueSourceName) {
    const pvContext: PossibleValueContext = possibleValueContext ?? { type: 'standalone' }
    return (
      <FieldWithHelp field={field}>
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
        {hasHelp && <FieldHelpTooltip field={field} />}
      </FieldWithHelp>
    )
  }

  // Check for FILE_UPLOAD adornment (overrides type rendering)
  const hasFileUpload = field.adornments?.some((a) => a.type === 'FILE_UPLOAD')
  if (hasFileUpload || field.type === 'BLOB') {
    return (
      <FieldWithHelp field={field}>
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
        {hasHelp && <FieldHelpTooltip field={field} />}
      </FieldWithHelp>
    )
  }

  switch (field.type) {
    case 'STRING':
      return (
        <FieldWithHelp field={field}>
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
          {hasHelp && <FieldHelpTooltip field={field} />}
        </FieldWithHelp>
      )

    case 'TEXT':
    case 'HTML':
      return (
        <FieldWithHelp field={field}>
          <div className="flex flex-col gap-1">
            <div className="flex items-center">
              <label
                htmlFor={fieldId}
                className="text-sm font-medium text-foreground"
                data-qqq-id={`field-label-${dataQqqId}`}
              >
                {field.label}
                {field.isRequired && (
                  <span className="ml-1 text-destructive" aria-hidden="true">*</span>
                )}
              </label>
              {hasHelp && <FieldHelpTooltip field={field} />}
            </div>
            <textarea
              id={fieldId}
              {...register(field.name)}
              disabled={isDisabled}
              aria-required={field.isRequired}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={
                [fieldError ? `${fieldId}-error` : undefined, helpDescribedBy]
                  .filter(Boolean)
                  .join(' ') || undefined
              }
              data-qqq-id={dataQqqId}
              rows={4}
              className={`w-full rounded-md border px-3 py-2 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring disabled:cursor-not-allowed disabled:bg-muted transition-colors duration-150 resize-y ${
                fieldError ? 'border-destructive focus:ring-destructive' : 'border-input'
              }`}
            />
            {fieldError && (
              <p id={`${fieldId}-error`} className="mt-1 text-sm text-destructive" role="alert">
                {fieldError.message}
              </p>
            )}
          </div>
        </FieldWithHelp>
      )

    case 'INTEGER':
    case 'LONG':
      return (
        <FieldWithHelp field={field}>
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
          {hasHelp && <FieldHelpTooltip field={field} />}
        </FieldWithHelp>
      )

    case 'DECIMAL':
      return (
        <FieldWithHelp field={field}>
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
          {hasHelp && <FieldHelpTooltip field={field} />}
        </FieldWithHelp>
      )

    case 'BOOLEAN':
      return (
        <FieldWithHelp field={field}>
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
          {hasHelp && <FieldHelpTooltip field={field} />}
        </FieldWithHelp>
      )

    case 'DATE':
      return (
        <FieldWithHelp field={field}>
          <DateField
            id={fieldId}
            label={field.label}
            registration={register(field.name)}
            error={fieldError}
            disabled={isDisabled}
            required={field.isRequired}
            data-qqq-id={dataQqqId}
          />
          {hasHelp && <FieldHelpTooltip field={field} />}
        </FieldWithHelp>
      )

    case 'DATE_TIME':
      return (
        <FieldWithHelp field={field}>
          <DateTimeField
            id={fieldId}
            label={field.label}
            registration={register(field.name)}
            error={fieldError}
            disabled={isDisabled}
            required={field.isRequired}
            data-qqq-id={dataQqqId}
          />
          {hasHelp && <FieldHelpTooltip field={field} />}
        </FieldWithHelp>
      )

    case 'TIME':
      return (
        <FieldWithHelp field={field}>
          <div className="flex flex-col gap-1">
            <div className="flex items-center">
              <label
                htmlFor={fieldId}
                className="text-sm font-medium text-foreground"
                data-qqq-id={`field-label-${dataQqqId}`}
              >
                {field.label}
                {field.isRequired && (
                  <span className="ml-1 text-destructive" aria-hidden="true">*</span>
                )}
              </label>
              {hasHelp && <FieldHelpTooltip field={field} />}
            </div>
            <input
              id={fieldId}
              type="time"
              {...register(field.name)}
              disabled={isDisabled}
              aria-required={field.isRequired}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={
                [fieldError ? `${fieldId}-error` : undefined, helpDescribedBy]
                  .filter(Boolean)
                  .join(' ') || undefined
              }
              data-qqq-id={dataQqqId}
              className={`w-full rounded-md border px-3 py-2 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring disabled:cursor-not-allowed disabled:bg-muted transition-colors duration-150 ${
                fieldError ? 'border-destructive focus:ring-destructive' : 'border-input'
              }`}
            />
            {fieldError && (
              <p id={`${fieldId}-error`} className="mt-1 text-sm text-destructive" role="alert">
                {fieldError.message}
              </p>
            )}
          </div>
        </FieldWithHelp>
      )

    case 'PASSWORD':
      return (
        <FieldWithHelp field={field}>
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
          {hasHelp && <FieldHelpTooltip field={field} />}
        </FieldWithHelp>
      )

    default:
      return (
        <FieldWithHelp field={field}>
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
          {hasHelp && <FieldHelpTooltip field={field} />}
        </FieldWithHelp>
      )
  }
}
