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
 * @file filter-utils — filter construction, operator catalogs, serialization, backend
 * preparation and expression helpers for the QQQ Record Query screen.
 *
 * The per-field operator lists and their labels match the Material dashboard's
 * `FilterCriteriaRow.getOperatorOptions`, so filters built in either UI mean the same thing.
 */

import type {
  QQueryFilter,
  QFilterCriteria,
  QFilterOrderBy,
  QCriteriaOperator,
  QFieldType,
  QFieldMetaData,
  QTableMetaData,
  FilterVariableExpression,
  NowExpression,
  NowWithOffsetExpression,
  ThisOrLastPeriodExpression,
  ExpressionTimeUnit,
} from '@/types'

/** A single criteria value: a scalar or a backend-evaluated expression. */
export type CriteriaValue = QFilterCriteria['values'][number]

/** Any backend-evaluated criteria value expression. */
export type FilterExpression = FilterVariableExpression | NowExpression | NowWithOffsetExpression | ThisOrLastPeriodExpression

/**
 * Returns a blank {@link QQueryFilter} with no criteria, no sort, and the given page size.
 *
 * @param pageSize - The `limit` value to embed in the filter. Defaults to 25.
 * @returns A fresh, empty {@link QQueryFilter}.
 */
export function emptyFilter(pageSize = 25): QQueryFilter {
  return {
    criteria: [],
    orderBys: [],
    subFilters: [],
    booleanOperator: 'AND',
    skip: 0,
    limit: pageSize,
  }
}

// ------------------------------------------------------------------
// Operator catalog
// ------------------------------------------------------------------

/**
 * UI-level descriptor for a single {@link QCriteriaOperator}.
 */
export interface OperatorConfig {
  /** Human-readable label used when the operator is shown outside a field-specific list. */
  label: string
  /** How many values the operator takes. */
  valueCount: 'single' | 'multiple' | 'range' | 'none'
  /** Field types whose Material operator list includes this operator. */
  applicableTypes: QFieldType[]
  /** Short description of the operator's backend semantics. */
  description: string
}

const ALL_TYPES: QFieldType[] = ['STRING', 'INTEGER', 'LONG', 'DECIMAL', 'BOOLEAN', 'DATE', 'TIME', 'DATE_TIME', 'TEXT', 'HTML', 'PASSWORD', 'BLOB']
const STRING_TYPES: QFieldType[] = ['STRING', 'TEXT', 'HTML', 'PASSWORD', 'TIME']
const NUMERIC_TYPES: QFieldType[] = ['INTEGER', 'LONG', 'DECIMAL']
const DATE_TYPES: QFieldType[] = ['DATE', 'DATE_TIME']

/**
 * Every backend `QCriteriaOperator`, so a filter from a URL, saved view or backend link
 * always renders, even when the operator is not offered for new criteria.
 */
export const OPERATOR_CONFIG: Record<QCriteriaOperator, OperatorConfig> = {
  EQUALS: { label: 'equals', valueCount: 'single', applicableTypes: ALL_TYPES.filter((t) => t !== 'BLOB'), description: 'Exact match' },
  NOT_EQUALS: { label: 'does not equal (excluding empty)', valueCount: 'single', applicableTypes: [], description: 'Excludes the value and empty values' },
  NOT_EQUALS_OR_IS_NULL: { label: 'does not equal', valueCount: 'single', applicableTypes: [...STRING_TYPES, ...NUMERIC_TYPES, ...DATE_TYPES], description: 'Excludes the value; empty values match' },
  IN: { label: 'is any of', valueCount: 'multiple', applicableTypes: [...STRING_TYPES, ...NUMERIC_TYPES], description: 'One of several values' },
  NOT_IN: { label: 'is none of', valueCount: 'multiple', applicableTypes: [...STRING_TYPES, ...NUMERIC_TYPES], description: 'None of several values' },
  IS_NULL_OR_IN: { label: 'is empty or any of', valueCount: 'multiple', applicableTypes: [], description: 'Empty, or one of several values' },
  LIKE: { label: 'is like', valueCount: 'single', applicableTypes: [], description: 'SQL LIKE pattern (% and _ wildcards)' },
  NOT_LIKE: { label: 'is not like', valueCount: 'single', applicableTypes: [], description: 'Does not match a SQL LIKE pattern' },
  STARTS_WITH: { label: 'starts with', valueCount: 'single', applicableTypes: STRING_TYPES, description: 'Text begins with the value' },
  ENDS_WITH: { label: 'ends with', valueCount: 'single', applicableTypes: STRING_TYPES, description: 'Text ends with the value' },
  CONTAINS: { label: 'contains', valueCount: 'single', applicableTypes: STRING_TYPES, description: 'Text contains the value' },
  NOT_STARTS_WITH: { label: 'does not start with', valueCount: 'single', applicableTypes: STRING_TYPES, description: 'Text does not begin with the value' },
  NOT_ENDS_WITH: { label: 'does not end with', valueCount: 'single', applicableTypes: STRING_TYPES, description: 'Text does not end with the value' },
  NOT_CONTAINS: { label: 'does not contain', valueCount: 'single', applicableTypes: STRING_TYPES, description: 'Text does not contain the value' },
  LESS_THAN: { label: 'less than', valueCount: 'single', applicableTypes: [...NUMERIC_TYPES, ...DATE_TYPES], description: 'Value is less than' },
  LESS_THAN_OR_EQUALS: { label: 'less than or equals', valueCount: 'single', applicableTypes: [...NUMERIC_TYPES, ...DATE_TYPES], description: 'Value is less than or equal' },
  GREATER_THAN: { label: 'greater than', valueCount: 'single', applicableTypes: [...NUMERIC_TYPES, ...DATE_TYPES], description: 'Value is greater than' },
  GREATER_THAN_OR_EQUALS: { label: 'greater than or equals', valueCount: 'single', applicableTypes: [...NUMERIC_TYPES, ...DATE_TYPES], description: 'Value is greater than or equal' },
  IS_BLANK: { label: 'is empty', valueCount: 'none', applicableTypes: ALL_TYPES, description: 'Field is empty' },
  IS_NOT_BLANK: { label: 'is not empty', valueCount: 'none', applicableTypes: ALL_TYPES, description: 'Field is not empty' },
  BETWEEN: { label: 'is between', valueCount: 'range', applicableTypes: [...NUMERIC_TYPES, ...DATE_TYPES], description: 'Between two values, inclusive' },
  NOT_BETWEEN: { label: 'is not between', valueCount: 'range', applicableTypes: [...NUMERIC_TYPES, ...DATE_TYPES], description: 'Outside two values' },
  TRUE: { label: 'matches every record', valueCount: 'none', applicableTypes: [], description: 'Always true' },
  FALSE: { label: 'matches no records', valueCount: 'none', applicableTypes: [], description: 'Always false' },
}

/** Value input shapes, mirroring Material's `ValueMode` (dates are chosen by field type). */
export type ValueMode = 'none' | 'single' | 'double' | 'multi'

/** One entry in a field's operator dropdown. */
export interface OperatorOption {
  /** Stable key for the option (the operator, plus implicit values when present). */
  id: string
  /** Label shown in the dropdown. */
  label: string
  /** The backend operator this option sends. */
  operator: QCriteriaOperator
  /** Which value input the option needs. */
  valueMode: ValueMode
  /** Values the option implies (boolean "equals yes"/"equals no"); no input is shown. */
  implicitValues?: (string | number | boolean)[]
}

/**
 * Builds an operator option.
 *
 * @param operator - Backend operator.
 * @param label - Dropdown label.
 * @param valueMode - Value input shape.
 * @param implicitValues - Values implied by the option.
 * @returns The option.
 */
function option(operator: QCriteriaOperator, label: string, valueMode: ValueMode, implicitValues?: (string | number | boolean)[]): OperatorOption {
  return { id: implicitValues ? `${operator}:${JSON.stringify(implicitValues)}` : operator, label, operator, valueMode, implicitValues }
}

/**
 * Returns the operator options offered for a field, in Material's order and wording.
 *
 * @param field - The field (type and possible value source) being filtered.
 * @returns Ordered operator options.
 */
export function getOperatorOptions(field: Pick<QFieldMetaData, 'type' | 'possibleValueSourceName'>): OperatorOption[] {
  if (field.possibleValueSourceName) {
    return [
      option('EQUALS', 'equals', 'single'),
      option('NOT_EQUALS_OR_IS_NULL', 'does not equal', 'single'),
      option('IS_BLANK', 'is empty', 'none'),
      option('IS_NOT_BLANK', 'is not empty', 'none'),
      option('IN', 'is any of', 'multi'),
      option('NOT_IN', 'is none of', 'multi'),
    ]
  }
  switch (field.type) {
    case 'DECIMAL':
    case 'INTEGER':
    case 'LONG':
      return [
        option('EQUALS', 'equals', 'single'),
        option('NOT_EQUALS_OR_IS_NULL', 'does not equal', 'single'),
        option('GREATER_THAN', 'greater than', 'single'),
        option('GREATER_THAN_OR_EQUALS', 'greater than or equals', 'single'),
        option('LESS_THAN', 'less than', 'single'),
        option('LESS_THAN_OR_EQUALS', 'less than or equals', 'single'),
        option('IS_BLANK', 'is empty', 'none'),
        option('IS_NOT_BLANK', 'is not empty', 'none'),
        option('BETWEEN', 'is between', 'double'),
        option('NOT_BETWEEN', 'is not between', 'double'),
        option('IN', 'is any of', 'multi'),
        option('NOT_IN', 'is none of', 'multi'),
      ]
    case 'DATE':
      return [
        option('EQUALS', 'equals', 'single'),
        option('NOT_EQUALS_OR_IS_NULL', 'does not equal', 'single'),
        option('GREATER_THAN', 'is after', 'single'),
        option('GREATER_THAN_OR_EQUALS', 'is on or after', 'single'),
        option('LESS_THAN', 'is before', 'single'),
        option('LESS_THAN_OR_EQUALS', 'is on or before', 'single'),
        option('IS_BLANK', 'is empty', 'none'),
        option('IS_NOT_BLANK', 'is not empty', 'none'),
        option('BETWEEN', 'is between', 'double'),
        option('NOT_BETWEEN', 'is not between', 'double'),
      ]
    case 'DATE_TIME':
      return [
        option('EQUALS', 'equals', 'single'),
        option('NOT_EQUALS_OR_IS_NULL', 'does not equal', 'single'),
        option('GREATER_THAN', 'is after', 'single'),
        option('GREATER_THAN_OR_EQUALS', 'is at or after', 'single'),
        option('LESS_THAN', 'is before', 'single'),
        option('LESS_THAN_OR_EQUALS', 'is at or before', 'single'),
        option('IS_BLANK', 'is empty', 'none'),
        option('IS_NOT_BLANK', 'is not empty', 'none'),
        option('BETWEEN', 'is between', 'double'),
        option('NOT_BETWEEN', 'is not between', 'double'),
      ]
    case 'BOOLEAN':
      return [
        option('EQUALS', 'equals yes', 'none', [true]),
        option('EQUALS', 'equals no', 'none', [false]),
        option('IS_BLANK', 'is empty', 'none'),
        option('IS_NOT_BLANK', 'is not empty', 'none'),
      ]
    case 'BLOB':
      return [
        option('IS_BLANK', 'is empty', 'none'),
        option('IS_NOT_BLANK', 'is not empty', 'none'),
      ]
    default:
      return [
        option('EQUALS', 'equals', 'single'),
        option('NOT_EQUALS_OR_IS_NULL', 'does not equal', 'single'),
        option('CONTAINS', 'contains', 'single'),
        option('NOT_CONTAINS', 'does not contain', 'single'),
        option('STARTS_WITH', 'starts with', 'single'),
        option('NOT_STARTS_WITH', 'does not start with', 'single'),
        option('ENDS_WITH', 'ends with', 'single'),
        option('NOT_ENDS_WITH', 'does not end with', 'single'),
        option('IS_BLANK', 'is empty', 'none'),
        option('IS_NOT_BLANK', 'is not empty', 'none'),
        option('IN', 'is any of', 'multi'),
        option('NOT_IN', 'is none of', 'multi'),
      ]
  }
}

/**
 * Maps an operator's value count to a value input mode.
 *
 * @param operator - Backend operator.
 * @returns The value mode for that operator.
 */
export function valueModeForOperator(operator: QCriteriaOperator): ValueMode {
  const count = OPERATOR_CONFIG[operator]?.valueCount ?? 'single'
  return count === 'none' ? 'none' : count === 'range' ? 'double' : count === 'multiple' ? 'multi' : 'single'
}

/**
 * Finds the option a criterion uses. A criterion whose operator is not offered for the field
 * (for example `LIKE` from a saved view) gets a synthesized option so it still renders.
 *
 * @param options - The field's operator options.
 * @param criterion - The criterion being displayed.
 * @returns The matching or synthesized option.
 */
export function selectedOperatorOption(options: OperatorOption[], criterion: QFilterCriteria): OperatorOption {
  const matches = options.filter((o) => o.operator === criterion.operator)
  const implicit = matches.find((o) => o.implicitValues && JSON.stringify(o.implicitValues) === JSON.stringify(criterion.values))
  if (implicit) return implicit
  const plain = matches.find((o) => !o.implicitValues)
  if (plain) return plain
  const config = OPERATOR_CONFIG[criterion.operator]
  return option(criterion.operator, config?.label ?? criterion.operator, valueModeForOperator(criterion.operator))
}

/**
 * Returns the operators offered for a field type (without a possible value source).
 *
 * @param fieldType - The QQQ field type.
 * @returns Distinct operators, in Material's order.
 */
export function getOperatorsForFieldType(fieldType: QFieldType): QCriteriaOperator[] {
  return [...new Set(getOperatorOptions({ type: fieldType }).map((o) => o.operator))]
}

/**
 * Returns the operator a new criterion on a field type starts with (Material's first option).
 *
 * @param fieldType - The QQQ field type.
 * @returns The default operator.
 */
export function getDefaultOperatorForFieldType(fieldType: QFieldType): QCriteriaOperator {
  return getOperatorOptions({ type: fieldType })[0]?.operator ?? 'EQUALS'
}

/**
 * Builds a fresh criterion for a field using its first operator option.
 *
 * @param fieldName - Criterion field name (may be `joinTable.field`).
 * @param field - Field metadata.
 * @returns A new, not yet complete criterion (unless the option implies values).
 */
export function newCriterionForField(fieldName: string, field: Pick<QFieldMetaData, 'type' | 'possibleValueSourceName'>): QFilterCriteria {
  const first = getOperatorOptions(field)[0] ?? option('EQUALS', 'equals', 'single')
  return { fieldName, operator: first.operator, values: first.implicitValues ? [...first.implicitValues] : [] }
}

// ------------------------------------------------------------------
// Field type helpers
// ------------------------------------------------------------------

/**
 * Whether a field type is numeric.
 *
 * @param fieldType - The QQQ field type.
 * @returns Whether the type is INTEGER, LONG or DECIMAL.
 */
export function isNumericType(fieldType: QFieldType): boolean {
  return NUMERIC_TYPES.includes(fieldType)
}

/**
 * Whether a field type is text.
 *
 * @param fieldType - The QQQ field type.
 * @returns Whether the type is STRING, TEXT or HTML.
 */
export function isStringType(fieldType: QFieldType): boolean {
  return ['STRING', 'TEXT', 'HTML'].includes(fieldType)
}

/**
 * Whether a field type is a date, time or date-time.
 *
 * @param fieldType - The QQQ field type.
 * @returns Whether the type is DATE, TIME or DATE_TIME.
 */
export function isDateTimeType(fieldType: QFieldType): boolean {
  return ['DATE', 'TIME', 'DATE_TIME'].includes(fieldType)
}

// ------------------------------------------------------------------
// Field resolution (base table and exposed joins)
// ------------------------------------------------------------------

/** A field referenced by a criterion, sort or column, resolved against the table's exposed joins. */
export interface ResolvedField {
  /** The field's metadata. */
  field: QFieldMetaData
  /** Name of the table that owns the field. */
  tableName: string
  /** Label of the table that owns the field. */
  tableLabel: string
  /** Whether the field comes from an exposed join. */
  isJoin: boolean
  /** User-facing label; join fields read "Join Label: Field Label", as in Material. */
  label: string
}

/**
 * Resolves `field` or `joinTable.field` against a table and its exposed joins.
 *
 * @param table - Base table metadata (with `exposedJoins`).
 * @param fieldName - The referenced name.
 * @returns The resolved field, or undefined when it is not part of this table's metadata.
 */
export function resolveField(table: QTableMetaData, fieldName: string): ResolvedField | undefined {
  const base = table.fields?.[fieldName]
  if (base) return { field: base, tableName: table.name, tableLabel: table.label, isJoin: false, label: base.label }
  const dot = fieldName.indexOf('.')
  if (dot < 0) return undefined
  const joinTableName = fieldName.slice(0, dot)
  const joinFieldName = fieldName.slice(dot + 1)
  const exposed = (table.exposedJoins ?? []).find((join) => join.joinTable?.name === joinTableName)
  const field = exposed?.joinTable?.fields?.[joinFieldName]
  if (!exposed || !field) return undefined
  const joinLabel = exposed.label || exposed.joinTable?.label || joinTableName
  return { field, tableName: joinTableName, tableLabel: exposed.joinTable?.label ?? joinTableName, isJoin: true, label: `${joinLabel}: ${field.label}` }
}

/**
 * Lists every field name referenced by a filter's criteria and sort, recursively.
 *
 * @param filter - The filter to inspect.
 * @returns Referenced field names (duplicates removed).
 */
export function referencedFieldNames(filter: Partial<QQueryFilter> | undefined): string[] {
  const names = new Set<string>()
  const walk = (f: Partial<QQueryFilter> | undefined) => {
    if (!f) return
    for (const c of f.criteria ?? []) if (c?.fieldName) names.add(c.fieldName)
    for (const o of f.orderBys ?? []) if (o?.fieldName) names.add(o.fieldName)
    for (const s of f.subFilters ?? []) walk(s)
  }
  walk(filter)
  return [...names]
}

// ------------------------------------------------------------------
// Criteria validity and counting
// ------------------------------------------------------------------

/**
 * Whether a value counts as "set" (Material's `validateCriteria`).
 *
 * @param value - A criteria value.
 * @returns True when the value is non-null and not blank text.
 */
function isSet(value: unknown): boolean {
  return value !== null && value !== undefined && String(typeof value === 'object' ? 'x' : value).trim() !== ''
}

/**
 * Whether a criterion is fully defined and should be sent to the backend.
 *
 * @param criterion - The criterion to check.
 * @returns True when the field, operator and required values are present.
 */
export function isCriterionComplete(criterion: QFilterCriteria | undefined): boolean {
  if (!criterion || !criterion.fieldName || !criterion.operator) return false
  const config = OPERATOR_CONFIG[criterion.operator]
  if (!config) return false
  const values = criterion.values ?? []
  switch (config.valueCount) {
    case 'none':
      return true
    case 'range':
      return values.length >= 2 && isSet(values[0]) && isSet(values[1])
    case 'multiple':
      return values.length >= 1 && isSet(values[0])
    default:
      return isSet(values[0])
  }
}

/**
 * Counts complete criteria in a filter, including nested sub-filters.
 *
 * @param filter - The filter to inspect.
 * @returns The number of complete criteria.
 */
export function countActiveCriteria(filter: QQueryFilter): number {
  let count = 0
  for (const criterion of filter.criteria ?? []) if (isCriterionComplete(criterion)) count++
  for (const sub of filter.subFilters ?? []) count += countActiveCriteria(sub)
  return count
}

/**
 * Whether a filter has no complete criteria.
 *
 * @param filter - The filter to test.
 * @returns True when there are no complete criteria.
 */
export function isFilterEmpty(filter: QQueryFilter): boolean {
  return countActiveCriteria(filter) === 0
}

// ------------------------------------------------------------------
// Serialization
// ------------------------------------------------------------------

/**
 * Serialize a filter to URL-safe base64 JSON (criteria, sort, sub-filters and operator; no paging).
 *
 * @param filter - The filter to serialize.
 * @returns A base64 string, or an empty string if serialization fails.
 */
export function serializeFilter(filter: Partial<QQueryFilter>): string {
  try {
    const json = JSON.stringify({
      criteria: filter.criteria,
      orderBys: filter.orderBys,
      subFilters: filter.subFilters,
      booleanOperator: filter.booleanOperator,
    })
    const bytes = new TextEncoder().encode(json)
    let chars = ''
    for (const b of bytes) chars += String.fromCharCode(b)
    return btoa(chars)
  } catch {
    return ''
  }
}

/**
 * Normalizes an untrusted parsed filter object.
 *
 * @param decoded - Parsed JSON.
 * @param pageSize - Page size for the restored filter.
 * @returns A well-formed filter.
 */
export function normalizeFilter(decoded: unknown, pageSize = 25): QQueryFilter {
  const source = (decoded && typeof decoded === 'object' ? decoded : {}) as Record<string, unknown>
  const criteria = Array.isArray(source.criteria)
    ? (source.criteria as QFilterCriteria[]).filter((c) => c && typeof c.fieldName === 'string' && typeof c.operator === 'string')
      .map((c) => ({ ...c, values: Array.isArray(c.values) ? c.values : [] }))
    : []
  const subFilters = Array.isArray(source.subFilters) ? (source.subFilters as unknown[]).map((s) => normalizeFilter(s, 0)) : []
  const orderBys = Array.isArray(source.orderBys)
    ? (source.orderBys as QFilterOrderBy[]).filter((o) => o && typeof o.fieldName === 'string').map((o) => ({ fieldName: o.fieldName, isAscending: o.isAscending !== false }))
    : []
  return {
    criteria,
    orderBys,
    subFilters,
    booleanOperator: source.booleanOperator === 'OR' ? 'OR' : 'AND',
    skip: 0,
    limit: pageSize,
  }
}

/**
 * Deserialize a filter from base64 JSON ({@link serializeFilter}) or plain JSON (the
 * `?filter=` format the Material dashboard and backend-generated links use).
 *
 * @param encoded - The URL parameter value.
 * @param pageSize - Page size to use for the restored filter.
 * @returns The filter, or an empty filter if the value cannot be decoded.
 */
export function deserializeFilter(encoded: string, pageSize = 25): QQueryFilter {
  const trimmed = encoded.trim()
  try {
    if (trimmed.startsWith('{')) return normalizeFilter(JSON.parse(trimmed), pageSize)
    const chars = atob(trimmed)
    const bytes = new Uint8Array(chars.length)
    for (let i = 0; i < chars.length; i++) bytes[i] = chars.charCodeAt(i)
    return normalizeFilter(JSON.parse(new TextDecoder().decode(bytes)), pageSize)
  } catch {
    return emptyFilter(pageSize)
  }
}

// ------------------------------------------------------------------
// Quick search, paging and sort
// ------------------------------------------------------------------

/**
 * Builds a quick-search filter that ORs a CONTAINS criterion across string fields.
 *
 * @param searchTerm - The text typed into the quick-search input.
 * @param visibleFieldNames - Column field names currently shown.
 * @param fieldTypes - Map from field name to type.
 * @param pageSize - Limit for the returned filter.
 * @returns An OR filter, or an empty filter for a blank term.
 */
export function buildQuickFilter(
  searchTerm: string,
  visibleFieldNames: string[],
  fieldTypes: Record<string, QFieldType>,
  pageSize = 25
): QQueryFilter {
  if (!searchTerm.trim()) return emptyFilter(pageSize)
  const criteria: QFilterCriteria[] = visibleFieldNames
    .filter((name) => fieldTypes[name] && isStringType(fieldTypes[name]))
    .map((fieldName) => ({ fieldName, operator: 'CONTAINS' as QCriteriaOperator, values: [searchTerm.trim()] }))
  return { criteria, orderBys: [], subFilters: [], booleanOperator: 'OR', skip: 0, limit: pageSize }
}

/**
 * ANDs a quick-search filter onto the user's filter without changing the user's own
 * boolean operator.
 *
 * @param userFilter - The advanced filter.
 * @param quickFilter - The quick-search OR filter, or null.
 * @returns The combined filter (the user's sort is kept).
 */
export function combineWithQuickFilter(userFilter: QQueryFilter, quickFilter: QQueryFilter | null): QQueryFilter {
  if (!quickFilter || quickFilter.criteria.length === 0) return userFilter
  const quick = { ...quickFilter, orderBys: [] }
  if (isFilterEmpty(userFilter)) return { ...quick, orderBys: userFilter.orderBys, skip: userFilter.skip, limit: userFilter.limit }
  return {
    criteria: [],
    subFilters: [{ ...userFilter, orderBys: [] }, quick],
    booleanOperator: 'AND',
    orderBys: userFilter.orderBys,
    skip: userFilter.skip,
    limit: userFilter.limit,
  }
}

/**
 * Sets the paging of a filter.
 *
 * @param filter - The base filter.
 * @param pageNum - 1-based page number.
 * @param pageSize - Records per page.
 * @returns A copy with `skip` and `limit` for that page.
 */
export function applyPagination(filter: QQueryFilter, pageNum: number, pageSize: number): QQueryFilter {
  return { ...filter, skip: (pageNum - 1) * pageSize, limit: pageSize }
}

/**
 * Replaces the sort of a filter.
 *
 * @param filter - The base filter.
 * @param orderBys - Sort to apply.
 * @returns A copy with `orderBys` replaced.
 */
export function applySort(filter: QQueryFilter, orderBys: QFilterOrderBy[]): QQueryFilter {
  return { ...filter, orderBys }
}

// ------------------------------------------------------------------
// Backend preparation
// ------------------------------------------------------------------

/**
 * Converts a `datetime-local` style value ("YYYY-MM-DDTHH:mm[:ss]", in the browser's zone)
 * to a UTC ISO instant for the backend, like Material's
 * `frontendLocalZoneDateTimeStringToUTCStringForBackend`. Other strings pass through.
 *
 * @param value - A date-time string.
 * @returns The UTC ISO string.
 */
export function localDateTimeToUtc(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(value)) return value
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toISOString()
}

/**
 * Converts a UTC instant to a `datetime-local` input value in the browser's zone.
 *
 * @param value - An ISO instant.
 * @returns "YYYY-MM-DDTHH:mm", or the input when it cannot be parsed.
 */
export function utcToLocalDateTimeInput(value: string): string {
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Coerces one scalar criteria value to the field's backend type.
 *
 * @param value - The UI value.
 * @param field - The field metadata, when known.
 * @returns The value for the backend.
 */
function cleanseValue(value: CriteriaValue, field: QFieldMetaData | undefined): CriteriaValue {
  if (isFilterExpression(value) || field === undefined) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (isNumericType(field.type) && trimmed !== '' && Number.isFinite(Number(trimmed))) return Number(trimmed)
    if (field.type === 'BOOLEAN' && (trimmed === 'true' || trimmed === 'false')) return trimmed === 'true'
    if (field.type === 'DATE_TIME') return localDateTimeToUtc(trimmed)
    return value
  }
  return value
}

/**
 * Prepares a UI filter for the backend (Material's `prepQueryFilterForBackend`): drops
 * incomplete criteria, sends no values for value-less operators, and coerces values to the
 * field types (numbers, booleans, UTC date-times). Paging is left to the caller.
 *
 * @param filter - The UI filter.
 * @param fieldFor - Resolves a criterion's field name to metadata.
 * @returns A new filter safe to send.
 */
export function prepFilterForBackend(filter: QQueryFilter, fieldFor: (fieldName: string) => QFieldMetaData | undefined): QQueryFilter {
  const criteria: QFilterCriteria[] = []
  for (const criterion of filter.criteria ?? []) {
    if (!isCriterionComplete(criterion)) continue
    if (OPERATOR_CONFIG[criterion.operator].valueCount === 'none') {
      criteria.push({ fieldName: criterion.fieldName, operator: criterion.operator, values: criterion.operator === 'EQUALS' ? criterion.values : [] })
      continue
    }
    const field = fieldFor(criterion.fieldName)
    criteria.push({ ...criterion, values: criterion.values.filter((v) => isSet(v)).map((v) => cleanseValue(v, field)) })
  }
  const subFilters = (filter.subFilters ?? []).map((sub) => prepFilterForBackend(sub, fieldFor)).filter((sub) => countActiveCriteria(sub) > 0)
  return { ...filter, criteria, subFilters }
}

// ------------------------------------------------------------------
// Expressions
// ------------------------------------------------------------------

/**
 * Type guard for filter variable expressions.
 *
 * @param v - Any criterion value.
 * @returns Whether it is a filter variable reference.
 */
export function isFilterVariableExpression(v: unknown): v is FilterVariableExpression {
  return typeof v === 'object' && v !== null && (v as { type?: string }).type === 'FilterVariableExpression'
}

/**
 * Type guard for `Now` expressions.
 *
 * @param v - Any criterion value.
 * @returns Whether it is a `Now` expression.
 */
export function isNowExpression(v: unknown): v is NowExpression {
  return typeof v === 'object' && v !== null && (v as { type?: string }).type === 'Now'
}

/**
 * Type guard for `NowWithOffset` expressions.
 *
 * @param v - Any criterion value.
 * @returns Whether it is a `NowWithOffset` expression.
 */
export function isNowWithOffsetExpression(v: unknown): v is NowWithOffsetExpression {
  return typeof v === 'object' && v !== null && (v as { type?: string }).type === 'NowWithOffset'
}

/**
 * Type guard for `ThisOrLastPeriod` expressions.
 *
 * @param v - Any criterion value.
 * @returns Whether it is a `ThisOrLastPeriod` expression.
 */
export function isThisOrLastPeriodExpression(v: unknown): v is ThisOrLastPeriodExpression {
  return typeof v === 'object' && v !== null && (v as { type?: string }).type === 'ThisOrLastPeriod'
}

/**
 * Type guard for any backend-evaluated expression.
 *
 * @param v - Any criterion value.
 * @returns Whether it is any backend-evaluated expression.
 */
export function isFilterExpression(v: unknown): v is FilterExpression {
  return isNowExpression(v) || isNowWithOffsetExpression(v) || isThisOrLastPeriodExpression(v) || isFilterVariableExpression(v)
}

/**
 * Singular/plural unit word for an expression time unit.
 *
 * @param unit - The unit.
 * @param amount - The amount (plural unless 1).
 * @returns The word, e.g. "day" or "days".
 */
function unitWord(unit: ExpressionTimeUnit, amount = 1): string {
  const singular = unit.toLowerCase().replace(/s$/, '')
  return amount === 1 ? singular : `${singular}s`
}

/**
 * Human-readable text for an expression, e.g. "3 days ago" or "start of last month".
 *
 * @param expression - The expression.
 * @param fieldType - DATE shows "today" for `Now`; other types show "now".
 * @returns The description.
 */
export function describeExpression(expression: FilterExpression, fieldType: QFieldType = 'DATE_TIME'): string {
  if (isNowExpression(expression)) return fieldType === 'DATE' ? 'today' : 'now'
  if (isNowWithOffsetExpression(expression)) {
    return `${expression.amount} ${unitWord(expression.timeUnit, expression.amount)} ${expression.operator === 'MINUS' ? 'ago' : 'from now'}`
  }
  if (isThisOrLastPeriodExpression(expression)) {
    return `start of ${expression.operator === 'LAST' ? 'last' : 'this'} ${unitWord(expression.timeUnit)}`
  }
  return `\${${expression.variableName}}`
}

/**
 * Formats a criterion as text, e.g. "Name contains Widget".
 *
 * @param criterion - The criterion.
 * @param labelFor - Optional field label lookup.
 * @returns The summary.
 */
export function formatCriterionDisplay(criterion: QFilterCriteria, labelFor?: (fieldName: string) => string | undefined): string {
  const op = OPERATOR_CONFIG[criterion.operator]?.label ?? criterion.operator
  const field = labelFor?.(criterion.fieldName) ?? criterion.fieldName
  if (OPERATOR_CONFIG[criterion.operator]?.valueCount === 'none' || criterion.values.length === 0) return `${field} ${op}`
  const vals = criterion.values.map((v) => (isFilterExpression(v) ? describeExpression(v) : String(v))).join(', ')
  return `${field} ${op} ${vals}`
}
