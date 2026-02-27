/** Query — filter, sort, and join structures sent to the QQQ query API */

// QQQ Query Types - ported from qqq-frontend-core

import type { QCriteriaOperator } from './enums'

/**
 * Root filter object passed to the `/tables/{name}/query` and `/tables/{name}/count` endpoints.
 *
 * Criteria are combined with `booleanOperator`; `subFilters` allows arbitrarily nested
 * AND/OR logic. `skip` and `limit` drive server-side pagination.
 */
export interface QQueryFilter {
  /** Flat list of filter criteria combined by `booleanOperator`. */
  criteria: QFilterCriteria[]
  /** Ordered list of sort specifications; first entry is the primary sort. */
  orderBys?: QFilterOrderBy[]
  /** Nested sub-filters that can introduce a different boolean operator for a group of criteria. */
  subFilters?: QQueryFilter[]
  /** Logical combinator applied between entries in `criteria` and `subFilters`. */
  booleanOperator: 'AND' | 'OR'
  /** Zero-based offset into the result set for pagination. */
  skip: number
  /** Maximum number of records to return in a single page. */
  limit: number
}

/**
 * A single field-level filter predicate within a `QQueryFilter`.
 *
 * `values` may contain literal scalars or dynamic expression objects; the backend
 * evaluates expressions (e.g. NOW, NOW_WITH_OFFSET) at query time.
 */
export interface QFilterCriteria {
  /** The field being tested (supports dot-notation for joined-table fields). */
  fieldName: string
  /** The comparison operator to apply between `fieldName` and `values`. */
  operator: QCriteriaOperator
  /**
   * The right-hand side operand(s) for the operator.
   *
   * Scalar types (`string`, `number`, `boolean`) are compared directly.
   * Expression types (`FilterVariableExpression`, `NowExpression`, etc.) are
   * resolved server-side.
   */
  values: (
    | string
    | number
    | boolean
    | FilterVariableExpression
    | NowExpression
    | NowWithOffsetExpression
    | ThisOrLastPeriodExpression
  )[]
  /** When set, compares `fieldName` against another field rather than a literal value. */
  otherFieldName?: string
}

/**
 * A single sort clause within a `QQueryFilter`.
 *
 * Multiple `QFilterOrderBy` entries form a compound sort in list order.
 */
export interface QFilterOrderBy {
  /** The field to sort by (supports dot-notation for joined-table fields). */
  fieldName: string
  /** `true` for ascending (A → Z, 0 → 9); `false` for descending. */
  isAscending: boolean
}

/**
 * Describes a join to be included in a query request.
 *
 * The frontend sends join instructions alongside a `QQueryFilter` when it needs
 * fields from a related table to appear in query results.
 */
export interface QueryJoin {
  /** Name of the table being joined. */
  joinTable: string
  /** When true, the joined table's fields are included in the SELECT clause. */
  select: boolean
  /** SQL join type controlling how unmatched rows are handled. */
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL'
  /** The alias or table name used as the left-hand side of the join condition. */
  baseTableOrAlias?: string
  /** Optional alias to assign to the joined table in this query context. */
  alias?: string
  /** Explicit join definition name on the backend (overrides auto-resolution). */
  joinName?: string
}

/**
 * A filter criteria value expression that references a named runtime variable.
 *
 * Variable names are resolved by the backend at query time, allowing saved
 * filter views to remain dynamic (e.g. current user, current date).
 */
export interface FilterVariableExpression {
  /** Discriminant that identifies this as a variable reference expression. */
  type: 'FILTER_VARIABLE'
  /** The name of the runtime variable whose value is substituted at query time. */
  variableName: string
}

/**
 * A filter criteria value expression that resolves to the current date/time.
 *
 * Use this instead of a hard-coded date so that saved filters remain current.
 */
export interface NowExpression {
  /** Discriminant that identifies this as a "now" expression. */
  type: 'NOW'
}

/**
 * A filter criteria value expression that resolves to the current date/time
 * adjusted by a fixed calendar offset.
 *
 * Useful for "in the last N days/weeks/months" style filters.
 */
export interface NowWithOffsetExpression {
  /** Discriminant that identifies this as a now-with-offset expression. */
  type: 'NOW_WITH_OFFSET'
  /** The magnitude of the offset (e.g. `7` for seven days). */
  offsetValue: number
  /** The calendar unit the offset is measured in. */
  offsetUnit: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR'
  /** When true, the offset is subtracted from now (past); false means future. */
  isNegativeOffset: boolean
}

/**
 * A filter criteria value expression that resolves to the boundary of the
 * current or previous calendar period.
 *
 * Allows "this week", "last month", "last quarter" style date range filters
 * to remain accurate without storing hard-coded dates.
 */
export interface ThisOrLastPeriodExpression {
  /** Discriminant that identifies this as a this-or-last-period expression. */
  type: 'THIS_OR_LAST_PERIOD'
  /** The calendar period granularity to use. */
  period: 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR'
  /** When true, resolves to the previous period; false resolves to the current period. */
  isLast: boolean
}
