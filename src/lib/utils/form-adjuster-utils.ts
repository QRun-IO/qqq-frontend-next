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
 * @file form-adjuster-utils — the Material dashboard's form behaviors declared in supplemental
 * metadata: field form adjusters (`MaterialDashboardFieldMetaData`), table field rules and the
 * table's on-load adjuster (`MaterialDashboardTableMetaData`), and applying an adjuster's output
 * to a form's field and section definitions.
 */

import type { QFieldMetaData, QTableMetaData, QTableSection } from '@/types'
import type { FormAdjusterOutput } from '@/lib/api/form-adjuster'
import { MATERIAL_DASHBOARD_TYPE, materialDashboardTableMetaData } from './goto-utils'

/** A field's form adjuster settings. */
export interface FieldFormAdjusters {
  /** Identifier the adjuster route is called with (required by the backend when adjusters exist). */
  identifier: string
  /** Whether an adjuster runs after the field changes. */
  onChange: boolean
  /** Whether an adjuster runs when the field loads. */
  onLoad: boolean
  /** Fields made read-only while an adjuster call for this field runs. */
  fieldsToDisableWhileRunning: string[]
}

/** A table field rule (`FieldRule`): when the source field changes, clear a field or reload a widget. */
export interface FieldRule {
  trigger: string
  sourceField: string
  action: string
  targetField?: string
  targetWidget?: string
}

/**
 * A plain object, or `undefined`.
 *
 * @param value - Any value.
 * @returns The value as a record when it is a non-array object.
 */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined
}

/**
 * A field's form adjusters from its `materialDashboard` supplemental metadata (the v1 key
 * `supplementalMetaData`, or the legacy `supplementalFieldMetaData` an adjuster's replacement
 * field definitions carry).
 *
 * @param field - Field metadata.
 * @returns The adjusters, or `undefined` when the field has none (or no identifier to call them by).
 */
export function fieldFormAdjusters(field: QFieldMetaData | undefined): FieldFormAdjusters | undefined {
  const settings = asRecord(asRecord(field?.supplementalMetaData)?.[MATERIAL_DASHBOARD_TYPE])
    ?? asRecord(asRecord(field?.supplementalFieldMetaData)?.[MATERIAL_DASHBOARD_TYPE])
  if (!settings) return undefined
  const identifier = settings.formAdjusterIdentifier
  const onChange = Boolean(settings.onChangeFormAdjuster)
  const onLoad = Boolean(settings.onLoadFormAdjuster)
  if (typeof identifier !== 'string' || !identifier || (!onChange && !onLoad)) return undefined
  const disable = settings.fieldsToDisableWhileRunningAdjusters
  return {
    identifier,
    onChange,
    onLoad,
    fieldsToDisableWhileRunning: Array.isArray(disable) ? disable.filter((name): name is string => typeof name === 'string') : [],
  }
}

/**
 * Whether the table declares an on-load form adjuster (called as `table:{name}` before the
 * create and edit forms render).
 *
 * @param table - Table metadata.
 * @returns True when it does.
 */
export function hasTableOnLoadAdjuster(table: QTableMetaData | undefined): boolean {
  return Boolean(materialDashboardTableMetaData(table)?.onLoadFormAdjuster)
}

/**
 * The table's field rules.
 *
 * @param table - Table metadata.
 * @returns The well-formed rules, in declared order.
 */
export function tableFieldRules(table: QTableMetaData | undefined): FieldRule[] {
  const rules = materialDashboardTableMetaData(table)?.fieldRules
  if (!Array.isArray(rules)) return []
  return rules.map(asRecord).filter((rule): rule is Record<string, unknown> =>
    Boolean(rule) && typeof rule!.sourceField === 'string' && typeof rule!.trigger === 'string' && typeof rule!.action === 'string')
    .map((rule) => ({
      trigger: String(rule.trigger),
      sourceField: String(rule.sourceField),
      action: String(rule.action),
      ...(typeof rule.targetField === 'string' ? { targetField: rule.targetField } : {}),
      ...(typeof rule.targetWidget === 'string' ? { targetWidget: rule.targetWidget } : {}),
    }))
}

/**
 * A replacement field definition from an adjuster (the legacy frontend field shape), completed
 * so the form can render it: its name, flags and adornments list.
 *
 * @param name - The field name it replaces.
 * @param raw - The adjuster's definition.
 * @param previous - The definition it replaces, if any.
 * @returns The field metadata.
 */
export function adjustedField(name: string, raw: QFieldMetaData, previous: QFieldMetaData | undefined): QFieldMetaData {
  return {
    ...raw,
    name,
    label: raw.label ?? previous?.label ?? name,
    type: raw.type ?? previous?.type ?? 'STRING',
    isRequired: Boolean(raw.isRequired),
    isEditable: Boolean(raw.isEditable),
    isHeavy: Boolean(raw.isHeavy),
    isHidden: Boolean(raw.isHidden),
    adornments: Array.isArray(raw.adornments) ? raw.adornments : [],
  }
}

/**
 * A replacement section definition from an adjuster, completed so the form can render it.
 *
 * @param name - The section name it replaces.
 * @param raw - The adjuster's definition.
 * @returns The section.
 */
function adjustedSection(name: string, raw: QTableSection): QTableSection {
  return {
    ...raw,
    name,
    label: raw.label ?? name,
    fieldNames: Array.isArray(raw.fieldNames) ? raw.fieldNames : [],
    isHidden: Boolean(raw.isHidden ?? raw.hidden),
    hidden: Boolean(raw.isHidden ?? raw.hidden),
  }
}

/**
 * Applies an adjuster's field and section replacements to a form's table definition, as
 * Material replaces its field definitions and sections (only fields and sections the table has).
 *
 * @param table - The form's current table definition.
 * @param output - The adjuster's output.
 * @returns A new table definition, or the same one when nothing changed.
 */
export function applyAdjustedDefinitions(table: QTableMetaData, output: FormAdjusterOutput): QTableMetaData {
  const fieldUpdates = Object.entries(output.updatedFieldMetaData ?? {}).filter(([name]) => table.fields[name])
  const sectionUpdates = output.updatedSectionMetaData ?? {}
  const sectionNames = Object.keys(sectionUpdates).filter((name) => table.sections.some((section) => section.name === name))
  if (fieldUpdates.length === 0 && sectionNames.length === 0) return table
  const fields = { ...table.fields }
  for (const [name, raw] of fieldUpdates) fields[name] = adjustedField(name, raw, table.fields[name])
  const sections = table.sections.map((section) => sectionNames.includes(section.name) ? adjustedSection(section.name, sectionUpdates[section.name]) : section)
  return { ...table, fields, sections }
}

