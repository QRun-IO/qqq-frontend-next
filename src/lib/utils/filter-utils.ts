// Filter utility functions for QQQ Record Query
// Handles filter serialization/deserialization for URL params and localStorage

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

// Default empty filter
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

// Operator configuration for filter builder UI
export interface OperatorConfig {
  label: string
  valueCount: 'single' | 'multiple' | 'range' | 'none'
  applicableTypes: QFieldType[]
  description: string
}

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

// Get operators applicable to a given field type
export function getOperatorsForFieldType(fieldType: QFieldType): QCriteriaOperator[] {
  return (Object.entries(OPERATOR_CONFIG) as [QCriteriaOperator, OperatorConfig][])
    .filter(([, config]) => config.applicableTypes.includes(fieldType))
    .map(([op]) => op)
}

// Default operator for a field type
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

// Check if a field type is numeric
export function isNumericType(fieldType: QFieldType): boolean {
  return ['INTEGER', 'LONG', 'DECIMAL'].includes(fieldType)
}

// Check if a field type is a string type
export function isStringType(fieldType: QFieldType): boolean {
  return ['STRING', 'TEXT', 'HTML'].includes(fieldType)
}

// Check if a field type is a date/time type
export function isDateTimeType(fieldType: QFieldType): boolean {
  return ['DATE', 'TIME', 'DATE_TIME'].includes(fieldType)
}

// Count active filter criteria (non-empty)
export function countActiveCriteria(filter: QQueryFilter): number {
  let count = 0

  for (const criterion of filter.criteria) {
    const config = OPERATOR_CONFIG[criterion.operator]
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

// Check if a filter is empty (no active criteria)
export function isFilterEmpty(filter: QQueryFilter): boolean {
  return countActiveCriteria(filter) === 0
}

// Serialize a QQueryFilter to a URL-safe string (for search params)
export function serializeFilter(filter: QQueryFilter): string {
  try {
    // Only serialize criteria and settings, not skip/limit (those are pagination)
    const serializable = {
      criteria: filter.criteria,
      orderBys: filter.orderBys,
      subFilters: filter.subFilters,
      booleanOperator: filter.booleanOperator,
    }
    return btoa(encodeURIComponent(JSON.stringify(serializable)))
  } catch {
    return ''
  }
}

// Deserialize a filter from a URL-safe string
export function deserializeFilter(
  encoded: string,
  pageSize = 25
): QQueryFilter {
  try {
    const decoded = JSON.parse(decodeURIComponent(atob(encoded)))
    return {
      criteria: decoded.criteria ?? [],
      orderBys: decoded.orderBys ?? [],
      subFilters: decoded.subFilters ?? [],
      booleanOperator: decoded.booleanOperator ?? 'AND',
      skip: 0,
      limit: pageSize,
    }
  } catch {
    return emptyFilter(pageSize)
  }
}

// Build a quick-search filter from a text term across visible string fields
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

// Merge a user filter with pagination settings
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

// Apply sort to a filter
export function applySort(filter: QQueryFilter, orderBys: QFilterOrderBy[]): QQueryFilter {
  return { ...filter, orderBys }
}

// Type guard helpers
export function isFilterVariableExpression(
  v: unknown
): v is FilterVariableExpression {
  return typeof v === 'object' && v !== null && (v as FilterVariableExpression).type === 'FILTER_VARIABLE'
}

export function isNowExpression(v: unknown): v is NowExpression {
  return typeof v === 'object' && v !== null && (v as NowExpression).type === 'NOW'
}

export function isNowWithOffsetExpression(v: unknown): v is NowWithOffsetExpression {
  return typeof v === 'object' && v !== null && (v as NowWithOffsetExpression).type === 'NOW_WITH_OFFSET'
}

export function isThisOrLastPeriodExpression(v: unknown): v is ThisOrLastPeriodExpression {
  return typeof v === 'object' && v !== null && (v as ThisOrLastPeriodExpression).type === 'THIS_OR_LAST_PERIOD'
}

// Format a display value for a filter criterion (for summary display)
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
