// QQQ Query Types - ported from qqq-frontend-core

import type { QCriteriaOperator } from './enums'

export interface QQueryFilter {
  criteria: QFilterCriteria[]
  orderBys?: QFilterOrderBy[]
  subFilters?: QQueryFilter[]
  booleanOperator: 'AND' | 'OR'
  skip: number
  limit: number
}

export interface QFilterCriteria {
  fieldName: string
  operator: QCriteriaOperator
  values: (
    | string
    | number
    | boolean
    | FilterVariableExpression
    | NowExpression
    | NowWithOffsetExpression
    | ThisOrLastPeriodExpression
  )[]
  otherFieldName?: string
}

export interface QFilterOrderBy {
  fieldName: string
  isAscending: boolean
}

export interface QueryJoin {
  joinTable: string
  select: boolean
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL'
  baseTableOrAlias?: string
  alias?: string
  joinName?: string
}

export interface FilterVariableExpression {
  type: 'FILTER_VARIABLE'
  variableName: string
}

export interface NowExpression {
  type: 'NOW'
}

export interface NowWithOffsetExpression {
  type: 'NOW_WITH_OFFSET'
  offsetValue: number
  offsetUnit: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR'
  isNegativeOffset: boolean
}

export interface ThisOrLastPeriodExpression {
  type: 'THIS_OR_LAST_PERIOD'
  period: 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR'
  isLast: boolean
}
