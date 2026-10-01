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
 * @file quick-filter-utils — the query screen's basic mode (Material's
 * `BasicAndAdvancedQueryControls`): default quick-filter fields, whether a filter can be shown
 * as quick filters, and the edits a quick filter makes to the filter.
 */

import type { QFieldMetaData, QFilterCriteria, QQueryFilter, QTableMetaData } from '@/types'
import {
  getOperatorOptions,
  isFilterVariableExpression,
  isOfferedOperator,
  resolveField,
  type OperatorOption,
  type OperatorOptionSettings,
} from './filter-utils'

/** The filter panel modes: quick filters (basic) or the full filter (advanced). */
export type FilterMode = 'basic' | 'advanced'

/**
 * Narrows a value to a plain object.
 *
 * @param value - Any value.
 * @returns The object, or undefined.
 */
function asObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined
}

/**
 * The fields a table shows as quick filters before the user adds any: the Material dashboard
 * table setting `defaultQuickFilterFieldNames`, else the fields of the table's T1 sections.
 * Names that do not resolve to a field are left out.
 *
 * @param table - Table metadata.
 * @returns Field names (`field` or `joinTable.field`), without duplicates.
 */
export function getDefaultQuickFilterFieldNames(table: QTableMetaData): string[] {
  const materialDashboard = asObject(asObject(table.supplementalMetaData)?.materialDashboard) ?? asObject(asObject(table.supplementalTableMetaData)?.materialDashboard)
  const configured = Array.isArray(materialDashboard?.defaultQuickFilterFieldNames)
    ? (materialDashboard.defaultQuickFilterFieldNames as unknown[]).filter((name): name is string => typeof name === 'string')
    : []
  const names = configured.length > 0
    ? configured
    : (table.sections ?? []).filter((section) => section.tier === 'T1').flatMap((section) => section.fieldNames ?? [])
  return [...new Set(names)].filter((name) => resolveField(table, name) !== undefined)
}

/**
 * The operator a quick filter starts with (Material's `getDefaultOperatorForField`): "is any of"
 * for possible-value fields, "is after" for date-times, none for booleans (so a new boolean quick
 * filter is not already active), else "equals".
 *
 * @param field - The field.
 * @param settings - Operator option settings.
 * @returns The starting option, or undefined for booleans.
 */
export function defaultQuickFilterOperator(field: Pick<QFieldMetaData, 'type' | 'possibleValueSourceName'>, settings: OperatorOptionSettings = {}): OperatorOption | undefined {
  const options = getOperatorOptions(field, settings)
  if (field.possibleValueSourceName) return options.find((o) => o.operator === 'IN')
  if (field.type === 'BOOLEAN') return undefined
  if (field.type === 'DATE_TIME') return options.find((o) => o.operator === 'GREATER_THAN')
  return options.find((o) => o.operator === 'EQUALS' && !o.implicitValues) ?? options[0]
}

/** Whether a filter can be managed in basic mode, and why not. */
export interface BasicModeCheck {
  /** True when every condition can be a quick filter. */
  canWorkAsBasic: boolean
  /** Why it cannot, one sentence each (Material's wording). */
  reasons: string[]
}

/**
 * Whether a filter can be managed with quick filters (Material's `canFilterWorkAsBasic`): no
 * OR between conditions, no sub-filters, and at most one condition per field.
 *
 * @param table - Table metadata (for field labels).
 * @param filter - The filter.
 * @returns The answer, with the reasons.
 */
export function canFilterWorkAsBasic(table: QTableMetaData, filter: Pick<QQueryFilter, 'criteria' | 'subFilters' | 'booleanOperator'> | undefined): BasicModeCheck {
  const reasons: string[] = []
  if (!filter) return { canWorkAsBasic: true, reasons }
  const criteria = filter.criteria ?? []
  const subFilters = filter.subFilters ?? []
  // OR only matters between two or more conditions (the builder hides it for one)
  if (filter.booleanOperator === 'OR' && criteria.length + subFilters.length > 1) reasons.push("Filter uses the 'OR' operator.")
  if (subFilters.length > 0) reasons.push('Filter contains sub-filters.')
  const seen = new Set<string>()
  const warned = new Set<string>()
  for (const criterion of criteria) {
    if (!criterion?.fieldName) continue
    if (seen.has(criterion.fieldName) && !warned.has(criterion.fieldName)) {
      reasons.push(`Filter contains more than 1 condition for the field: ${resolveField(table, criterion.fieldName)?.label ?? criterion.fieldName}`)
      warned.add(criterion.fieldName)
    }
    seen.add(criterion.fieldName)
  }
  return { canWorkAsBasic: reasons.length === 0, reasons }
}

/** The basic-mode settings a filter change may adjust. */
export interface BasicModeState {
  /** The filter panel mode. */
  mode: FilterMode
  /** Quick filters the user (or a filter) added, beyond the defaults. */
  quickFilterFieldNames: string[]
}

/**
 * Keeps basic mode consistent with a filter (Material's
 * `ensureAllFilterCriteriaAreActiveQuickFilters`): a filter that cannot be basic switches to
 * advanced; in basic mode every field with a condition becomes a quick filter.
 *
 * @param table - Table metadata.
 * @param filter - The current filter.
 * @param state - The current mode and added quick filters.
 * @param defaults - The table's default quick-filter fields.
 * @returns The adjusted mode and quick filters (the same object when nothing changes).
 */
export function reconcileBasicMode(table: QTableMetaData, filter: QQueryFilter, state: BasicModeState, defaults: readonly string[]): BasicModeState {
  if (!canFilterWorkAsBasic(table, filter).canWorkAsBasic) return state.mode === 'advanced' ? state : { ...state, mode: 'advanced' }
  if (state.mode !== 'basic') return state
  const added = (filter.criteria ?? [])
    .map((criterion) => criterion?.fieldName)
    .filter((name): name is string => Boolean(name) && !defaults.includes(name) && !state.quickFilterFieldNames.includes(name) && resolveField(table, name) !== undefined)
  if (added.length === 0) return state
  return { ...state, quickFilterFieldNames: [...state.quickFilterFieldNames, ...new Set(added)] }
}

/** What a quick filter shows for its field: no condition, the one condition, or "too complex". */
export type QuickFilterCriterion = { kind: 'none' } | { kind: 'criterion'; criterion: QFilterCriteria } | { kind: 'tooComplex' }

/**
 * Finds the condition a quick filter edits (Material's `getQuickCriteriaParam`). More than one
 * condition on the field is too complex; so is one the quick filter cannot show (an operator
 * the field does not offer, as from a link, or a filter variable).
 *
 * @param filter - The current filter.
 * @param fieldName - The quick filter's field.
 * @param field - The field's metadata.
 * @param settings - Operator option settings.
 * @returns The quick filter's condition state.
 */
export function quickFilterCriterion(filter: QQueryFilter, fieldName: string, field: Pick<QFieldMetaData, 'type' | 'possibleValueSourceName'>, settings: OperatorOptionSettings = {}): QuickFilterCriterion {
  const matches = (filter.criteria ?? []).filter((criterion) => criterion?.fieldName === fieldName)
  if (matches.length === 0) return { kind: 'none' }
  if (matches.length > 1) return { kind: 'tooComplex' }
  const criterion = matches[0]
  if (!isOfferedOperator(getOperatorOptions(field, settings), criterion) || criterion.values.some(isFilterVariableExpression)) return { kind: 'tooComplex' }
  return { kind: 'criterion', criterion }
}

/**
 * Sets a quick filter's condition: replaces the field's condition, or adds it. Conditions are
 * ANDed, so a filter whose (hidden) operator is OR becomes AND when it gains a second condition.
 *
 * @param filter - The current filter.
 * @param criterion - The quick filter's condition.
 * @returns The new filter.
 */
export function setQuickFilterCriterion(filter: QQueryFilter, criterion: QFilterCriteria): QQueryFilter {
  const criteria = filter.criteria ?? []
  const index = criteria.findIndex((c) => c?.fieldName === criterion.fieldName)
  if (index >= 0) return { ...filter, criteria: criteria.map((c, i) => (i === index ? criterion : c)) }
  return { ...filter, criteria: [...criteria, criterion], booleanOperator: criteria.length <= 1 ? 'AND' : filter.booleanOperator }
}

/**
 * Removes a field's conditions from the filter's top level (clearing a quick filter).
 *
 * @param filter - The current filter.
 * @param fieldName - The field.
 * @returns The new filter (the same object when the field had no condition).
 */
export function removeQuickFilterCriterion(filter: QQueryFilter, fieldName: string): QQueryFilter {
  const criteria = filter.criteria ?? []
  if (!criteria.some((c) => c?.fieldName === fieldName)) return filter
  return { ...filter, criteria: criteria.filter((c) => c?.fieldName !== fieldName) }
}
