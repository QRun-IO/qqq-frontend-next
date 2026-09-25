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
 * @file Filter, sort, and join structures sent to the QQQ query API.
 */

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
 * Serialized exactly as the backend's `FilterVariableExpression` class, whose simple
 * class name is the `type` discriminator read by `QFilterCriteriaDeserializer`.
 */
export interface FilterVariableExpression {
  /** Discriminant: the backend expression class name. */
  type: 'FilterVariableExpression'
  /** The name of the runtime variable whose value is substituted at query time. */
  variableName: string
}

/**
 * A filter criteria value expression that resolves to the current date/time
 * (or today, for DATE fields). Backend class `Now`.
 */
export interface NowExpression {
  /** Discriminant: the backend expression class name. */
  type: 'Now'
}

/** Time units accepted by the backend `NowWithOffset` and `ThisOrLastPeriod` expressions (Java `ChronoUnit` names). */
export type ExpressionTimeUnit = 'SECONDS' | 'MINUTES' | 'HOURS' | 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS'

/**
 * A filter criteria value expression that resolves to now plus or minus an amount
 * of time, for example "7 days ago". Backend class `NowWithOffset`.
 */
export interface NowWithOffsetExpression {
  /** Discriminant: the backend expression class name. */
  type: 'NowWithOffset'
  /** `MINUS` for the past ("ago"), `PLUS` for the future ("from now"). */
  operator: 'PLUS' | 'MINUS'
  /** The magnitude of the offset (for example `7` for seven days). */
  amount: number
  /** The unit the offset is measured in. */
  timeUnit: ExpressionTimeUnit
}

/**
 * A filter criteria value expression that resolves to the start of the current or
 * previous period, for example "start of last month". Backend class `ThisOrLastPeriod`.
 */
export interface ThisOrLastPeriodExpression {
  /** Discriminant: the backend expression class name. */
  type: 'ThisOrLastPeriod'
  /** `THIS` for the current period, `LAST` for the previous one. */
  operator: 'THIS' | 'LAST'
  /** The period granularity. */
  timeUnit: ExpressionTimeUnit
}
