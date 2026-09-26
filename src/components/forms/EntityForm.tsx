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
 * @file EntityForm — full create/edit/copy form for a QQQ record with validation, mutations,
 * unsaved-changes guard, form adjusters, field rules and editable widget sections.
 */

'use client'

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Loader2, Save, X } from 'lucide-react'

import type { QTableMetaData, QTableSection, QRecord, QRecordInput, QWidgetMetaData } from '@/types'
import type { PossibleValueContext } from '@/lib/hooks/use-possible-values'
import { insertRecord, updateRecord } from '@/lib/api/tables'
import { runFormAdjuster } from '@/lib/api/form-adjuster'
import type { FormAdjusterOutput } from '@/lib/api/form-adjuster'
import { recordAnalytics } from '@/lib/analytics'
import { HANDLES_OWN_ERRORS, queryKeys } from '@/lib/query-client'
import {
  zodSchemaFromTableMetadata, defaultValuesFromRecord, defaultValuesForCopy, defaultValuesForCreate, zodFieldFromMetadata,
  validateCopyPasswords, wireValuesFromForm, formValueFromRecordValue,
} from '@/lib/utils/zod-from-metadata'
import { applyAdjustedDefinitions, fieldFormAdjusters, hasTableOnLoadAdjuster, tableFieldRules } from '@/lib/utils/form-adjuster-utils'
import { cn } from '@/lib/utils/cn'
import { getErrorMessage } from '@/lib/utils/error-utils'
import { MATERIAL_BUTTON_VARIANTS, sanitizeQqqId } from '@/lib/utils/qqq-id'
import { EDIT_SCREEN_HELP_ROLES, INSERT_SCREEN_HELP_ROLES } from '@/lib/utils/help-utils'
import { isImplicitSubmitKey } from '@/lib/utils/form-layout'
import { firstRecordWarning, isWarningMessage, rememberSaveWarning } from '@/lib/utils/save-warning'
import { toast } from '@/lib/hooks/use-toast'
import { MetadataIcon, SectionIcon } from '@/components/layout/MetadataIcon'

import { HoverTooltip } from '@/components/widgets/HoverTooltip'
import { DynamicForm, formSectionElementId, renderableFormSections } from './DynamicForm'
import { FormWidgetSection, isEditableFormWidget } from './FormWidgetSection'
import { FormSectionSidebar } from './FormSectionSidebar'
import { UnsavedChangesDialog } from './UnsavedChangesDialog'

/** How long a save's warning stays on screen when it is shown as a toast. */
const WARNING_TOAST_MILLIS = 10_000

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
   * When given, a valid submission is handed to this callback instead of being saved
   * (Material's `onSubmitCallback`): a child record edited inside its parent's form.
   */
  onSubmitValues?: (values: Record<string, unknown>) => void
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

  /** Fields shown disabled with their default value (Material link `disabledFields`). */
  disabledFieldNames?: string[]

  /** Restricts the form to only these fields; when omitted all editable non-hidden fields are shown. */
  fieldNamesToInclude?: string[]

  /** Context used to fetch possible values (table, process, or standalone). */
  possibleValueContext?: PossibleValueContext

  /**
   * Widget metadata by name: widget sections shown on edit screens (child record lists that
   * manage an association, filter and column, pivot table and dynamic form setups, row
   * builders, cron schedules) render as editable parts of the form.
   */
  widgets?: Record<string, QWidgetMetaData>

  /** Additional CSS classes applied to the `<form>` element. */
  className?: string
}

/** What the form starts from: values, field and section definitions, labels and lock state. */
interface PreparedForm {
  table: QTableMetaData
  values: Record<string, unknown>
  error: string | null
  displayValues: Record<string, string>
  disabledMessage: string | null
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
 * When the table declares a Material dashboard on-load form adjuster, it runs before the
 * form renders (Material's EntityForm): it may change field and section definitions, values
 * and labels, or lock the form.
 *
 * @param props - See {@link EntityFormProps}.
 * @returns The rendered form with action buttons and unsaved-changes dialog.
 */
export function EntityForm(props: EntityFormProps) {
  const { tableMetaData, record, isCopy = false, defaultValues: propDefaultValues } = props
  const isEdit = Boolean(record) && !isCopy

  // Build default values (memoized to keep a stable reference for useForm)
  const base = useMemo(() => {
    try {
      const computedDefaults: Record<string, unknown> = record
        ? (isCopy ? defaultValuesForCopy : defaultValuesFromRecord)(tableMetaData, record.values)
        : defaultValuesForCreate(tableMetaData)
      return { values: { ...computedDefaults, ...propDefaultValues }, error: null }
    } catch (error) {
      return { values: {}, error: error instanceof Error ? error.message : 'Source values are unavailable.' }
    }
  }, [tableMetaData, record, propDefaultValues, isCopy])

  const runsOnLoad = hasTableOnLoadAdjuster(tableMetaData) && !base.error
  const primaryKey = record?.values[tableMetaData.primaryKeyField]
  const adjusted = useQuery({
    queryKey: ['qqq', 'formAdjuster', 'table', tableMetaData.name, isEdit ? 'edit' : isCopy ? 'copy' : 'create', primaryKey ?? null, JSON.stringify(base.values)],
    queryFn: () => runFormAdjuster(`table:${tableMetaData.name}`, 'onLoad', { allValues: { ...(record?.values ?? {}), ...base.values } }),
    enabled: runsOnLoad,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    meta: HANDLES_OWN_ERRORS,
  })

  const prepared = useMemo<PreparedForm | null>(() => {
    const start: PreparedForm = { table: tableMetaData, values: base.values, error: base.error, displayValues: {}, disabledMessage: null }
    if (!runsOnLoad) return start
    if (!adjusted.data) return null
    return prepareFromOnLoad(start, adjusted.data, isEdit)
  }, [tableMetaData, base, runsOnLoad, adjusted.data, isEdit])

  if (runsOnLoad && adjusted.isError) {
    return (
      <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive" data-qqq-id={`entity-form-error-${tableMetaData.name}`}>
        <strong>Error: </strong>{`The form could not be prepared: ${getErrorMessage(adjusted.error)}`}
      </div>
    )
  }
  if (!prepared) {
    return (
      <div className="flex items-center justify-center py-16" role="status" aria-busy="true" aria-live="polite" data-qqq-id={`entity-form-loading-${tableMetaData.name}`}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-hidden="true" />
        <span className="sr-only">Loading form...</span>
      </div>
    )
  }
  return <EntityFormBody {...props} prepared={prepared} />
}

/**
 * Applies a table on-load adjuster's output to the form's starting point, as Material's
 * `runOnLoadFormAdjuster` does before the form renders.
 *
 * @param start - Values and definitions before the adjuster.
 * @param output - The adjuster's output.
 * @param isEdit - Whether the form edits an existing record (for the default lock message).
 * @returns The adjusted starting point.
 */
function prepareFromOnLoad(start: PreparedForm, output: FormAdjusterOutput, isEdit: boolean): PreparedForm {
  const table = applyAdjustedDefinitions(start.table, output)
  const values = { ...start.values }
  for (const [name, value] of Object.entries(output.updatedFieldValues ?? {})) {
    const field = table.fields[name]
    values[name] = field ? formValueFromRecordValue(field, value) : value
  }
  for (const name of output.fieldsToClear ?? []) {
    const field = table.fields[name]
    values[name] = field ? formValueFromRecordValue(field, null) : null
  }
  const disabledMessage = output.isFormDisabled
    ? (output.formDisabledMessage || (isEdit ? 'You are not allowed to edit this record.' : 'You are not allowed to create a new record.'))
    : null
  return { table, values, error: start.error, displayValues: { ...(output.updatedFieldDisplayValues ?? {}) }, disabledMessage }
}

/**
 * The value a cleared field holds in the form (null for a boolean, empty otherwise).
 *
 * @param table - The form's table definition.
 * @param name - Field name.
 * @returns The cleared value.
 */
function clearedValue(table: QTableMetaData, name: string): unknown {
  const field = table.fields[name]
  return field ? formValueFromRecordValue(field, null) : null
}

/**
 * The body of {@link EntityForm}, once any on-load adjuster has prepared it.
 *
 * @param props - Entity form properties with prepared field definitions and values.
 * @returns The editable form and its actions.
 */
function EntityFormBody(props: EntityFormProps & { prepared: PreparedForm }) {
  const {
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
    onSubmitValues,
    onCancel,
    defaultValues: propDefaultValues,
    fixedValues,
    disabledFieldNames,
    fieldNamesToInclude,
    possibleValueContext,
    widgets,
    className,
    prepared,
  } = props
  const router = useRouter()
  const queryClient = useQueryClient()
  const isEdit = Boolean(record) && !isCopy
  const mergedDefaults = prepared.values
  const defaultsError = prepared.error

  // Field and section definitions, which form adjusters may replace while the user edits.
  const [formTable, setFormTable] = useState<QTableMetaData>(prepared.table)
  // Possible-value labels given by adjusters for values they set.
  const [displayOverrides, setDisplayOverrides] = useState<Record<string, string>>(prepared.displayValues)
  // Fields read-only while a field adjuster call runs (fieldsToDisableWhileRunningAdjusters).
  const [adjustingFields, setAdjustingFields] = useState<string[]>([])
  // Parameters a field rule added to a widget's request (RELOAD_WIDGET), by widget name.
  const [widgetReloads, setWidgetReloads] = useState<Record<string, { params: Record<string, string | number | boolean>; count: number }>>({})
  // Child records widgets manage for associations of this table, saved with the record.
  const [associations, setAssociations] = useState<Record<string, Array<Record<string, unknown>>>>({})
  // Checks widgets registered to run before saving (Material addSubValidations).
  const validatorsRef = useRef(new Map<string, () => string[]>())
  const [widgetErrors, setWidgetErrors] = useState<string[]>([])

  useEffect(() => {
    setFormTable(prepared.table)
    setDisplayOverrides(prepared.displayValues)
  }, [prepared])

  // Unsaved changes dialog state
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null)

  // Build Zod schema from metadata (memoized to avoid expensive recomputation). Values that
  // widgets write (e.g. a saved report's filter JSON, a hidden field) pass through unchanged.
  const schema = useMemo(
    () => zodSchemaFromTableMetadata(formTable, fieldNamesToInclude, isCopy).passthrough(),
    [formTable, fieldNamesToInclude, isCopy]
  )
  // Adjusters may change field definitions after the form mounts: validate with the latest schema.
  const schemaRef = useRef(schema)
  schemaRef.current = schema
  const resolver = useCallback<Resolver<Record<string, unknown>>>(
    (values, context, options) => zodResolver(schemaRef.current)(values, context, options),
    []
  )

  const form = useForm<Record<string, unknown>>({
    resolver,
    defaultValues: mergedDefaults,
  })
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting, dirtyFields },
    reset,
    setValue,
    getValues,
    watch,
  } = form

  // Latest dirty-field map for the update mutation (values that cannot round-trip are sent only when changed).
  const dirtyFieldsRef = useRef<Record<string, unknown>>({})
  // Staying on the form after the unsaved-changes prompt returns focus to Cancel
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  dirtyFieldsRef.current = dirtyFields as Record<string, unknown>

  // Reset when record changes (e.g., navigating between records)
  useEffect(() => {
    if (record) {
      reset(mergedDefaults)
    }
  }, [record, mergedDefaults, reset])

  const hasChanges = isDirty || Boolean(copyAssociations?.dirty) || Object.keys(associations).length > 0

  // Material's form-opened events (QRun-IO/qqq#730); the record label only with record data allowed
  const openedEventSent = useRef(false)
  useEffect(() => {
    if (openedEventSent.current || (!record && (isEdit || isCopy))) return
    openedEventSent.current = true
    recordAnalytics(record
      ? { category: 'tableEvents', action: isCopy ? 'copy' : 'edit', label: tableMetaData.label, recordLabel: record.recordLabel }
      : { category: 'tableEvents', action: 'new', label: tableMetaData.label })
  }, [record, isEdit, isCopy, tableMetaData.label])

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

  // ---------------------------------------------------------------------------------------
  // Form adjusters (Material DynamicForm): field adjusters run when a field loads, after a
  // possible value, boolean or file changes, and when a text input loses focus.
  // ---------------------------------------------------------------------------------------
  const formTableRef = useRef(formTable)
  formTableRef.current = formTable

  /**
   * Applies a field adjuster's output to the running form (Material DynamicForm): field and
   * section definitions, values and their labels, and cleared fields.
   *
   * @param output - The adjuster's output.
   */
  const applyFieldAdjusterOutput = useCallback((output: FormAdjusterOutput) => {
    if (output.updatedFieldMetaData || output.updatedSectionMetaData) {
      setFormTable((table) => applyAdjustedDefinitions(table, output))
    }
    const table = applyAdjustedDefinitions(formTableRef.current, output)
    for (const [name, value] of Object.entries(output.updatedFieldValues ?? {})) {
      const field = table.fields[name]
      setValue(name, field ? formValueFromRecordValue(field, value) : value, { shouldDirty: true })
    }
    if (output.updatedFieldDisplayValues) {
      setDisplayOverrides((current) => ({ ...current, ...output.updatedFieldDisplayValues }))
    }
    for (const name of output.fieldsToClear ?? []) {
      setValue(name, clearedValue(table, name), { shouldDirty: true })
    }
  }, [setValue])

  /**
   * Runs a field's adjuster for an event, keeping its fieldsToDisableWhileRunningAdjusters
   * read-only until the answer is applied.
   *
   * @param fieldName - The field the event is for.
   * @param event - `onLoad` or `onChange`.
   * @param newValue - The field's (new) value.
   */
  const runFieldAdjuster = useCallback(async (fieldName: string, event: 'onLoad' | 'onChange', newValue: unknown) => {
    const adjusters = fieldFormAdjusters(formTableRef.current.fields[fieldName])
    if (!adjusters || !(event === 'onLoad' ? adjusters.onLoad : adjusters.onChange)) return
    const disable = adjusters.fieldsToDisableWhileRunning
    if (disable.length > 0) setAdjustingFields((current) => [...current, ...disable])
    try {
      const output = await runFormAdjuster(adjusters.identifier, event, { fieldName, newValue, allValues: { ...(record?.values ?? {}), ...getValues() } })
      applyFieldAdjusterOutput(output)
    } catch (error) {
      toast.error(`Could not update the form: ${getErrorMessage(error)}`)
    } finally {
      if (disable.length > 0) {
        setAdjustingFields((current) => {
          const remaining = [...current]
          for (const name of disable) remaining.splice(remaining.indexOf(name), 1)
          return remaining
        })
      }
    }
  }, [applyFieldAdjusterOutput, getValues, record])

  // Field on-load adjusters run once, when the form mounts (for the fields it shows).
  const ranOnLoad = useRef(false)
  useEffect(() => {
    if (ranOnLoad.current) return
    ranOnLoad.current = true
    void (async () => {
      for (const field of Object.values(formTableRef.current.fields)) {
        if (field.isHidden || (fieldNamesToInclude && !fieldNamesToInclude.includes(field.name))) continue
        if (fieldFormAdjusters(field)?.onLoad) await runFieldAdjuster(field.name, 'onLoad', getValues(field.name))
      }
    })()
  }, [fieldNamesToInclude, getValues, runFieldAdjuster])

  // Text-like inputs run their on-change adjuster when they lose focus (Material's blur handler).
  const onFieldBlur = useCallback((fieldName: string, value: unknown) => {
    void runFieldAdjuster(fieldName, 'onChange', value)
  }, [runFieldAdjuster])

  // User changes: field rules (Material handleChangedFieldValue) and the on-change adjusters of
  // possible value, boolean and file fields. Values set by code (adjusters, rules) do not trigger them.
  const fieldRules = useMemo(() => tableFieldRules(tableMetaData), [tableMetaData])
  useEffect(() => {
    const subscription = watch((values, { name, type }) => {
      if (type !== 'change' || !name) return
      const newValue = values[name]
      for (const rule of fieldRules) {
        if (rule.trigger !== 'ON_CHANGE' || rule.sourceField !== name) continue
        if (rule.action === 'CLEAR_TARGET_FIELD' && rule.targetField) {
          setValue(rule.targetField, clearedValue(formTableRef.current, rule.targetField), { shouldDirty: true })
        } else if (rule.action === 'RELOAD_WIDGET' && rule.targetWidget) {
          const params: Record<string, string | number | boolean> = {}
          if (newValue !== null && newValue !== undefined && newValue !== '' && (typeof newValue === 'string' || typeof newValue === 'number' || typeof newValue === 'boolean')) {
            params[rule.sourceField] = newValue
          }
          const target = rule.targetWidget
          setWidgetReloads((current) => ({ ...current, [target]: { params, count: (current[target]?.count ?? 0) + 1 } }))
        }
      }
      const field = formTableRef.current.fields[name]
      if (field && (field.possibleValueSourceName || field.inlinePossibleValueSource || field.type === 'BOOLEAN' || field.type === 'BLOB' ||
        field.adornments?.some((adornment) => adornment.type === 'FILE_UPLOAD'))) {
        void runFieldAdjuster(name, 'onChange', newValue)
      }
    })
    return () => subscription.unsubscribe()
  }, [watch, fieldRules, setValue, runFieldAdjuster])

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

  /**
   * The associations widgets changed, as the record write sends them.
   * @returns Named child records, or undefined when no widget changed any.
   */
  function widgetAssociations(): Record<string, QRecordInput[]> | undefined {
    const names = Object.keys(associations)
    if (names.length === 0) return undefined
    return Object.fromEntries(names.map((name) => [name, associations[name].map((values) => ({ values }))]))
  }

  // --- Mutations ---
  const insertMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      recordAnalytics({ category: 'tableEvents', action: isCopy ? 'saveCopy' : 'saveNew', label: tableMetaData.label })
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
      const associationGroups = copyAssociations ? copyAssociations.getRecords(insertValues) : widgetAssociations()
      const saved = validateSavedRecord(await insertRecord(tableMetaData.name, wireValuesFromForm(tableMetaData, insertValues), associationGroups))
      copyAssociations?.validateResult?.(saved)
      return saved
    },
    meta: HANDLES_OWN_ERRORS,
    onSuccess: (savedRecord) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tableRecords(tableMetaData.name) })
      toast.success(`${tableMetaData.label} created successfully.`)
      const warning = firstRecordWarning(savedRecord)
      if (onSuccess) {
        if (warning) toast.warning(warning, { duration: WARNING_TOAST_MILLIS })
        onSuccess(savedRecord)
      } else {
        const pk = savedRecord.values[tableMetaData.primaryKeyField] as string | number
        // the record view shows the save's warning once, after this redirect (Material: navigation state)
        if (warning) rememberSaveWarning(tableMetaData.name, pk, warning)
        router.push(`/app/${encodeURIComponent(tableMetaData.name)}/${encodeURIComponent(String(pk))}`)
      }
    },
    onError: (err: Error) => {
      const message = getErrorMessage(err)
      // a "warning..." refusal is reported as a warning on the form, not as a failure
      if (isWarningMessage(message)) toast.warning(message, { duration: WARNING_TOAST_MILLIS })
      else toast.error(`Failed to create ${tableMetaData.label}: ${message}`)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      recordAnalytics({ category: 'tableEvents', action: 'saveEdit', label: tableMetaData.label })
      const pk = record!.values[tableMetaData.primaryKeyField] as string | number
      // Values that cannot round-trip through the form are sent only when changed: a
      // masked password, a LONG beyond 2^53, a date-time shown at minute/second precision
      // and a file (a download URL or bytes). Other values are re-sent as stored, as the
      // Material dashboard does, so omission never triggers a write default.
      const submitted = Object.fromEntries(Object.entries(values).filter(([name]) =>
        Boolean(dirtyFieldsRef.current[name]) || !onlyWhenChanged(tableMetaData.fields[name])))
      return validateSavedRecord(await updateRecord(tableMetaData.name, pk, wireValuesFromForm(tableMetaData, submitted), widgetAssociations()))
    },
    meta: HANDLES_OWN_ERRORS,
    onSuccess: (savedRecord) => {
      const pk = savedRecord.values[tableMetaData.primaryKeyField] as string | number
      finishUpdate(pk, firstRecordWarning(savedRecord), () => onSuccess?.(savedRecord))
    },
    onError: (err: Error) => {
      const message = getErrorMessage(err)
      // Material: a save error starting with "warning" is a success with that warning, back on the view
      if (isWarningMessage(message) && record && !onSuccess) {
        finishUpdate(record.values[tableMetaData.primaryKeyField] as string | number, message)
        return
      }
      if (isWarningMessage(message)) toast.warning(message, { duration: WARNING_TOAST_MILLIS })
      else toast.error(`Failed to save ${tableMetaData.label}: ${message}`)
    },
  })

  /**
   * Reports a finished update and returns to the record view, carrying the save's warning.
   *
   * @param pk - The record's primary key.
   * @param warning - The save's warning, if any.
   * @param callback - The caller's success handler, when it handles the navigation.
   */
  function finishUpdate(pk: string | number, warning: string | undefined, callback?: () => void) {
    queryClient.invalidateQueries({ queryKey: queryKeys.tableRecord(tableMetaData.name, pk) })
    queryClient.invalidateQueries({ queryKey: queryKeys.tableRecords(tableMetaData.name) })
    toast.success(`${tableMetaData.label} saved successfully.`)
    if (onSuccess && callback) {
      if (warning) toast.warning(warning, { duration: WARNING_TOAST_MILLIS })
      callback()
    } else {
      if (warning) rememberSaveWarning(tableMetaData.name, pk, warning)
      router.push(`/app/${encodeURIComponent(tableMetaData.name)}/${encodeURIComponent(String(pk))}`)
    }
  }

  const activeMutation = isEdit ? updateMutation : insertMutation
  const failure = activeMutation.error as Error | null
  const failureMessage = failure ? getErrorMessage(failure, 'An error occurred while saving.') : null
  // a "warning..." refusal that did not return to the view is shown as a warning, not an error
  const mutationWarning = failureMessage && isWarningMessage(failureMessage) ? failureMessage : null
  const mutationError = mutationWarning ? null : failure
  const isSaving = isSubmitting || activeMutation.isPending
  const formDisabledMessage = prepared.disabledMessage

  /**
   * React Hook Form submit handler — runs the widgets' checks, then delegates to the
   * appropriate mutation (insert or update), or hands the values to `onSubmitValues`.
   *
   * @param values - The validated form field values.
   */
  const onSubmit = useCallback(
    (values: Record<string, unknown>) => {
      const problems = [...validatorsRef.current.values()].flatMap((validate) => validate())
      setWidgetErrors(problems)
      if (problems.length > 0) return
      if (onSubmitValues) {
        onSubmitValues(values)
        return
      }
      activeMutation.mutate(values)
    },
    [activeMutation, onSubmitValues]
  )

  /**
   * Preserve the browser's distinction between malformed numeric input and a blank.
   * @param event - The form submission event.
   * @returns Metadata validation when native numeric input is readable.
   */
  function onFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    // A form in a dialog over another form (a child record) must not submit its parent too.
    event.stopPropagation()
    if (defaultsError || copyAssociations?.error || formDisabledMessage) {
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

  // Heading, as in Material: "Creating New X", "Edit X: <record label>", "Copy X: <record label>"
  const recordLabel = record ? (record.recordLabel || String(record.values[tableMetaData.primaryKeyField] ?? '')) : ''
  const heading = overrideHeading ?? (
    isEdit
      ? `Edit ${tableMetaData.label}: ${recordLabel}`
      : isCopy
        ? `Copy ${tableMetaData.label}: ${recordLabel}`
        : `Creating New ${tableMetaData.label}`
  )

  // Page forms show the first T1 section's fields in the header card, under the title, and a
  // sidebar of the form's sections (Material EntityForm); modal forms keep a plain layout.
  const fieldSections = renderableFormSections(formTable, {
    fieldNamesToInclude, showReadOnlyFields: isEdit, disabled: disabled || Boolean(defaultsError) || Boolean(formDisabledMessage), widgets,
  })
  const formSections = isModal ? [] : (formTable.sections ?? []).flatMap((section) => {
    const fieldSection = fieldSections.find((entry) => entry.section.name === section.name)
    if (fieldSection) return [fieldSection]
    const widget = section.widgetName ? widgets?.[section.widgetName] : undefined
    return !isCopy && !section.isHidden && !section.hidden && widget && widget.hasPermission !== false && isEditableFormWidget(widget)
      ? [{ section, fields: [] }]
      : []
  })
  const headerSection = formSections.find(({ section }) => section.tier === 'T1')?.section
  const bodySections = headerSection ? (formTable.sections ?? []).filter((section) => section.name !== headerSection.name) : undefined

  // Material CSS hooks (QRun-IO/qqq#731): record-{mode}-{part}-{table}
  const formMode = isCopy ? 'copy' : isEdit ? 'edit' : 'create'
  const tableNameForId = sanitizeQqqId(tableMetaData.name)

  // Possible value context — default to table context
  const pvContext: PossibleValueContext = possibleValueContext ?? {
    type: 'table',
    tableName: tableMetaData.name,
  }

  // ---------------------------------------------------------------------------------------
  // Widget sections (Material getWidgetSection): shown on create and edit screens.
  // ---------------------------------------------------------------------------------------
  const setAssociation = useCallback((name: string, records: Array<Record<string, unknown>>) => {
    setAssociations((current) => ({ ...current, [name]: records }))
  }, [])
  const setFormValues = useCallback((values: Record<string, unknown>) => {
    for (const [name, value] of Object.entries(values)) setValue(name, value, { shouldDirty: true })
  }, [setValue])
  const registerValidator = useCallback((key: string, validate: (() => string[]) | null) => {
    if (validate) validatorsRef.current.set(key, validate)
    else validatorsRef.current.delete(key)
  }, [])
  const widgetParams = useMemo(() => {
    const params: Record<string, string | number | boolean> = {}
    const pk = record?.values[tableMetaData.primaryKeyField]
    if (isEdit && pk !== null && pk !== undefined && pk !== '') params[tableMetaData.primaryKeyField] = String(pk)
    for (const [name, value] of Object.entries(propDefaultValues ?? {})) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') params[name] = value
    }
    return params
  }, [record, isEdit, tableMetaData.primaryKeyField, propDefaultValues])
  const formLocked = disabled || isSaving || Boolean(defaultsError) || Boolean(formDisabledMessage)
  const renderWidgetSection = useCallback((section: QTableSection) => {
    if (isCopy || !section.widgetName) return undefined
    const widget = widgets?.[section.widgetName]
    if (!widget || widget.hasPermission === false || !isEditableFormWidget(widget)) return undefined
    const reload = widgetReloads[widget.name]
    return (
      <FormWidgetSection
        widgetMetaData={widget}
        params={reload ? { ...widgetParams, ...reload.params } : widgetParams}
        reloadCount={reload?.count ?? 0}
        control={control}
        screen={isEdit ? 'recordEdit' : 'recordCreate'}
        record={record}
        tableMetaData={formTable}
        setValues={setFormValues}
        setAssociation={setAssociation}
        registerValidator={registerValidator}
        disabled={formLocked}
      />
    )
  }, [isCopy, widgets, widgetReloads, widgetParams, control, isEdit, record, formTable, setFormValues, setAssociation, registerValidator, formLocked])

  const disabledNames = useMemo(
    () => [...(disabledFieldNames ?? []), ...adjustingFields],
    [disabledFieldNames, adjustingFields]
  )

  const saveDisabled = formLocked || Boolean(copyAssociations?.error) || (!hasChanges && isEdit)
  const saveButton = (
    <button
      type="submit"
      disabled={saveDisabled}
      data-qqq-id="button-save"
      data-button-variant={MATERIAL_BUTTON_VARIANTS.save}
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
  )

  const formContent = (
    <form
      onSubmit={onFormSubmit}
      onKeyDown={(event) => {
        // Enter in a single-line input does not save the record (Material): only the Save button does
        if (isImplicitSubmitKey(event.nativeEvent)) event.preventDefault()
      }}
      noValidate
      className={cn('flex min-w-0 flex-col gap-6', className)}
      data-qqq-id={`entity-form-${tableMetaData.name}`}
    >
      {/* Header card — only if not modal: table icon, title and the first T1 section's fields */}
      {!isModal && (
        <div className="contents" data-qqq-id={`record-${formMode}-header-${tableNameForId}`}>
        <div
          id={headerSection ? formSectionElementId(headerSection.name) : undefined}
          tabIndex={headerSection ? -1 : undefined}
          className="scroll-mt-24 rounded-xl border border-border bg-card p-4 shadow-sm focus:outline-none sm:p-6"
          data-qqq-id={`form-header-${formMode}`}
        >
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
              data-qqq-id="form-avatar"
            >
              <MetadataIcon icon={tableMetaData.icon} kind="table" className="h-5 w-5" />
            </span>
            <h2 className="min-w-0 break-words text-xl font-semibold text-foreground" data-qqq-id={`record-${formMode}-title-${tableNameForId}`}>{heading}</h2>
          </div>
          {headerSection?.label && (
            <h3 className="mt-4 flex items-center text-sm font-medium text-muted-foreground lg:hidden" data-qqq-id={`form-header-section-${sanitizeQqqId(headerSection.name)}`}>
              <SectionIcon section={headerSection} />
              {headerSection.label}
            </h3>
          )}
          {headerSection && (
            <DynamicForm
              register={register}
              control={control}
              errors={errors}
              tableMetaData={formTable}
              sections={[headerSection]}
              hideSectionLabels
              fieldNamesToInclude={fieldNamesToInclude}
              possibleValueContext={pvContext}
              disabled={formLocked}
              disabledFieldNames={disabledNames}
              dirtyFields={dirtyFields as Record<string, boolean>}
              record={record}
              showReadOnlyFields={isEdit}
              helpRoles={isEdit ? EDIT_SCREEN_HELP_ROLES : INSERT_SCREEN_HELP_ROLES}
              enforceMaxLength={false}
              widgets={widgets}
              renderWidgetSection={renderWidgetSection}
              onFieldBlur={onFieldBlur}
              displayValueOverrides={displayOverrides}
              className="mt-4"
            />
          )}
        </div>
        </div>
      )}

      {/* A form an adjuster disabled: the alert cannot be dismissed (Material) */}
      {formDisabledMessage && (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          data-qqq-id={`entity-form-disabled-${tableMetaData.name}`}
        >
          {formDisabledMessage}
        </div>
      )}

      {/* Mutation error alert */}
      {(defaultsError || copyAssociations?.error || mutationError) && (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <strong>Error: </strong>
          {defaultsError || copyAssociations?.error || (mutationError ? getErrorMessage(mutationError, 'An error occurred while saving.') : 'An error occurred while saving.')}
        </div>
      )}
      {mutationWarning && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300"
          data-qqq-id="entity-form-warning"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{mutationWarning}</span>
        </div>
      )}

      {widgetErrors.length > 0 && (
        <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive" data-qqq-id={`entity-form-widget-errors-${tableMetaData.name}`}>
          {widgetErrors.length === 1 ? widgetErrors[0] : (
            <ul className="list-disc pl-5">{widgetErrors.map((problem, index) => <li key={index}>{problem}</li>)}</ul>
          )}
        </div>
      )}

      {isCopy && Object.values(tableMetaData.fields).some(field => field.type === 'PASSWORD' && field.isEditable && !field.isHidden && !field.adornments?.some(item => item.type === 'REVEAL')) &&
        <p className="text-sm text-muted-foreground">Unreadable passwords are not copied. Enter new values before saving.</p>}

      {/* Fields */}
      <DynamicForm
        register={register}
        control={control}
        errors={errors}
        tableMetaData={formTable}
        sections={bodySections}
        fieldNamesToInclude={fieldNamesToInclude}
        possibleValueContext={pvContext}
        disabled={formLocked}
        disabledFieldNames={disabledNames}
        dirtyFields={dirtyFields as Record<string, boolean>}
        record={record}
        showReadOnlyFields={isEdit}
        helpRoles={isEdit ? EDIT_SCREEN_HELP_ROLES : INSERT_SCREEN_HELP_ROLES}
        helpKeyPrefix={`table:${tableMetaData.name};`}
        enforceMaxLength={false}
        widgets={widgets}
        renderWidgetSection={renderWidgetSection}
        onFieldBlur={onFieldBlur}
        displayValueOverrides={displayOverrides}
      />

      {children && <fieldset disabled={disabled || isSaving} className="min-w-0">{children}</fieldset>}

      {/* Actions — sticky on mobile, static on desktop */}
      <div
        className={cn(
          isModal ? 'modalBottomButtonBar' : 'stickyBottomButtonBar',
          'sticky bottom-0 z-10 bg-background border-t border-border py-3 mt-4 -mx-6 px-6',
          'flex items-center justify-end gap-3',
          'md:static md:border-t md:mt-6 md:mx-0 md:px-0'
        )}
        data-qqq-id={`record-${formMode}-button-bar-${tableNameForId}`}
      >
        <button
          ref={cancelButtonRef}
          type="button"
          onClick={handleCancel}
          disabled={isSaving}
          data-qqq-id="button-cancel"
          data-button-variant={MATERIAL_BUTTON_VARIANTS.cancel}
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
        {formDisabledMessage
          ? <HoverTooltip content={formDisabledMessage} qqqId="button-save-tooltip">{saveButton}</HoverTooltip>
          : saveButton}
      </div>
    </form>
  )

  return (
    <>
      {isModal ? (
        <div data-qqq-id={`entity-form-modal-${tableMetaData.name}`}>
          <div className="entityForm p-6" data-qqq-id={`record-${formMode}-${tableNameForId}`}>{formContent}</div>
        </div>
      ) : (
        <div className="entityForm lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-6" data-qqq-id={`record-${formMode}-${tableNameForId}`}>
          {/* the section sidebar on large screens; phones and tablets scroll one column */}
          <FormSectionSidebar
            sections={formSections.map(({ section }) => section)}
            label={`${tableMetaData.label} form sections`}
            className="hidden lg:block"
          />
          {formContent}
        </div>
      )}

      {/* Unsaved changes confirmation dialog */}
      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onStay={handleCancelLeave}
        onLeave={handleConfirmLeave}
        returnFocusRef={cancelButtonRef}
      />
    </>
  )
}

/**
 * Whether an edit form submits a field only after the user changed it.
 *
 * @param field - Field metadata (undefined for values without metadata).
 * @returns `true` for passwords without REVEAL, LONG, DATE_TIME and file fields.
 */
function onlyWhenChanged(field: QTableMetaData['fields'][string] | undefined): boolean {
  if (!field) return true
  if (field.type === 'LONG' || field.type === 'DATE_TIME' || field.type === 'BLOB') return true
  if (field.adornments?.some((adornment) => adornment.type === 'FILE_UPLOAD')) return true
  return field.type === 'PASSWORD' && !field.adornments?.some((adornment) => adornment.type === 'REVEAL')
}
