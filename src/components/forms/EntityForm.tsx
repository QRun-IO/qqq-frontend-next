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
 * @file EntityForm — full create/edit/copy form for a QQQ record with validation, mutations, and unsaved-changes guard.
 */

'use client'

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Loader2, Save, X } from 'lucide-react'

import type { QTableMetaData, QRecord, QRecordInput } from '@/types'
import type { PossibleValueContext } from '@/lib/hooks/use-possible-values'
import { insertRecord, updateRecord } from '@/lib/api/tables'
import { queryKeys } from '@/lib/query-client'
import { zodSchemaFromTableMetadata, defaultValuesFromRecord, defaultValuesForCopy, zodFieldFromMetadata, validateCopyPasswords } from '@/lib/utils/zod-from-metadata'
import { cn } from '@/lib/utils/cn'
import { toast } from '@/lib/hooks/use-toast'

import { DynamicForm } from './DynamicForm'
import { UnsavedChangesDialog } from './UnsavedChangesDialog'

/**
 * Props for the {@link EntityForm} component.
 */
export interface EntityFormProps {
  /** Table metadata that drives field rendering, schema generation, and API calls. */
  tableMetaData: QTableMetaData

  /** Existing record values; when provided the form operates in edit mode. */
  record?: QRecord

  /** When `true`, the enclosing dialog supplies the heading. */
  isModal?: boolean
  /** When `true`, copy base values into a new record with a blank key; an editable manual key may be supplied. */
  isCopy?: boolean
  /** Full-copy descendants are validated again immediately before the one insert. */
  copyAssociations?: {
    getRecords: (rootValues: Record<string, unknown>) => Record<string, QRecordInput[]>
    validateResult?: (record: QRecord) => void
    error?: string
    dirty?: boolean
  }
  /** Draft editors rendered inside the single root form, without child form tags. */
  children?: React.ReactNode
  /** When `true`, all form inputs are rendered in a disabled, read-only state. */
  disabled?: boolean

  /** Overrides the auto-generated "Create / Edit / Copy {label}" heading. */
  overrideHeading?: string
  /** Label for the primary submit button; defaults to `"Save"`. */
  saveButtonLabel?: string

  /**
   * Called with the saved record after a successful insert or update.
   * If not provided, the component auto-navigates to the record detail page
   * (edit/copy mode) or the table list page (create mode) after save.
   */
  onSuccess?: (record: QRecord) => void
  /**
   * Called when the user clicks Cancel.
   * If not provided, the component auto-navigates back to the record detail page
   * (edit mode) or the table list page (create/copy mode).
   * When `isDirty` is `true`, an unsaved-changes confirmation dialog is shown
   * before any navigation occurs (whether via this callback or the default).
   */
  onCancel?: () => void

  /** Default field values that override values derived from `record`. */
  defaultValues?: Record<string, unknown>

  /** Declared relationship fields merged after ordinary input validation on insert. */
  fixedValues?: Record<string, string | number | boolean>

  /** Restricts the form to only these fields; when omitted all editable non-hidden fields are shown. */
  fieldNamesToInclude?: string[]

  /** Context used to fetch possible values (table, process, or standalone). */
  possibleValueContext?: PossibleValueContext

  /** Additional CSS classes applied to the `<form>` element. */
  className?: string
}

/**
 * Full create/edit/copy form for a QQQ record.
 *
 * Wraps {@link DynamicForm} with React Hook Form + Zod schema validation,
 * TanStack Query mutations (insert/update), a browser-level `beforeunload`
 * guard, and a client-side unsaved-changes dialog.
 *
 * - In **create** mode (`record` is undefined and `isCopy` is false) the form
 *   calls `insertRecord` on submit.
 * - In **edit** mode (`record` is provided and `isCopy` is false) the form
 *   calls `updateRecord` on submit.
 * - In **copy** mode (`isCopy` is true) the form pre-fills from `record` but
 *   calls `insertRecord`, producing a new record.
 *
 * @param props - See {@link EntityFormProps}.
 * @returns The rendered form with action buttons and unsaved-changes dialog.
 */
export function EntityForm({
  tableMetaData,
  record,
  isModal = false,
  isCopy = false,
  copyAssociations,
  children,
  disabled = false,
  overrideHeading,
  saveButtonLabel = 'Save',
  onSuccess,
  onCancel,
  defaultValues: propDefaultValues,
  fixedValues,
  fieldNamesToInclude,
  possibleValueContext,
  className,
}: EntityFormProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const isEdit = Boolean(record) && !isCopy

  // Unsaved changes dialog state
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null)

  // Build Zod schema from metadata (memoized to avoid expensive recomputation)
  const schema = useMemo(
    () => zodSchemaFromTableMetadata(tableMetaData, fieldNamesToInclude, isCopy),
    [tableMetaData, fieldNamesToInclude, isCopy]
  )

  // Build default values (memoized to keep a stable reference for useForm)
  const { values: mergedDefaults, error: defaultsError } = useMemo(() => {
    try {
      const computedDefaults: Record<string, unknown> = record
        ? (isCopy ? defaultValuesForCopy : defaultValuesFromRecord)(tableMetaData, record.values)
        : {}
      return { values: { ...computedDefaults, ...propDefaultValues }, error: null }
    } catch (error) {
      return { values: {}, error: error instanceof Error ? error.message : 'Source values are unavailable.' }
    }
  }, [tableMetaData, record, propDefaultValues, isCopy])

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting, dirtyFields },
    reset,
  } = useForm<Record<string, unknown>>({
    resolver: zodResolver(schema),
    defaultValues: mergedDefaults,
  })

  // Reset when record changes (e.g., navigating between records)
  useEffect(() => {
    if (record) {
      reset(mergedDefaults)
    }
  }, [record, mergedDefaults, reset])

  const hasChanges = isDirty || Boolean(copyAssociations?.dirty)

  // Browser-level navigation guard (tab close, URL change, refresh)
  // Both e.preventDefault() and e.returnValue are required for cross-browser support:
  // Chrome/Edge require returnValue to be set, Firefox/Safari rely on preventDefault().
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasChanges])

  /**
   * Runs a navigation function only after confirming no unsaved changes exist.
   *
   * When the form is dirty the unsaved-changes dialog is displayed and the
   * navigation function is deferred until the user confirms.  When the form is
   * clean the function is called immediately.
   *
   * @param navigateFn - The navigation action to perform after the guard passes.
   */
  const guardedNavigate = useCallback(
    (navigateFn: () => void) => {
      if (hasChanges) {
        setPendingNavigation(() => navigateFn)
        setShowUnsavedDialog(true)
      } else {
        navigateFn()
      }
    },
    [hasChanges]
  )

  /**
   * Confirms navigation away from the form, executing the deferred navigation
   * function and closing the unsaved-changes dialog.
   */
  const handleConfirmLeave = useCallback(() => {
    setShowUnsavedDialog(false)
    if (pendingNavigation) {
      pendingNavigation()
      setPendingNavigation(null)
    }
  }, [pendingNavigation])

  /**
   * Cancels the pending navigation, keeping the user on the current form and
   * closing the unsaved-changes dialog.
   */
  const handleCancelLeave = useCallback(() => {
    setShowUnsavedDialog(false)
    setPendingNavigation(null)
  }, [])

  /**
   * Check the table's identifier before reporting success or navigating.
   * @param savedRecord - The API adapter's validated record.
   * @returns The record with a usable metadata-defined primary key.
   */
  function validateSavedRecord(savedRecord: QRecord): QRecord {
    const primaryKey = savedRecord.values[tableMetaData.primaryKeyField]
    if ((typeof primaryKey !== 'string' || primaryKey.length === 0) &&
      (typeof primaryKey !== 'number' || !Number.isFinite(primaryKey))) {
      throw new Error('The server did not return a valid record identifier.')
    }
    return savedRecord
  }

  // --- Mutations ---
  const insertMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const relationshipValues: Record<string, unknown> = {}
      for (const [name, value] of Object.entries(fixedValues ?? {})) {
        const field = tableMetaData.fields[name]
        if (!field) throw new Error(`Relationship field ${name} is unavailable`)
        relationshipValues[name] = zodFieldFromMetadata(field).parse(value)
      }
      const insertValues = { ...values, ...relationshipValues }
      const key = tableMetaData.primaryKeyField
      if (isCopy && (insertValues[key] === '' || insertValues[key] == null)) {
        delete insertValues[key]
      }
      if (isCopy) validateCopyPasswords(tableMetaData, insertValues, fieldNamesToInclude)
      if (copyAssociations?.error) throw new Error(copyAssociations.error)
      const associations = copyAssociations?.getRecords(insertValues)
      const saved = validateSavedRecord(await insertRecord(tableMetaData.name, insertValues, associations))
      copyAssociations?.validateResult?.(saved)
      return saved
    },
    onSuccess: (savedRecord) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tableRecords(tableMetaData.name) })
      toast.success(`${tableMetaData.label} created successfully.`)
      if (onSuccess) {
        onSuccess(savedRecord)
      } else {
        const pk = savedRecord.values[tableMetaData.primaryKeyField]
        router.push(`/app/${encodeURIComponent(tableMetaData.name)}/${encodeURIComponent(String(pk))}`)
      }
    },
    onError: (err: Error) => {
      toast.error(`Failed to create ${tableMetaData.label}: ${err.message}`)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const pk = record!.values[tableMetaData.primaryKeyField] as string | number
      return validateSavedRecord(await updateRecord(tableMetaData.name, pk, values))
    },
    onSuccess: (savedRecord) => {
      const pk = savedRecord.values[tableMetaData.primaryKeyField] as string | number
      queryClient.invalidateQueries({ queryKey: queryKeys.tableRecord(tableMetaData.name, pk) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tableRecords(tableMetaData.name) })
      toast.success(`${tableMetaData.label} saved successfully.`)
      if (onSuccess) {
        onSuccess(savedRecord)
      } else {
        router.push(`/app/${encodeURIComponent(tableMetaData.name)}/${encodeURIComponent(String(pk))}`)
      }
    },
    onError: (err: Error) => {
      toast.error(`Failed to save ${tableMetaData.label}: ${err.message}`)
    },
  })

  const activeMutation = isEdit ? updateMutation : insertMutation
  const mutationError = activeMutation.error as Error | null
  const isSaving = isSubmitting || activeMutation.isPending

  /**
   * React Hook Form submit handler — delegates to the appropriate mutation
   * (insert or update) based on the current form mode.
   *
   * @param values - The validated form field values.
   */
  const onSubmit = useCallback(
    (values: Record<string, unknown>) => {
      activeMutation.mutate(values)
    },
    [activeMutation]
  )

  /**
   * Preserve the browser's distinction between malformed numeric input and a blank.
   * @param event - The form submission event.
   * @returns Metadata validation when native numeric input is readable.
   */
  function onFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (defaultsError || copyAssociations?.error) {
      event.preventDefault()
      return
    }
    const invalidNumber = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement>('input[type="number"]'))
      .find((input) => !input.matches(':disabled') && input.validity.badInput)
    if (invalidNumber) {
      event.preventDefault()
      invalidNumber.reportValidity()
      return
    }
    return handleSubmit(onSubmit)(event)
  }

  /**
   * Handles the Cancel button click.
   *
   * Runs the navigation target through {@link guardedNavigate} so unsaved
   * changes trigger a confirmation dialog.  Navigation target priority:
   * 1. `onCancel` prop callback.
   * 2. Record detail page (edit mode).
   * 3. Table list page (create/copy mode).
   */
  const handleCancel = () => {
    const doCancel = () => {
      if (onCancel) {
        onCancel()
      } else if (isEdit && record) {
        const pk = record.values[tableMetaData.primaryKeyField]
        router.push(`/app/${encodeURIComponent(tableMetaData.name)}/${encodeURIComponent(String(pk))}`)
      } else {
        router.push(`/app/${encodeURIComponent(tableMetaData.name)}`)
      }
    }

    guardedNavigate(doCancel)
  }

  // Determine heading
  const heading = overrideHeading ?? (
    isEdit
      ? `Edit ${tableMetaData.label}`
      : isCopy
        ? `Copy ${tableMetaData.label}`
        : `Create ${tableMetaData.label}`
  )

  // Possible value context — default to table context
  const pvContext: PossibleValueContext = possibleValueContext ?? {
    type: 'table',
    tableName: tableMetaData.name,
  }

  const formContent = (
    <form
      onSubmit={onFormSubmit}
      noValidate
      className={cn('flex flex-col gap-6', className)}
      data-qqq-id={`entity-form-${tableMetaData.name}`}
    >
      {/* Heading — only if not modal */}
      {!isModal && (
        <div className="border-b border-border pb-4">
          <h2 className="text-xl font-semibold text-foreground">{heading}</h2>
        </div>
      )}

      {/* Mutation error alert */}
      {(defaultsError || copyAssociations?.error || mutationError) && (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <strong>Error: </strong>
          {defaultsError || copyAssociations?.error || mutationError?.message || 'An error occurred while saving.'}
        </div>
      )}

      {isCopy && Object.values(tableMetaData.fields).some(field => field.type === 'PASSWORD' && field.isEditable && !field.isHidden && !field.adornments?.some(item => item.type === 'REVEAL')) &&
        <p className="text-sm text-muted-foreground">Unreadable passwords are not copied. Enter new values before saving.</p>}

      {/* Fields */}
      <DynamicForm
        register={register}
        control={control}
        errors={errors}
        tableMetaData={tableMetaData}
        fieldNamesToInclude={fieldNamesToInclude}
        possibleValueContext={pvContext}
        disabled={disabled || isSaving || Boolean(defaultsError)}
        dirtyFields={dirtyFields as Record<string, boolean>}
      />

      {children && <fieldset disabled={disabled || isSaving} className="min-w-0">{children}</fieldset>}

      {/* Actions — sticky on mobile, static on desktop */}
      <div
        className={cn(
          'sticky bottom-0 z-10 bg-background border-t border-border py-3 mt-4 -mx-6 px-6',
          'flex items-center justify-end gap-3',
          'md:static md:border-t md:mt-6 md:mx-0 md:px-0'
        )}
        data-qqq-id="entity-form-actions"
      >
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSaving}
          data-qqq-id="button-cancel"
          className={cn(
            'inline-flex items-center gap-2 rounded-md border border-input px-4 py-2 text-sm font-medium',
            'text-foreground bg-background hover:bg-accent',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-colors duration-150'
          )}
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Cancel
        </button>
        <button
          type="submit"
          disabled={disabled || isSaving || Boolean(defaultsError) || Boolean(copyAssociations?.error) || (!isDirty && isEdit)}
          data-qqq-id="button-save"
          className={cn(
            'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
            'text-primary-foreground bg-primary hover:bg-primary/90',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-colors duration-150'
          )}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="h-4 w-4" aria-hidden="true" />
          )}
          {isSaving ? 'Saving...' : saveButtonLabel}
        </button>
      </div>
    </form>
  )

  return (
    <>
      {isModal ? (
        <div data-qqq-id={`entity-form-modal-${tableMetaData.name}`}>
          <div className="p-6">{formContent}</div>
        </div>
      ) : (
        formContent
      )}

      {/* Unsaved changes confirmation dialog */}
      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onStay={handleCancelLeave}
        onLeave={handleConfirmLeave}
      />
    </>
  )
}
