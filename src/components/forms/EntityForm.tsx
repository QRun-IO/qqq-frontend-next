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

// EntityForm — full create/edit form for a record
// Wraps DynamicForm with React Hook Form + Zod validation + save/cancel actions
// Includes unsaved changes guard for both browser navigation and client-side navigation

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Loader2, Save, X } from 'lucide-react'

import type { QTableMetaData, QRecord } from '@/types'
import type { PossibleValueContext } from '@/lib/hooks/use-possible-values'
import { insertRecord, updateRecord } from '@/lib/api/tables'
import { queryKeys } from '@/lib/query-client'
import { zodSchemaFromTableMetadata, defaultValuesFromRecord } from '@/lib/utils/zod-from-metadata'
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

  /** When `true`, the form is rendered inside a modal dialog (heading is moved to a header bar). */
  isModal?: boolean
  /** When `true`, the primary key is omitted from the submit payload, creating a copy of `record`. */
  isCopy?: boolean
  /** When `true`, all form inputs are rendered in a disabled, read-only state. */
  disabled?: boolean

  /** Overrides the auto-generated "Create / Edit / Copy {label}" heading. */
  overrideHeading?: string
  /** Label for the primary submit button; defaults to `"Save"`. */
  saveButtonLabel?: string

  /** Called with the saved record after a successful insert or update. */
  onSuccess?: (record: QRecord) => void
  /** Called when the user clicks Cancel; defaults to navigating back to the record or table. */
  onCancel?: () => void

  /** Default field values that override values derived from `record`. */
  defaultValues?: Record<string, unknown>

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
  disabled = false,
  overrideHeading,
  saveButtonLabel = 'Save',
  onSuccess,
  onCancel,
  defaultValues: propDefaultValues,
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
    () => zodSchemaFromTableMetadata(tableMetaData, fieldNamesToInclude),
    [tableMetaData, fieldNamesToInclude]
  )

  // Build default values (memoized to keep a stable reference for useForm)
  const mergedDefaults = useMemo(() => {
    const computedDefaults: Record<string, unknown> = record
      ? defaultValuesFromRecord(tableMetaData, record.values)
      : {}
    return { ...computedDefaults, ...propDefaultValues }
  }, [tableMetaData, record, propDefaultValues])

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
    reset,
  } = useForm<Record<string, unknown>>({
    resolver: zodResolver(schema),
    defaultValues: mergedDefaults,
  })

  // Reset when record changes (e.g., navigating between records)
  useEffect(() => {
    if (record) {
      reset(defaultValuesFromRecord(tableMetaData, record.values))
    }
  }, [record, tableMetaData, reset])

  // Browser-level navigation guard (tab close, URL change, refresh)
  // Both e.preventDefault() and e.returnValue are required for cross-browser support:
  // Chrome/Edge require returnValue to be set, Firefox/Safari rely on preventDefault().
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

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
      if (isDirty) {
        setPendingNavigation(() => navigateFn)
        setShowUnsavedDialog(true)
      } else {
        navigateFn()
      }
    },
    [isDirty]
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

  // --- Mutations ---
  const insertMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      insertRecord(tableMetaData.name, values),
    onSuccess: (savedRecord) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tableRecords(tableMetaData.name) })
      toast.success(`${tableMetaData.label} created successfully.`)
      if (onSuccess) {
        onSuccess(savedRecord)
      } else {
        const pk = savedRecord.values[tableMetaData.primaryKeyField]
        router.push(`/app/${tableMetaData.name}/${pk}`)
      }
    },
    onError: (err: Error) => {
      toast.error(`Failed to create ${tableMetaData.label}: ${err.message}`)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => {
      const pk = record!.values[tableMetaData.primaryKeyField] as string | number
      return updateRecord(tableMetaData.name, pk, values)
    },
    onSuccess: (savedRecord) => {
      const pk = savedRecord.values[tableMetaData.primaryKeyField] as string | number
      queryClient.invalidateQueries({ queryKey: queryKeys.tableRecord(tableMetaData.name, pk) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tableRecords(tableMetaData.name) })
      toast.success(`${tableMetaData.label} saved successfully.`)
      if (onSuccess) {
        onSuccess(savedRecord)
      } else {
        router.push(`/app/${tableMetaData.name}/${pk}`)
      }
    },
    onError: (err: Error) => {
      toast.error(`Failed to save ${tableMetaData.label}: ${err.message}`)
    },
  })

  const activeMutation = isEdit ? updateMutation : insertMutation
  const mutationError = activeMutation.error as Error | null

  /**
   * React Hook Form submit handler — delegates to the appropriate mutation
   * (insert or update) based on the current form mode.
   *
   * @param values - The validated form field values.
   */
  const onSubmit = useCallback(
    async (values: Record<string, unknown>) => {
      await activeMutation.mutateAsync(values)
    },
    [activeMutation]
  )

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
        router.push(`/app/${tableMetaData.name}/${pk}`)
      } else {
        router.push(`/app/${tableMetaData.name}`)
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
      onSubmit={handleSubmit(onSubmit)}
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
      {mutationError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <strong>Error: </strong>
          {mutationError.message || 'An error occurred while saving.'}
        </div>
      )}

      {/* Fields */}
      <DynamicForm
        register={register}
        control={control}
        errors={errors}
        tableMetaData={tableMetaData}
        fieldNamesToInclude={fieldNamesToInclude}
        possibleValueContext={pvContext}
        disabled={disabled || isSubmitting}
      />

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
          disabled={isSubmitting}
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
          disabled={disabled || isSubmitting || (!isDirty && isEdit)}
          data-qqq-id="button-save"
          className={cn(
            'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
            'text-primary-foreground bg-primary hover:bg-primary/90',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-colors duration-150'
          )}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="h-4 w-4" aria-hidden="true" />
          )}
          {isSubmitting ? 'Saving...' : saveButtonLabel}
        </button>
      </div>
    </form>
  )

  return (
    <>
      {isModal ? (
        <div data-qqq-id={`entity-form-modal-${tableMetaData.name}`}>
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">{heading}</h2>
          </div>
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
