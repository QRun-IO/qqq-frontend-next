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
 * @file DynamicForm — core metadata-driven form renderer used by EntityForm and ProcessRun.
 */

'use client'

import React from 'react'
import { Controller } from 'react-hook-form'
import type { Control, UseFormRegister, FieldErrors } from 'react-hook-form'

import type { QFieldMetaData, QRecord, QTableSection, QTableMetaData, QWidgetMetaData } from '@/types'
import type { PossibleValueContext } from '@/lib/hooks/use-possible-values'
import { useHelpHelpActive } from '@/lib/context/q-context'
import { cn } from '@/lib/utils/cn'
import { formFieldColumnClasses } from '@/lib/utils/form-layout'
import { formFieldQqqId, sanitizeQqqId } from '@/lib/utils/qqq-id'
import { selectSlotHelpContent } from '@/lib/utils/help-utils'

/** Help roles of a record form section when the form names none. */
const DEFAULT_FORM_HELP_ROLES = ['WRITE_SCREENS', 'ALL_SCREENS'] as const

import { CronScheduleEditor } from './CronScheduleEditor'
import { DynamicFormField } from './DynamicFormField'
import { SectionIcon } from '@/components/layout/MetadataIcon'
import { HelpContent } from '@/components/records/HelpContent'

/**
 * Props for the {@link DynamicForm} component.
 *
 * Supply either `tableMetaData` (for section-grouped layout) or `fields`
 * (for a flat list, typically used by processes).  Both can be combined with
 * `fieldNamesToInclude` for fine-grained field filtering.
 */
export interface DynamicFormProps {
  /** React Hook Form register function from the parent `useForm` instance. */
  register: UseFormRegister<Record<string, unknown>>
  /** React Hook Form control object from the parent `useForm` instance. */
  control: Control<Record<string, unknown>>
  /** React Hook Form validation error map from the parent `useForm` instance. */
  errors: FieldErrors<Record<string, unknown>>

  /** Table metadata used to derive sections and field ordering. */
  tableMetaData?: QTableMetaData
  /** Explicit field list; when provided, section grouping is skipped. */
  fields?: QFieldMetaData[]
  /** Override the sections from `tableMetaData`; ignored when `fields` is set. */
  sections?: QTableSection[]

  /** Restricts rendered fields to this allow-list; when omitted all editable non-hidden fields are shown. */
  fieldNamesToInclude?: string[]

  /** Context forwarded to possible-value fields to scope their fetch calls. */
  possibleValueContext?: PossibleValueContext

  /** When `true`, all fields are rendered in a disabled, read-only state. */
  disabled?: boolean

  /** Fields rendered disabled with their preset value (Material `disabledFields`). */
  disabledFieldNames?: string[]

  /**
   * Map of field names to a boolean indicating whether that field has been
   * modified from its default value.  When `true` for a field, the field
   * renders with a left-border accent to highlight the change.
   * Typically sourced from `formState.dirtyFields` in React Hook Form.
   */
  dirtyFields?: Record<string, boolean>

  /**
   * The record being edited, if any: supplies the display of read-only fields, the
   * current file of upload fields and the labels of possible-value selections.
   */
  record?: QRecord

  /** Show non-editable fields as read-only controls (the edit screen does; create and copy do not). */
  showReadOnlyFields?: boolean

  /** Screen roles used to choose field help content, most specific first. */
  helpRoles?: readonly string[]

  /**
   * Prefix of this form's help slot keys (Material `helpContentKeyPrefix`), e.g. `table:person;`
   * or `process:clonePeople;`; fields use `{prefix}field:{name}`, sections `{prefix}section:{name}`.
   */
  helpKeyPrefix?: string

  /** Limit typing to each field's `maxLength` (default); record forms turn this off. */
  enforceMaxLength?: boolean

  /** Optional heading rendered above the field grid. */
  formLabel?: string

  /** Leave out the section headings (the record form's header card shows its T1 fields under the form title). */
  hideSectionLabels?: boolean

  /**
   * Widget metadata by name. A section housing a widget shown on record edit
   * screens (`includeOnRecordEditScreen`, e.g. the cron schedule) renders the
   * record fields that widget edits, which usually sit in a hidden section.
   */
  widgets?: Record<string, QWidgetMetaData>

  /**
   * Renders a section that houses a widget as an editable part of the form (record create
   * and edit screens); returning `undefined` leaves the section to the default handling.
   */
  renderWidgetSection?: (section: QTableSection) => React.ReactNode | undefined

  /** Called when a text-like input loses focus, with its value (form adjusters run on blur). */
  onFieldBlur?: (fieldName: string, value: unknown) => void

  /** Possible-value labels to show for values set by the form (form adjusters), by field name. */
  displayValueOverrides?: Record<string, string>

  /** Additional CSS classes applied to the outermost container. */
  className?: string
}

/**
 * The record fields a widget section edits on a record form, as Material's
 * EntityForm does for `cronUI` widgets (expression and time zone fields).
 *
 * @param section - A table section.
 * @param widgets - Widget metadata by name.
 * @returns The edited field names, or `undefined` when the section is not an editable widget section.
 */
export function editScreenWidgetFieldNames(section: QTableSection, widgets: Record<string, QWidgetMetaData> | undefined): string[] | undefined {
  const cron = editScreenCronWidget(section, widgets)
  if (!cron) return undefined
  const names = [cron.expressionFieldName, cron.timeZoneFieldName].filter((name): name is string => name !== undefined)
  return names.length > 0 ? names : undefined
}

/**
 * The element id of a form section, for the section sidebar's scroll targets.
 *
 * @param sectionName - Section name from metadata.
 * @returns The id.
 */
export function formSectionElementId(sectionName: string): string {
  return `form-section-${sectionName}`
}

/** A `cronUI` widget shown on record edit screens, and the record fields it edits. */
interface EditScreenCronWidget {
  widgetName: string
  expressionFieldName?: string
  timeZoneFieldName?: string
}

/**
 * The `cronUI` widget a section houses when it is shown on edit screens.
 *
 * @param section - A table section.
 * @param widgets - Widget metadata by name.
 * @returns The widget and its field names, or `undefined`.
 */
function editScreenCronWidget(section: QTableSection, widgets: Record<string, QWidgetMetaData> | undefined): EditScreenCronWidget | undefined {
  const widget = section.widgetName ? widgets?.[section.widgetName] : undefined
  if (!widget || widget.hasPermission === false || widget.type !== 'cronUI') return undefined
  const defaults = widget.defaultValues ?? {}
  if (defaults.includeOnRecordEditScreen !== true) return undefined
  const name = (value: unknown) => (typeof value === 'string' && value !== '' ? value : undefined)
  return { widgetName: widget.name, expressionFieldName: name(defaults.cronExpressionFieldName), timeZoneFieldName: name(defaults.timeZoneFieldName) }
}

/** A section of a table form with the fields it renders. */
export interface RenderableFormSection {
  /** The section (with a widget section's edited fields in place of its own). */
  section: QTableSection
  /** Fields the form renders in it. */
  fields: QFieldMetaData[]
}

/** Options that decide which fields a table form renders. */
export interface RenderableFormSectionOptions {
  /** Sections to lay out instead of the table's. */
  sections?: QTableSection[]
  /** Allow-list of field names. */
  fieldNamesToInclude?: string[]
  /** Whether non-editable fields are shown read-only (the edit screen). */
  showReadOnlyFields?: boolean
  /** Whether the whole form is disabled (non-editable fields are then shown too). */
  disabled?: boolean
  /** Widget metadata by name, for widget sections edited on record screens. */
  widgets?: Record<string, QWidgetMetaData>
}

/**
 * The sections a table form renders, in order, each with the fields it shows; sections that are
 * hidden or would render no field are left out. The record form's section sidebar lists these.
 *
 * @param tableMetaData - Table metadata.
 * @param options - See {@link RenderableFormSectionOptions}.
 * @returns The renderable sections.
 */
export function renderableFormSections(tableMetaData: QTableMetaData, options: RenderableFormSectionOptions = {}): RenderableFormSection[] {
  const { sections, fieldNamesToInclude, showReadOnlyFields = false, disabled = false, widgets } = options
  return (sections ?? tableMetaData.sections ?? [])
    .filter((section) => !section.isHidden && !section.hidden)
    .map((section) => {
      const widgetFieldNames = editScreenWidgetFieldNames(section, widgets)
      const resolved = widgetFieldNames ? { ...section, fieldNames: widgetFieldNames } : section
      const fields = (resolved.fieldNames ?? [])
        .map((fn) => tableMetaData.fields[fn])
        .filter((f): f is QFieldMetaData => {
          if (!f) return false
          if (f.isHidden) return false
          if (!f.isEditable && !showReadOnlyFields && !disabled) return false
          if (fieldNamesToInclude && !fieldNamesToInclude.includes(f.name)) return false
          return true
        })
      return { section: resolved, fields }
    })
    .filter((entry) => entry.fields.length > 0)
}

/**
 * DynamicForm renders form fields from metadata.
 *
 * Supports three usage patterns:
 * 1. **Table-based** — pass `tableMetaData`; fields are grouped and ordered by
 *    the table's sections.
 * 2. **Process-based** — pass `fields` directly; renders a flat list with no
 *    section grouping, typically used by `ProcessRun`.
 * 3. **Filtered** — pass both `tableMetaData` and `fieldNamesToInclude` to show
 *    only a named subset of the table's fields while preserving section layout.
 *
 * Used by {@link EntityForm} (create/edit/copy), `ProcessRun` (step forms), and
 * any other caller that needs a metadata-driven field grid.
 *
 * @param props - Component properties (see {@link DynamicFormProps}).
 * @returns The rendered form fields grouped by section, or `null` when no
 *   renderable fields exist after applying visibility and include-list filters.
 */
export function DynamicForm({
  register,
  control,
  errors,
  tableMetaData,
  fields,
  sections,
  fieldNamesToInclude,
  possibleValueContext,
  disabled = false,
  disabledFieldNames,
  dirtyFields,
  record,
  showReadOnlyFields = false,
  helpRoles,
  enforceMaxLength = true,
  formLabel,
  hideSectionLabels = false,
  widgets,
  renderWidgetSection,
  onFieldBlur,
  displayValueOverrides,
  className,
  helpKeyPrefix = '',
}: DynamicFormProps) {
  const helpHelpActive = useHelpHelpActive()
  // Determine the set of fields to render
  const resolvedFields: QFieldMetaData[] = []

  if (fields) {
    // Direct fields list (process mode)
    const includeSet = fieldNamesToInclude ? new Set(fieldNamesToInclude) : null
    for (const f of fields) {
      if (f.isHidden) continue
      if (includeSet && !includeSet.has(f.name)) continue
      resolvedFields.push(f)
    }
  } else if (tableMetaData) {
    // Table metadata mode — respect sections for layout
    const includeSet = fieldNamesToInclude ? new Set(fieldNamesToInclude) : null
    const allFields = tableMetaData.fields
    const fieldOrder: string[] = []

    // Collect field names in section order
    const resolvedSections = sections ?? tableMetaData.sections
    for (const section of resolvedSections) {
      if (section.isHidden || section.hidden) continue
      for (const fn of section.fieldNames ?? []) {
        if (!fieldOrder.includes(fn)) fieldOrder.push(fn)
      }
    }

    // Add any fields not in sections
    for (const fn of Object.keys(allFields)) {
      if (!fieldOrder.includes(fn)) fieldOrder.push(fn)
    }

    for (const fn of fieldOrder) {
      const f = allFields[fn]
      if (!f) continue
      if (f.isHidden) continue
      if (includeSet && !includeSet.has(fn)) continue
      resolvedFields.push(f)
    }
  }

  // If we have table sections, render section-grouped layout
  const hasSections =
    tableMetaData &&
    tableMetaData.sections &&
    tableMetaData.sections.filter((s) => !s.isHidden && !s.hidden).length > 0 &&
    !fields

  // Sections housing a widget the form edits (rendered by the caller).
  const widgetSectionContent = new Map<string, React.ReactNode>()
  if (hasSections && tableMetaData && renderWidgetSection) {
    for (const section of sections ?? tableMetaData.sections) {
      if (section.isHidden || section.hidden || !section.widgetName) continue
      const content = renderWidgetSection(section)
      if (content !== undefined && content !== null) widgetSectionContent.set(section.name, content)
    }
  }

  if (resolvedFields.length === 0 && widgetSectionContent.size === 0) {
    return null
  }

  if (hasSections && tableMetaData) {
    const renderable = renderableFormSections(tableMetaData, { sections, fieldNamesToInclude, showReadOnlyFields, disabled, widgets })
    return (
      <div className={cn('space-y-6', className)} data-qqq-id="dynamic-form">
        {formLabel && (
          <h3 className="text-base font-semibold text-foreground">{formLabel}</h3>
        )}
        {(sections ?? tableMetaData.sections)
          .filter((section) => !section.isHidden && !section.hidden)
          .map((originalSection) => {
            const widgetContent = widgetSectionContent.get(originalSection.name)
            if (widgetContent !== undefined) {
              return (
                <div key={originalSection.name} id={hideSectionLabels ? undefined : formSectionElementId(originalSection.name)} tabIndex={hideSectionLabels ? undefined : -1} className="scroll-mt-24 space-y-4 focus:outline-none" data-qqq-id={`form-section-${originalSection.name}`}>
                  {originalSection.label && !hideSectionLabels && (
                    <div className="border-b border-border pb-2">
                      <h4 className="flex items-center text-sm font-medium text-muted-foreground">
                        <SectionIcon section={originalSection} />
                        {originalSection.label}
                      </h4>
                    </div>
                  )}
                  {widgetContent}
                </div>
              )
            }
            const entry = renderable.find(({ section }) => section.name === originalSection.name)
            if (!entry) return null
            const { section, fields: sectionFields } = entry
            // Section help for the form's screen (Material EntityForm getSectionHelp)
            const sectionHelp = selectSlotHelpContent(section.helpContents, helpRoles ?? DEFAULT_FORM_HELP_ROLES, `${helpKeyPrefix}section:${section.name}`, helpHelpActive)
            const cron = editScreenCronWidget(section, widgets)
            const cronField = cron && sectionFields.find((f) => f.name === cron.expressionFieldName && f.isEditable)
            const gridFields = cronField ? sectionFields.filter((f) => f !== cronField) : sectionFields

            return (
              <div
                key={section.name}
                id={hideSectionLabels ? undefined : formSectionElementId(section.name)}
                tabIndex={hideSectionLabels ? undefined : -1}
                className="form-section-wrapper is-visible scroll-mt-24 space-y-4 focus:outline-none"
                data-qqq-id={`form-section-${sanitizeQqqId(section.name)}`}
              >
                {section.label && !hideSectionLabels && (
                  <div className="border-b border-border pb-2">
                    <h4 className="flex items-center text-sm font-medium text-muted-foreground" data-qqq-id={`form-section-header-${sanitizeQqqId(section.name)}`}>
                      <SectionIcon section={section} />
                      {section.label}
                    </h4>
                  </div>
                )}
                {sectionHelp && (
                  <p className="text-sm text-muted-foreground" data-qqq-id={`form-section-help-${section.name}`}>
                    <HelpContent helpContent={sectionHelp} />
                  </p>
                )}
                {cron && cronField && (
                  <Controller
                    name={cronField.name}
                    control={control}
                    defaultValue=""
                    render={({ field, fieldState }) => (
                      <CronScheduleEditor
                        id={`field-${cronField.name}`}
                        qqqId={cron.widgetName}
                        label={cronField.label}
                        value={typeof field.value === 'string' ? field.value : ''}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        focusRef={field.ref}
                        required={cronField.isRequired}
                        disabled={disabled}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                )}
                {/* a 12-column grid: full width on phones, half from sm, the field's gridColumns from lg (Material) */}
                <div className="grid grid-cols-12 gap-4">
                  {gridFields.map((f) => (
                    <div
                      key={f.name}
                      className={cn('field-wrapper is-visible', formFieldColumnClasses(f))}
                      data-qqq-id={formFieldQqqId(f)}
                    >
                      <DynamicFormField
                        field={f}
                        register={register}
                        control={control}
                        errors={errors}
                        disabled={disabled || Boolean(disabledFieldNames?.includes(f.name))}
                        isDirty={dirtyFields?.[f.name] === true}
                        possibleValueContext={possibleValueContext}
                        record={record}
                        showReadOnly={showReadOnlyFields}
                        helpRoles={helpRoles}
                        helpKey={`${helpKeyPrefix}field:${f.name}`}
                        enforceMaxLength={enforceMaxLength}
                        onFieldBlur={onFieldBlur}
                        displayValueOverrides={displayValueOverrides}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
      </div>
    )
  }

  // Flat layout (no sections — process mode or simple tables)
  return (
    <div className={cn('space-y-4', className)} data-qqq-id="dynamic-form">
      {formLabel && (
        <h3 className="text-base font-semibold text-foreground">{formLabel}</h3>
      )}
      <div className="grid grid-cols-12 gap-4">
        {resolvedFields.map((f) => (
          <div
            key={f.name}
            className={cn('field-wrapper is-visible', formFieldColumnClasses(f))}
            data-qqq-id={formFieldQqqId(f)}
          >
            <DynamicFormField
              field={f}
              register={register}
              control={control}
              errors={errors}
              disabled={disabled || Boolean(disabledFieldNames?.includes(f.name))}
              isDirty={dirtyFields?.[f.name] === true}
              possibleValueContext={possibleValueContext}
              record={record}
              showReadOnly={showReadOnlyFields}
              helpRoles={helpRoles}
              helpKey={`${helpKeyPrefix}field:${f.name}`}
              enforceMaxLength={enforceMaxLength}
              onFieldBlur={onFieldBlur}
              displayValueOverrides={displayValueOverrides}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
