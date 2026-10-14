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

/** @file Analysis filter conversion, formatting, and standard table drill URLs. */

import type { QQueryFilter } from '@/types'
import type {
  DataAnalysisDrillV1,
  DataAnalysisMetricV1,
  QueryFilter,
  FilterCriteria,
} from '@/types/data-analysis'
import { normalizeFilter, serializeFilter } from './filter-utils'
import { withTrailingSlash } from './material-links'

const OPERATORS = new Set<FilterCriteria['operator']>([
  'EQUALS',
  'NOT_EQUALS',
  'NOT_EQUALS_OR_IS_NULL',
  'IN',
  'NOT_IN',
  'IS_NULL_OR_IN',
  'LIKE',
  'NOT_LIKE',
  'STARTS_WITH',
  'ENDS_WITH',
  'CONTAINS',
  'NOT_STARTS_WITH',
  'NOT_ENDS_WITH',
  'NOT_CONTAINS',
  'LESS_THAN',
  'LESS_THAN_OR_EQUALS',
  'GREATER_THAN',
  'GREATER_THAN_OR_EQUALS',
  'IS_BLANK',
  'IS_NOT_BLANK',
  'BETWEEN',
  'NOT_BETWEEN',
  'TRUE',
  'FALSE',
])

/** Converts the current query to the published filter schema without dropping predicates.
 * The contract specifies string operands and allows core filter extensions. Unsupported filters
 * must fail visibly rather than accidentally analyzing a broader population.
 * @param filter - The prepared query filter (without pagination).
 * @returns The contract filter.
 */
export function analysisFilter(filter: Partial<QQueryFilter>): QueryFilter {
  const criteria = (filter.criteria ?? []).map((criterion): FilterCriteria => {
    const operator = criterion.operator as FilterCriteria['operator']
    if (
      !OPERATORS.has(operator) ||
      criterion.fieldFunction ||
      criterion.otherFieldName ||
      criterion.values.some((v) => typeof v === 'object')
    ) {
      throw new Error(
        'Analysis does not yet support this filter expression. Use literal filter values to analyze these records.'
      )
    }
    return { fieldName: criterion.fieldName, operator, values: criterion.values.map(String) }
  })
  return {
    criteria,
    booleanOperator: filter.booleanOperator ?? 'AND',
    ...(filter.subFilters?.length ? { subFilters: filter.subFilters.map(analysisFilter) } : {}),
  }
}

/** Builds the standard query route, preserving the server's complete drill predicate.
 * @param drill - The server-provided drill.
 * @returns A query URL, or null when the drill is unavailable.
 */
export function drillHref(drill: DataAnalysisDrillV1 | undefined): string | null {
  if (!drill?.tableName || !drill.filter) return null
  const params = new URLSearchParams({ filter: serializeFilter(normalizeFilter(drill.filter)) })
  return `${withTrailingSlash(`/app/${encodeURIComponent(drill.tableName)}`)}?${params}`
}

/** Formats a metric, respecting suppression before looking at its value.
 * @param metric - Semantic metric from the API.
 * @returns Display text.
 */
export function metricText(metric: DataAnalysisMetricV1): string {
  if (!metric) return '—'
  if (metric.suppressed) return 'Hidden'
  return metric.formatted ?? '—'
}
