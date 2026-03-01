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
 * @file filter-utils — filter construction, serialization, and type-guard helpers for QQQ Record Query.
 */

import type {
  QQueryFilter,
  QFilterCriteria,
  QFilterOrderBy,
  QCriteriaOperator,
  QFieldType,
  FilterVariableExpression,
  NowExpression,
  NowWithOffsetExpression,
  ThisOrLastPeriodExpression,
} from '@/types'

/**
 * Returns a blank {@link QQueryFilter} with no criteria, no sort, and the given page size.
 *
 * Used as the initial filter state on the Record Query page and as the fallback when
 * deserialization fails.
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

/**
 * UI-level descriptor for a single {@link QCriteriaOperator}.
 *
 * Used by the FilterBuilder to render operator dropdowns and determine how many
 * value inputs to show for a given operator.
 */
export interface OperatorConfig {
  /** Human-readable label shown in the operator dropdown. */
  label: string
  /**
   * How many value inputs the operator requires:
   * - `'single'` — one value input
   * - `'multiple'` — a multi-value (chip) input
   * - `'range'` — two value inputs (from/to)
   * - `'none'` — no value input (e.g. IS_BLANK)
   */
  valueCount: 'single' | 'multiple' | 'range' | 'none'
  /** Field types this operator is valid for; used to filter the dropdown per field. */
  applicableTypes: QFieldType[]
  /** Short tooltip description shown alongside the operator label. */
  description: string
}

/**
 * Maps every {@link QCriteriaOperator} to its UI display configuration.
 *
 * Used by {@link getOperatorsForFieldType} to build per-field operator lists
 * and by the FilterBuilder to look up value-input requirements.
 */
export const OPERATOR_CONFIG: Record<QCriteriaOperator, OperatorConfig> = {
  EQUALS: {
    label: 'Equals',
    valueCount: 'single',
    applicableTypes: ['STRING', 'INTEGER', 'LONG', 'DECIMAL', 'BOOLEAN', 'DATE', 'TIME', 'DATE_TIME'],
    description: 'Exact match',
  },
  NOT_EQUALS: {
    label: 'Not equals',
    valueCount: 'single',
    applicableTypes: ['STRING', 'INTEGER', 'LONG', 'DECIMAL', 'BOOLEAN', 'DATE', 'TIME', 'DATE_TIME'],
    description: 'Excludes exact match',
  },
  NOT_EQUALS_OR_IS_NULL: {
    label: 'Not equals or is null',
    valueCount: 'single',
    applicableTypes: ['STRING', 'INTEGER', 'LONG', 'DECIMAL', 'BOOLEAN', 'DATE', 'TIME', 'DATE_TIME'],
    description: 'Excludes match or is empty',
  },
  IN: {
    label: 'In',
    valueCount: 'multiple',
    applicableTypes: ['STRING', 'INTEGER', 'LONG', 'DECIMAL', 'BOOLEAN', 'DATE', 'TIME', 'DATE_TIME'],
    description: 'One of multiple values',
  },
  NOT_IN: {
    label: 'Not in',
    valueCount: 'multiple',
    applicableTypes: ['STRING', 'INTEGER', 'LONG', 'DECIMAL', 'BOOLEAN', 'DATE', 'TIME', 'DATE_TIME'],
    description: 'None of multiple values',
  },
  STARTS_WITH: {
    label: 'Starts with',
    valueCount: 'single',
    applicableTypes: ['STRING', 'TEXT', 'HTML'],
    description: 'String begins with value',
  },
  ENDS_WITH: {
    label: 'Ends with',
    valueCount: 'single',
    applicableTypes: ['STRING', 'TEXT', 'HTML'],
    description: 'String ends with value',
  },
  CONTAINS: {
    label: 'Contains',
    valueCount: 'single',
    applicableTypes: ['STRING', 'TEXT', 'HTML'],
    description: 'String contains value',
  },
  NOT_STARTS_WITH: {
    label: 'Not starts with',
    valueCount: 'single',
    applicableTypes: ['STRING', 'TEXT', 'HTML'],
    description: 'String does not begin with value',
  },
  NOT_ENDS_WITH: {
    label: 'Not ends with',
    valueCount: 'single',
    applicableTypes: ['STRING', 'TEXT', 'HTML'],
    description: 'String does not end with value',
  },
  NOT_CONTAINS: {
    label: 'Not contains',
    valueCount: 'single',
    applicableTypes: ['STRING', 'TEXT', 'HTML'],
    description: 'String does not contain value',
  },
  LESS_THAN: {
    label: 'Less than',
    valueCount: 'single',
    applicableTypes: ['INTEGER', 'LONG', 'DECIMAL', 'DATE', 'TIME', 'DATE_TIME'],
    description: 'Value is less than',
  },
  LESS_THAN_OR_EQUALS: {
    label: 'Less than or equals',
    valueCount: 'single',
    applicableTypes: ['INTEGER', 'LONG', 'DECIMAL', 'DATE', 'TIME', 'DATE_TIME'],
    description: 'Value is less than or equal',
  },
  GREATER_THAN: {
    label: 'Greater than',
    valueCount: 'single',
    applicableTypes: ['INTEGER', 'LONG', 'DECIMAL', 'DATE', 'TIME', 'DATE_TIME'],
    description: 'Value is greater than',
  },
  GREATER_THAN_OR_EQUALS: {
    label: 'Greater than or equals',
    valueCount: 'single',
    applicableTypes: ['INTEGER', 'LONG', 'DECIMAL', 'DATE', 'TIME', 'DATE_TIME'],
    description: 'Value is greater than or equal',
  },
  IS_BLANK: {
    label: 'Is blank',
    valueCount: 'none',
    applicableTypes: ['STRING', 'INTEGER', 'LONG', 'DECIMAL', 'BOOLEAN', 'DATE', 'TIME', 'DATE_TIME', 'TEXT', 'HTML'],
    description: 'Field is empty',
  },
  IS_NOT_BLANK: {
    label: 'Is not blank',
    valueCount: 'none',
    applicableTypes: ['STRING', 'INTEGER', 'LONG', 'DECIMAL', 'BOOLEAN', 'DATE', 'TIME', 'DATE_TIME', 'TEXT', 'HTML'],
    description: 'Field is not empty',
  },
  BETWEEN: {
    label: 'Between',
    valueCount: 'range',
    applicableTypes: ['INTEGER', 'LONG', 'DECIMAL', 'DATE', 'TIME', 'DATE_TIME'],
    description: 'Value is between two values (inclusive)',
  },
  NOT_BETWEEN: {
    label: 'Not between',
    valueCount: 'range',
    applicableTypes: ['INTEGER', 'LONG', 'DECIMAL', 'DATE', 'TIME', 'DATE_TIME'],
    description: 'Value is not between two values',
  },
}

/**
 * Returns the list of {@link QCriteriaOperator} values that are valid for the given field type.
 *
 * Filters {@link OPERATOR_CONFIG} to only include operators whose `applicableTypes` array
 * contains `fieldType`.
 *
 * @param fieldType - The QQQ field type (e.g. `'STRING'`, `'DATE'`).
 * @returns An ordered array of applicable operator keys.
 */
export function getOperatorsForFieldType(fieldType: QFieldType): QCriteriaOperator[] {
  return (Object.entries(OPERATOR_CONFIG) as [QCriteriaOperator, OperatorConfig][])
    .filter(([, config]) => config.applicableTypes.includes(fieldType))
    .map(([op]) => op)
}

/**
 * Returns the most appropriate default {@link QCriteriaOperator} for a given field type.
 *
 * String fields default to `CONTAINS`; all other types default to `EQUALS`.
 * Used when the user adds a new filter criterion without explicitly choosing an operator.
 *
 * @param fieldType - The QQQ field type to look up.
 * @returns The default operator for that type.
 */
export function getDefaultOperatorForFieldType(fieldType: QFieldType): QCriteriaOperator {
  switch (fieldType) {
    case 'STRING':
    case 'TEXT':
    case 'HTML':
      return 'CONTAINS'
    case 'INTEGER':
    case 'LONG':
    case 'DECIMAL':
      return 'EQUALS'
    case 'BOOLEAN':
      return 'EQUALS'
    case 'DATE':
    case 'DATE_TIME':
    case 'TIME':
      return 'EQUALS'
    default:
      return 'EQUALS'
  }
}

/**
 * Returns true when the given field type represents a numeric value (INTEGER, LONG, or DECIMAL).
 *
 * Used by `buildQuickFilter` and `FilterBuilder` to determine which operators and input
 * components are appropriate for a field. Numeric fields support range, comparison, and
 * equality operators but not the string-specific CONTAINS/STARTS_WITH family.
 *
 * @param fieldType - The QQQ field type string to test (e.g. `'INTEGER'`).
 * @returns `true` if `fieldType` is one of `INTEGER`, `LONG`, or `DECIMAL`; `false` otherwise.
 */
export function isNumericType(fieldType: QFieldType): boolean {
  return ['INTEGER', 'LONG', 'DECIMAL'].includes(fieldType)
}

/**
 * Returns true when the given field type represents textual content (STRING, TEXT, or HTML).
 *
 * Used by `buildQuickFilter` to select which columns participate in quick search (only
 * string-like columns get CONTAINS criteria), and by `FilterBuilder` to enable the
 * STARTS_WITH / ENDS_WITH / CONTAINS operator group.
 *
 * @param fieldType - The QQQ field type string to test (e.g. `'STRING'`).
 * @returns `true` if `fieldType` is one of `STRING`, `TEXT`, or `HTML`; `false` otherwise.
 */
export function isStringType(fieldType: QFieldType): boolean {
  return ['STRING', 'TEXT', 'HTML'].includes(fieldType)
}

/**
 * Returns true when the given field type represents a date, time, or combined date-time value.
 *
 * Used by `FilterBuilder` to decide whether to render the dynamic date-expression picker
 * (NOW, NOW_WITH_OFFSET, THIS_OR_LAST_PERIOD) instead of a plain text input for filter
 * criterion values.
 *
 * @param fieldType - The QQQ field type string to test (e.g. `'DATE_TIME'`).
 * @returns `true` if `fieldType` is one of `DATE`, `TIME`, or `DATE_TIME`; `false` otherwise.
 */
export function isDateTimeType(fieldType: QFieldType): boolean {
  return ['DATE', 'TIME', 'DATE_TIME'].includes(fieldType)
}

/**
 * Counts the number of active (non-empty) filter criteria in a {@link QQueryFilter}, including
 * any criteria nested inside `subFilters`.
 *
 * A criterion is considered active when:
 * - Its operator requires no value (e.g. IS_BLANK), OR
 * - At least one of its `values` is non-empty.
 *
 * Used to display the active-filter badge count on the FilterBuilder toggle button.
 *
 * @param filter - The filter to inspect.
 * @returns The total count of active criteria across the filter and all sub-filters.
 */
export function countActiveCriteria(filter: QQueryFilter): number {
  let count = 0

  for (const criterion of filter.criteria) {
    const config = OPERATOR_CONFIG[criterion.operator]
    if (!config) continue
    if (config.valueCount === 'none') {
      count++
    } else if (criterion.values.length > 0) {
      const hasValue = criterion.values.some((v) => v !== '' && v !== null && v !== undefined)
      if (hasValue) count++
    }
  }

  for (const sub of filter.subFilters ?? []) {
    count += countActiveCriteria(sub)
  }

  return count
}

/**
 * Returns true when a filter has no active criteria (i.e. {@link countActiveCriteria} is zero).
 *
 * @param filter - The filter to test.
 * @returns `true` if there are no active criteria.
 */
export function isFilterEmpty(filter: QQueryFilter): boolean {
  return countActiveCriteria(filter) === 0
}

/**
 * Serialize a QQueryFilter to a compact, URL-safe base64 string for use in search params.
 * Encodes criteria, orderBys, subFilters, and booleanOperator — pagination is excluded.
 *
 * Uses TextEncoder → btoa so the output length is proportional to the UTF-8 byte count of
 * the JSON (≈1.33× the character count) rather than the double-encoded length produced by
 * encodeURIComponent + btoa (which can be 3–9× for non-ASCII values). MED-5.
 *
 * @param filter - The filter to serialize. Pagination fields (`skip`, `limit`) are excluded.
 * @returns A URL-safe base64 string, or an empty string if serialization fails.
 */
export function serializeFilter(filter: QQueryFilter): string {
  try {
    const serializable = {
      criteria: filter.criteria,
      orderBys: filter.orderBys,
      subFilters: filter.subFilters,
      booleanOperator: filter.booleanOperator,
    }
    const json = JSON.stringify(serializable)
    const bytes = new TextEncoder().encode(json)
    let chars = ''
    for (const b of bytes) chars += String.fromCharCode(b)
    return btoa(chars)
  } catch {
    return ''
  }
}

/**
 * Deserialize a QQueryFilter from a string produced by {@link serializeFilter}.
 * Falls back to an empty filter on any parse error.
 *
 * @param encoded - A base64-encoded filter string produced by {@link serializeFilter}.
 * @param pageSize - Page size to use for the `limit` field of the restored filter.
 * @returns The deserialized `QQueryFilter`, or an empty filter if decoding fails.
 */
export function deserializeFilter(
  encoded: string,
  pageSize = 25
): QQueryFilter {
  try {
    const chars = atob(encoded)
    const bytes = new Uint8Array(chars.length)
    for (let i = 0; i < chars.length; i++) bytes[i] = chars.charCodeAt(i)
    const decoded = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>
    return {
      criteria: (decoded.criteria as QQueryFilter['criteria']) ?? [],
      orderBys: (decoded.orderBys as QQueryFilter['orderBys']) ?? [],
      subFilters: (decoded.subFilters as QQueryFilter['subFilters']) ?? [],
      booleanOperator: (decoded.booleanOperator as QQueryFilter['booleanOperator']) ?? 'AND',
      skip: 0,
      limit: pageSize,
    }
  } catch {
    return emptyFilter(pageSize)
  }
}

/**
 * Builds a quick-search {@link QQueryFilter} that uses an OR join across all visible string fields.
 *
 * Each visible field whose type is a string-like type (STRING, TEXT, HTML) gets a CONTAINS
 * criterion for the given search term. Returns an empty filter when the term is blank.
 *
 * @param searchTerm - The text the user typed into the quick-search input.
 * @param visibleFieldNames - The ordered list of column field names currently shown in the grid.
 * @param fieldTypes - A map from field name to its {@link QFieldType}.
 * @param pageSize - The `limit` to embed in the returned filter. Defaults to 25.
 * @returns A {@link QQueryFilter} with OR-joined CONTAINS criteria, or an empty filter.
 */
export function buildQuickFilter(
  searchTerm: string,
  visibleFieldNames: string[],
  fieldTypes: Record<string, QFieldType>,
  pageSize = 25
): QQueryFilter {
  if (!searchTerm.trim()) return emptyFilter(pageSize)

  const criteria: QFilterCriteria[] = visibleFieldNames
    .filter((name) => {
      const type = fieldTypes[name]
      return type && isStringType(type)
    })
    .map((fieldName) => ({
      fieldName,
      operator: 'CONTAINS' as QCriteriaOperator,
      values: [searchTerm],
    }))

  return {
    criteria,
    orderBys: [],
    subFilters: [],
    booleanOperator: 'OR',
    skip: 0,
    limit: pageSize,
  }
}

/**
 * Returns a new filter with `skip` and `limit` set for the requested page.
 *
 * Does not mutate the original filter.
 *
 * @param filter - The base filter to apply pagination to.
 * @param pageNum - The 1-based page number.
 * @param pageSize - The number of records per page.
 * @returns A new {@link QQueryFilter} with updated `skip` and `limit` values.
 */
export function applyPagination(
  filter: QQueryFilter,
  pageNum: number,
  pageSize: number
): QQueryFilter {
  return {
    ...filter,
    skip: (pageNum - 1) * pageSize,
    limit: pageSize,
  }
}

/**
 * Returns a new filter with `orderBys` replaced by the given sort specification.
 *
 * Does not mutate the original filter.
 *
 * @param filter - The base filter to apply sorting to.
 * @param orderBys - The new sort order to apply.
 * @returns A new {@link QQueryFilter} with updated `orderBys`.
 */
export function applySort(filter: QQueryFilter, orderBys: QFilterOrderBy[]): QQueryFilter {
  return { ...filter, orderBys }
}

/**
 * Type guard — narrows `v` to {@link FilterVariableExpression} when its `type` is `'FILTER_VARIABLE'`.
 *
 * Used by `formatCriterionDisplay` and `FilterBuilder` to discriminate between static
 * scalar values and dynamic filter variable references (e.g. `$currentUser`) before
 * rendering criterion chips or submitting the filter to the API.
 *
 * @param v - Any criterion value, which may be a string, number, or an expression object.
 * @returns `true` if `v` is a non-null object with `type === 'FILTER_VARIABLE'`, narrowing
 *   the type to `FilterVariableExpression` for subsequent property access.
 */
export function isFilterVariableExpression(
  v: unknown
): v is FilterVariableExpression {
  return typeof v === 'object' && v !== null && (v as FilterVariableExpression).type === 'FILTER_VARIABLE'
}

/**
 * Type guard — narrows `v` to {@link NowExpression} when its `type` is `'NOW'`.
 *
 * Used by `formatCriterionDisplay` and `FilterBuilder` to discriminate between static
 * date values and the dynamic "current moment" expression before rendering criterion
 * chips (displayed as `"now"`) or submitting to the API.
 *
 * @param v - Any criterion value, which may be a string, number, or an expression object.
 * @returns `true` if `v` is a non-null object with `type === 'NOW'`, narrowing the type
 *   to `NowExpression` for subsequent property access.
 */
export function isNowExpression(v: unknown): v is NowExpression {
  return typeof v === 'object' && v !== null && (v as NowExpression).type === 'NOW'
}

/**
 * Type guard — narrows `v` to {@link NowWithOffsetExpression} when its `type` is `'NOW_WITH_OFFSET'`.
 *
 * Used by `formatCriterionDisplay` and `FilterBuilder` to discriminate between static
 * date values and a relative offset expression (e.g. "7 days ago") before rendering
 * criterion chips (displayed as `"now -7 days"`) or submitting to the API.
 *
 * @param v - Any criterion value, which may be a string, number, or an expression object.
 * @returns `true` if `v` is a non-null object with `type === 'NOW_WITH_OFFSET'`, narrowing
 *   the type to `NowWithOffsetExpression` so `offsetValue`, `offsetUnit`, and
 *   `isNegativeOffset` are accessible without casting.
 */
export function isNowWithOffsetExpression(v: unknown): v is NowWithOffsetExpression {
  return typeof v === 'object' && v !== null && (v as NowWithOffsetExpression).type === 'NOW_WITH_OFFSET'
}

/**
 * Type guard — narrows `v` to {@link ThisOrLastPeriodExpression} when its `type` is `'THIS_OR_LAST_PERIOD'`.
 *
 * Used by `formatCriterionDisplay` and `FilterBuilder` to discriminate between static
 * date values and a calendar-period expression (e.g. "this month", "last quarter") before
 * rendering criterion chips (displayed as `"this month"` / `"last quarter"`) or submitting
 * to the API.
 *
 * @param v - Any criterion value, which may be a string, number, or an expression object.
 * @returns `true` if `v` is a non-null object with `type === 'THIS_OR_LAST_PERIOD'`, narrowing
 *   the type to `ThisOrLastPeriodExpression` so `period` and `isLast` are accessible without casting.
 */
export function isThisOrLastPeriodExpression(v: unknown): v is ThisOrLastPeriodExpression {
  return typeof v === 'object' && v !== null && (v as ThisOrLastPeriodExpression).type === 'THIS_OR_LAST_PERIOD'
}

/**
 * Formats a {@link QFilterCriteria} as a human-readable summary string.
 *
 * Handles dynamic expressions (NOW, NOW_WITH_OFFSET, THIS_OR_LAST_PERIOD) as well as
 * plain scalar values. Used by the FilterBuilder chip display and the saved-view summary.
 *
 * @param criterion - The filter criterion to format.
 * @returns A string such as `"createdDate Contains now -7 days"`.
 */
export function formatCriterionDisplay(criterion: QFilterCriteria): string {
  const op = OPERATOR_CONFIG[criterion.operator]?.label ?? criterion.operator
  if (criterion.values.length === 0) return `${criterion.fieldName} ${op}`
  const vals = criterion.values
    .map((v) => {
      if (typeof v === 'object' && v !== null) {
        const expr = v as { type: string }
        if (expr.type === 'NOW') return 'now'
        if (expr.type === 'NOW_WITH_OFFSET') {
          const nwo = v as NowWithOffsetExpression
          return `now ${nwo.isNegativeOffset ? '-' : '+'}${nwo.offsetValue} ${nwo.offsetUnit.toLowerCase()}`
        }
        if (expr.type === 'THIS_OR_LAST_PERIOD') {
          const tlp = v as ThisOrLastPeriodExpression
          return `${tlp.isLast ? 'last' : 'this'} ${tlp.period.toLowerCase()}`
        }
        return String(v)
      }
      return String(v)
    })
    .join(', ')
  return `${criterion.fieldName} ${op} ${vals}`
}
