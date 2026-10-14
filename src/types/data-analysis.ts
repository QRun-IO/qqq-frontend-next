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

/** @file Types transcribed from qbit-data-analysis OpenAPI data-analysis.yaml. Optionality, enums and nullability follow the contract, including nullable array items. */

/** DataAnalysisAxisV1 wire schema. */
export type DataAnalysisAxisV1 = {
  /** Field. */
  field?: string | null
  /** Label. */
  label?: string | null
  /** Value type. */
  valueType?: 'COUNT' | 'DECIMAL' | 'PERCENT' | 'DATE' | 'DATE_TIME' | 'DURATION' | 'TEXT' | null
} | null

/** DataAnalysisCandidateKeyV1 wire schema. */
export type DataAnalysisCandidateKeyV1 = {
  /** Readable fields to include; omit for all analyzable fields on a table profile. */
  fields?: Array<string> | null
  /** Row count. */
  rowCount?: number | null
  /** Open the matching records using this table and QueryFilter; null when suppressed. */
  drill?: DataAnalysisDrillV1 | null
} | null

/** DataAnalysisCapabilitiesV1 wire schema. */
export type DataAnalysisCapabilitiesV1 = {
  /** Whether this session may analyze the table; false responses expose no fields. */
  canAnalyze?: boolean | null
  /** Table name. */
  tableName?: string | null
  /** Table label. */
  tableLabel?: string | null
  /** Readable fields to include; omit for all analyzable fields on a table profile. */
  fields?: Array<DataAnalysisCapabilityFieldV1> | null
  /** Limits. */
  limits?: DataAnalysisLimitsV1 | null
  /** Backend capabilities. */
  backendCapabilities?: Array<string> | null
  /** Whether SQL Workbench metadata is installed in this instance. */
  sqlWorkbenchAvailable?: boolean | null
} | null

/** DataAnalysisCapabilityFieldV1 wire schema. */
export type DataAnalysisCapabilityFieldV1 = {
  /** Name. */
  name?: string | null
  /** Label. */
  label?: string | null
  /** Type. */
  type?: string | null
  /** Semantic field kind: NUMERIC, DATE, DATE_TIME, TEXT, BOOLEAN or CATEGORY. */
  kind?: string | null
  /** Default chart kind. */
  defaultChartKind?:
    | 'HISTOGRAM'
    | 'BOX'
    | 'BAR'
    | 'PARETO'
    | 'TIME_SERIES'
    | 'SCATTER'
    | 'HEATMAP'
    | null
} | null

/** DataAnalysisChartV1 wire schema. */
export type DataAnalysisChartV1 = {
  /** Semantic field kind: NUMERIC, DATE, DATE_TIME, TEXT, BOOLEAN or CATEGORY. */
  kind?: 'HISTOGRAM' | 'BOX' | 'BAR' | 'PARETO' | 'TIME_SERIES' | 'SCATTER' | 'HEATMAP' | null
  /** Alternatives. */
  alternatives?: Array<
    'HISTOGRAM' | 'BOX' | 'BAR' | 'PARETO' | 'TIME_SERIES' | 'SCATTER' | 'HEATMAP'
  > | null
  /** X. */
  x?: DataAnalysisAxisV1 | null
  /** Y. */
  y?: DataAnalysisAxisV1 | null
  /** Series. */
  series?: Array<DataAnalysisSeriesV1> | null
  /** Annotations. */
  annotations?: Array<string> | null
} | null

/** DataAnalysisColumnProfileRequestV1 wire schema. */
export type DataAnalysisColumnProfileRequestV1 = {
  /** Core QueryFilter JSON, identical to the table query and count endpoints. */
  filter?: QueryFilter
  /** Request exact computation instead of the configured estimate. */
  exact?: boolean
  /** Readable field name to profile or enumerate. */
  fieldName: string
}

/** DataAnalysisColumnProfileV1 wire schema. */
export type DataAnalysisColumnProfileV1 = {
  /** Table name. */
  tableName?: string | null
  /** Core QueryFilter JSON, identical to the table query and count endpoints. */
  filter?: QueryFilter | null
  /** True when statistics describe a sample rather than the entire filtered population. */
  estimate?: boolean | null
  /** Actual number of rows in the sample, not an extrapolated count. */
  sampleRows?: number | null
  /** True when the row limit prevented a complete scan. */
  truncated?: boolean | null
  /** Number of source rows included in computation. */
  rowsScanned?: number | null
  /** As of. */
  asOf?: string | null
  /** Data version. */
  dataVersion?: string | null
  /** Warnings. */
  warnings?: Array<string> | null
  /** Readable field name to profile or enumerate. */
  fieldName?: string | null
  /** Field label. */
  fieldLabel?: string | null
  /** Field type. */
  fieldType?: string | null
  /** Counts. */
  counts?: Array<DataAnalysisMetricV1> | null
  /** Numeric. */
  numeric?: DataAnalysisNumericProfileV1 | null
  /** Dates. */
  dates?: DataAnalysisDateProfileV1 | null
  /** Text. */
  text?: DataAnalysisTextProfileV1 | null
  /** Booleans. */
  booleans?: Array<DataAnalysisMetricV1> | null
  /** Top values. */
  topValues?: Array<DataAnalysisValueCountV1> | null
  /** Chart. */
  chart?: DataAnalysisChartV1 | null
} | null

/** DataAnalysisDateProfileV1 wire schema. */
export type DataAnalysisDateProfileV1 = {
  /** Metrics. */
  metrics?: Array<DataAnalysisMetricV1> | null
  /** Unit. */
  unit?: string | null
  /** Buckets. */
  buckets?: Array<DataAnalysisValueCountV1> | null
  /** Gaps. */
  gaps?: Array<DataAnalysisValueCountV1> | null
  /** Day of week. */
  dayOfWeek?: Array<DataAnalysisValueCountV1> | null
  /** Hour of day. */
  hourOfDay?: Array<DataAnalysisValueCountV1> | null
} | null

/** DataAnalysisDistinctValuesPageV1 wire schema. */
export type DataAnalysisDistinctValuesPageV1 = {
  /** Table name. */
  tableName?: string | null
  /** Core QueryFilter JSON, identical to the table query and count endpoints. */
  filter?: QueryFilter | null
  /** True when statistics describe a sample rather than the entire filtered population. */
  estimate?: boolean | null
  /** Actual number of rows in the sample, not an extrapolated count. */
  sampleRows?: number | null
  /** True when the row limit prevented a complete scan. */
  truncated?: boolean | null
  /** Number of source rows included in computation. */
  rowsScanned?: number | null
  /** As of. */
  asOf?: string | null
  /** Data version. */
  dataVersion?: string | null
  /** Warnings. */
  warnings?: Array<string> | null
  /** Readable field name to profile or enumerate. */
  fieldName?: string | null
  /** Zero-based page number. */
  page?: number | null
  /** Maximum values per page, from 1 to 500. */
  pageSize?: number | null
  /** Has more. */
  hasMore?: boolean | null
  /** Total distinct. */
  totalDistinct?: number | null
  /** Values. */
  values?: Array<DataAnalysisValueCountV1> | null
} | null

/** DataAnalysisDistinctValuesRequestV1 wire schema. */
export type DataAnalysisDistinctValuesRequestV1 = {
  /** Core QueryFilter JSON, identical to the table query and count endpoints. */
  filter?: QueryFilter
  /** Readable field name to profile or enumerate. */
  fieldName: string
  /** Zero-based page number. */
  page?: number
  /** Maximum values per page, from 1 to 500. */
  pageSize?: number
  /** Optional search text applied to stored values. */
  search?: string
}

/** DataAnalysisDrillV1 wire schema. */
export type DataAnalysisDrillV1 = {
  /** Table name. */
  tableName?: string | null
  /** Core QueryFilter JSON, identical to the table query and count endpoints. */
  filter?: QueryFilter | null
} | null

/** DataAnalysisDuplicatesRequestV1 wire schema. */
export type DataAnalysisDuplicatesRequestV1 = {
  /** Core QueryFilter JSON, identical to the table query and count endpoints. */
  filter?: QueryFilter
  /** Readable fields to include; omit for all analyzable fields on a table profile. */
  fields: Array<string>
  /** Maximum duplicate groups to return, from 1 to 500; default 50. */
  limit?: number
}

/** DataAnalysisDuplicatesResultV1 wire schema. */
export type DataAnalysisDuplicatesResultV1 = {
  /** Table name. */
  tableName?: string | null
  /** Core QueryFilter JSON, identical to the table query and count endpoints. */
  filter?: QueryFilter | null
  /** True when statistics describe a sample rather than the entire filtered population. */
  estimate?: boolean | null
  /** Actual number of rows in the sample, not an extrapolated count. */
  sampleRows?: number | null
  /** True when the row limit prevented a complete scan. */
  truncated?: boolean | null
  /** Number of source rows included in computation. */
  rowsScanned?: number | null
  /** As of. */
  asOf?: string | null
  /** Data version. */
  dataVersion?: string | null
  /** Warnings. */
  warnings?: Array<string> | null
  /** Readable fields to include; omit for all analyzable fields on a table profile. */
  fields?: Array<string> | null
  /** Groups. */
  groups?: Array<DataAnalysisValueCountV1> | null
} | null

/** DataAnalysisFieldSummaryV1 wire schema. */
export type DataAnalysisFieldSummaryV1 = {
  /** Field. */
  field?: string | null
  /** Label. */
  label?: string | null
  /** Type. */
  type?: string | null
  /** Completeness. */
  completeness?: number | null
  /** Distinct. */
  distinct?: number | null
  /** Uniqueness. */
  uniqueness?: number | null
  /** Constant. */
  constant?: boolean | null
  /** Empty. */
  empty?: boolean | null
  /** Nulls. */
  nulls?: DataAnalysisMetricV1 | null
  /** Blanks. */
  blanks?: DataAnalysisMetricV1 | null
} | null

/** DataAnalysisLimitsV1 wire schema. */
export type DataAnalysisLimitsV1 = {
  /** Max rows. */
  maxRows?: number | null
  /** Sample threshold rows. */
  sampleThresholdRows?: number | null
  /** Actual number of rows in the sample, not an extrapolated count. */
  sampleRows?: number | null
  /** Min group size. */
  minGroupSize?: number | null
} | null

/** DataAnalysisMetricV1 wire schema. */
export type DataAnalysisMetricV1 = {
  /** Key. */
  key?: string | null
  /** Label. */
  label?: string | null
  /** Value. */
  value?: string | number | boolean | Record<string, unknown> | null
  /** Value type. */
  valueType?: 'COUNT' | 'DECIMAL' | 'PERCENT' | 'DATE' | 'DATE_TIME' | 'DURATION' | 'TEXT' | null
  /** Formatted. */
  formatted?: string | null
  /** Open the matching records using this table and QueryFilter; null when suppressed. */
  drill?: DataAnalysisDrillV1 | null
  /** Suppressed. */
  suppressed?: boolean | null
  /** Suppressed reason. */
  suppressedReason?: string | null
} | null

/** DataAnalysisNumericProfileV1 wire schema. */
export type DataAnalysisNumericProfileV1 = {
  /** Metrics. */
  metrics?: Array<DataAnalysisMetricV1> | null
  /** Histogram. */
  histogram?: Array<DataAnalysisValueCountV1> | null
  /** Outliers. */
  outliers?: Array<DataAnalysisValueCountV1> | null
} | null

/** DataAnalysisPointV1 wire schema. */
export type DataAnalysisPointV1 = {
  /** X. */
  x?: string | number | boolean | Record<string, unknown> | null
  /** Y. */
  y?: number | null
  /** Label. */
  label?: string | null
  /** Open the matching records using this table and QueryFilter; null when suppressed. */
  drill?: DataAnalysisDrillV1 | null
} | null

/** DataAnalysisRunStartedV1 wire schema. */
export type DataAnalysisRunStartedV1 = {
  /** Run id. */
  runId?: string | null
  /** Status. */
  status?: string | null
} | null

/** DataAnalysisRunStatusV1 wire schema. */
export type DataAnalysisRunStatusV1 = {
  /** Run id. */
  runId?: string | null
  /** Status. */
  status?: string | null
  /** Error. */
  error?: string | null
  /** Completed column result; null for other operations or unfinished runs. */
  columnProfile?: DataAnalysisColumnProfileV1 | null
  /** Completed table result; null for other operations or unfinished runs. */
  tableProfile?: DataAnalysisTableProfileV1 | null
  /** Started at. */
  startedAt?: string | null
  /** Finished at. */
  finishedAt?: string | null
} | null

/** DataAnalysisSeriesV1 wire schema. */
export type DataAnalysisSeriesV1 = {
  /** Name. */
  name?: string | null
  /** Points. */
  points?: Array<DataAnalysisPointV1> | null
} | null

/** DataAnalysisStartRunRequestV1 wire schema. */
export type DataAnalysisStartRunRequestV1 = {
  /** COLUMN_PROFILE or TABLE_PROFILE. */
  operation: 'COLUMN_PROFILE' | 'TABLE_PROFILE'
  /** Table name. */
  tableName: string
  /** Profile parameters for the selected operation, without tableName. */
  request: DataAnalysisColumnProfileRequestV1 | DataAnalysisTableProfileRequestV1
}

/** DataAnalysisTableProfileRequestV1 wire schema. */
export type DataAnalysisTableProfileRequestV1 = {
  /** Core QueryFilter JSON, identical to the table query and count endpoints. */
  filter?: QueryFilter
  /** Readable fields to include; omit for all analyzable fields on a table profile. */
  fields?: Array<string>
}

/** DataAnalysisTableProfileV1 wire schema. */
export type DataAnalysisTableProfileV1 = {
  /** Table name. */
  tableName?: string | null
  /** Core QueryFilter JSON, identical to the table query and count endpoints. */
  filter?: QueryFilter | null
  /** True when statistics describe a sample rather than the entire filtered population. */
  estimate?: boolean | null
  /** Actual number of rows in the sample, not an extrapolated count. */
  sampleRows?: number | null
  /** True when the row limit prevented a complete scan. */
  truncated?: boolean | null
  /** Number of source rows included in computation. */
  rowsScanned?: number | null
  /** As of. */
  asOf?: string | null
  /** Data version. */
  dataVersion?: string | null
  /** Warnings. */
  warnings?: Array<string> | null
  /** Row count. */
  rowCount?: DataAnalysisMetricV1 | null
  /** Readable fields to include; omit for all analyzable fields on a table profile. */
  fields?: Array<DataAnalysisFieldSummaryV1> | null
  /** Heatmap. */
  heatmap?: DataAnalysisChartV1 | null
  /** Candidate keys. */
  candidateKeys?: Array<DataAnalysisCandidateKeyV1> | null
} | null

/** DataAnalysisTextProfileV1 wire schema. */
export type DataAnalysisTextProfileV1 = {
  /** Metrics. */
  metrics?: Array<DataAnalysisMetricV1> | null
  /** Histogram. */
  histogram?: Array<DataAnalysisValueCountV1> | null
  /** Patterns. */
  patterns?: Array<DataAnalysisValueCountV1> | null
  /** Actual number of rows in the sample, not an extrapolated count. */
  sampleRows?: number | null
} | null

/** DataAnalysisValueCountV1 wire schema. */
export type DataAnalysisValueCountV1 = {
  /** Value. */
  value?: string | number | boolean | Record<string, unknown> | null
  /** Label. */
  label?: string | null
  /** Count. */
  count?: number | null
  /** Share. */
  share?: number | null
  /** Open the matching records using this table and QueryFilter; null when suppressed. */
  drill?: DataAnalysisDrillV1 | null
} | null

/** FilterCriteria wire schema. */
export type FilterCriteria = {
  /** Field name that this criteria applies to */
  fieldName?: string
  /** Logical operator that applies to this criteria */
  operator?:
    | 'EQUALS'
    | 'NOT_EQUALS'
    | 'NOT_EQUALS_OR_IS_NULL'
    | 'IN'
    | 'NOT_IN'
    | 'IS_NULL_OR_IN'
    | 'LIKE'
    | 'NOT_LIKE'
    | 'STARTS_WITH'
    | 'ENDS_WITH'
    | 'CONTAINS'
    | 'NOT_STARTS_WITH'
    | 'NOT_ENDS_WITH'
    | 'NOT_CONTAINS'
    | 'LESS_THAN'
    | 'LESS_THAN_OR_EQUALS'
    | 'GREATER_THAN'
    | 'GREATER_THAN_OR_EQUALS'
    | 'IS_BLANK'
    | 'IS_NOT_BLANK'
    | 'BETWEEN'
    | 'NOT_BETWEEN'
    | 'TRUE'
    | 'FALSE'
  /** Values to apply via the operator to the field */
  values?: Array<string>
}

/** OrderBy wire schema. */
export type OrderBy = {
  /** Field name that this order-by applies to */
  fieldName?: string
  /** Whether this order-by is ascending or descending */
  isAscending?: boolean
}

/** QueryFilter wire schema. */
export type QueryFilter = {
  /** Core filter extensions are allowed by the schema (additionalProperties defaults to true). */
  [key: string]: unknown
  /** Boolean operator to apply between criteria */
  booleanOperator?: 'AND' | 'OR'
  /** Field level criteria that make up the query filter */
  criteria?: Array<FilterCriteria>
  /** Maximum number of results to return. */
  limit?: number
  /** How the query's results should be ordered (sorted). */
  orderBys?: Array<OrderBy>
  /** Records to skip (e.g., to implement pagination) */
  skip?: number
}

/** DataAnalysisPivotCellV1 wire schema (extension 1.1.0). */
export type DataAnalysisPivotCellV1 = {
  /** Zero-based index in rowHeaders. */
  rowIndex?: number
  /** Zero-based index in columnHeaders. */
  columnIndex?: number
  /** Metrics in requested measure order; suppressed metrics have no value or drill. */
  values?: Array<DataAnalysisMetricV1>
}

/** DataAnalysisPivotDimensionV1 wire schema (extension 1.1.0). */
export type DataAnalysisPivotDimensionV1 = {
  /** FULL field name, optionally joinTable.field through an exposed join. */
  field: string
  /** Optional calendar or cyclic bucket in the session timezone. */
  dateBucket?:
    | 'YEAR'
    | 'QUARTER'
    | 'MONTH'
    | 'WEEK'
    | 'DAY'
    | 'HOUR'
    | 'DAY_OF_WEEK'
    | 'HOUR_OF_DAY'
  /** Optional equal-width numeric bins; mutually exclusive with dateBucket. */
  numericBins?: DataAnalysisPivotNumericBinsV1
}

/** DataAnalysisPivotHeaderV1 wire schema (extension 1.1.0). */
export type DataAnalysisPivotHeaderV1 = {
  /** Typed group key; null for a blank group or Other. */
  value?: unknown
  /** Display label, including Other (k groups). */
  label?: string
}

/** DataAnalysisPivotMeasureInfoV1 wire schema (extension 1.1.0). */
export type DataAnalysisPivotMeasureInfoV1 = {
  /** Stable measure key by request position. */
  key?: string
  /** Display label. */
  label?: string
  /** Semantic metric type. */
  valueType?: 'COUNT' | 'DECIMAL' | 'PERCENT' | 'DATE' | 'DATE_TIME' | 'DURATION' | 'TEXT'
}

/** DataAnalysisPivotMeasureV1 wire schema (extension 1.1.0). */
export type DataAnalysisPivotMeasureV1 = {
  /** Aggregate operator. COUNT counts records, including null values. */
  operator: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT_DISTINCT' | 'PERCENTILE'
  /** FULL field to aggregate; optional for COUNT. */
  field?: string
  /** PERCENTILE only: percentile_cont fraction from 0 to 1. */
  percentile?: number
}

/** DataAnalysisPivotNumericBinsV1 wire schema (extension 1.1.0). */
export type DataAnalysisPivotNumericBinsV1 = {
  /** Number of bins, 1–200; defaults to 20. */
  count?: number
  /** Optional explicit lower bound; otherwise a nice enclosing edge. */
  min?: number
  /** Optional explicit upper bound; final interior bin includes this value. */
  max?: number
}

/** DataAnalysisPivotRequestV1 wire schema (extension 1.1.0). */
export type DataAnalysisPivotRequestV1 = {
  /** User query filter, passed through for core enforcement. */
  filter?: QueryFilter
  /** One to three row dimensions. */
  rows: Array<DataAnalysisPivotDimensionV1>
  /** Zero to two column dimensions; defaults to empty. */
  columns?: Array<DataAnalysisPivotDimensionV1>
  /** One to six measures. */
  values: Array<DataAnalysisPivotMeasureV1>
  /** Include row, column and grand totals; defaults to true. */
  showTotals?: boolean
  /** Kept groups per dimension; default 50, maximum 200. */
  limitGroups?: number
}

/** DataAnalysisPivotV1 wire schema (extension 1.1.0). */
export type DataAnalysisPivotV1 = {
  /** Row header tuples in cell-index order. */
  rowHeaders?: Array<Array<DataAnalysisPivotHeaderV1>>
  /** Column header tuples; an empty tuple represents no column dimensions. */
  columnHeaders?: Array<Array<DataAnalysisPivotHeaderV1>>
  /** Measure metadata in request order. */
  measures?: Array<DataAnalysisPivotMeasureInfoV1>
  /** Sparse cells; absent combinations are not materialized. */
  cells?: Array<DataAnalysisPivotCellV1>
  /** Metric tuples aligned with rowHeaders; empty when totals disabled. */
  rowTotals?: Array<Array<DataAnalysisMetricV1>>
  /** Metric tuples aligned with columnHeaders; empty when totals disabled. */
  columnTotals?: Array<Array<DataAnalysisMetricV1>>
  /** Grand-total metrics; empty when totals disabled. */
  grandTotals?: Array<DataAnalysisMetricV1>
  /** Row groups were merged into Other. */
  truncatedRows?: boolean
  /** Column groups were merged into Other. */
  truncatedColumns?: boolean
  /** True when bounded streamed fallback produced a partial result. */
  estimate?: boolean
  /** Privacy, partial-result and joined-drill limitations. */
  warnings?: Array<string>
  /** UTC timestamp of computation. */
  asOf?: string
}

/** DataAnalysisCompareRequestV1 wire schema (extension 1.2.0). */
export type DataAnalysisCompareRequestV1 = {
  /** Population A filter; null selects the whole permitted table. */
  filterA?: QueryFilter | null
  /** Population B filter; null selects the whole permitted table. */
  filterB?: QueryFilter | null
  /** Display name of population A; default A. */
  labelA?: string
  /** Display name of population B; default B. */
  labelB?: string
  /** Distinct FULL fields to analyze; correlation requires 2 to 12 numeric fields. */
  fields: Array<string>
}

/** DataAnalysisCompareV1 wire schema (extension 1.2.0). */
export type DataAnalysisCompareV1 = {
  /** Distinct FULL fields to analyze; correlation requires 2 to 12 numeric fields. */
  fields?: Array<DataAnalysisFieldComparisonV1> | null
}

/** DataAnalysisComparisonSideV1 wire schema (extension 1.2.0). */
export type DataAnalysisComparisonSideV1 = {
  /** Label. */
  label?: string | null
  /** Typed metrics with exact population drills unless privacy suppresses them. */
  metrics?: Array<DataAnalysisMetricV1> | null
}

/** DataAnalysisComparisonValueV1 wire schema (extension 1.2.0). */
export type DataAnalysisComparisonValueV1 = {
  /** Value. */
  value?: unknown
  /** Label. */
  label?: string | null
  /** Side a. */
  sideA?: DataAnalysisComparisonSideV1 | null
  /** Side b. */
  sideB?: DataAnalysisComparisonSideV1 | null
  /** B minus A, in original units (share differences are fractions). */
  delta?: DataAnalysisMetricV1 | null
  /** (B minus A) divided by absolute A, a fraction; null at a zero baseline. */
  percentDelta?: DataAnalysisMetricV1 | null
  /** Test assumptions, two-sided p-value, degrees of freedom and plain-language conclusion. */
  significance?: DataAnalysisSignificanceV1 | null
}

/** DataAnalysisCorrelationCellV1 wire schema (extension 1.2.0). */
export type DataAnalysisCorrelationCellV1 = {
  /** FULL numeric field on the x axis. */
  xField?: string | null
  /** FULL numeric field on the y axis. */
  yField?: string | null
  /** Pairwise non-null population count; null when privacy suppresses it. */
  n?: number | null
  /** Pearson correlation; null for insufficient data, zero variance or privacy suppression. */
  r?: number | null
  /** POST the included parameters to the table scatter endpoint. */
  scatter?: DataAnalysisScatterRequestV1 | null
}

/** DataAnalysisCorrelationRequestV1 wire schema (extension 1.2.0). */
export type DataAnalysisCorrelationRequestV1 = {
  /** Current-user query filter; record locks and core field rules apply. */
  filter?: QueryFilter | null
  /** Distinct FULL fields to analyze; correlation requires 2 to 12 numeric fields. */
  fields: Array<string>
}

/** DataAnalysisCorrelationV1 wire schema (extension 1.2.0). */
export type DataAnalysisCorrelationV1 = {
  /** Distinct FULL fields to analyze; correlation requires 2 to 12 numeric fields. */
  fields?: Array<string> | null
  /** Cells. */
  cells?: Array<DataAnalysisCorrelationCellV1> | null
  /** Semantic series; category comparisons are grouped and category time series are stacked. */
  chart?: DataAnalysisChartV1 | null
}

/** DataAnalysisCrosstabCellV1 wire schema (extension 1.2.0). */
export type DataAnalysisCrosstabCellV1 = {
  /** Row index. */
  rowIndex?: number | null
  /** Column index. */
  columnIndex?: number | null
  /** Cell count with its exact drill, or a suppressed metric. */
  count?: DataAnalysisMetricV1 | null
  /** Cell count divided by row total; suppressed if it could disclose a hidden cell. */
  rowShare?: DataAnalysisMetricV1 | null
  /** Cell count divided by column total; suppressed if it could disclose a hidden cell. */
  columnShare?: DataAnalysisMetricV1 | null
}

/** DataAnalysisCrosstabRequestV1 wire schema (extension 1.2.0). */
export type DataAnalysisCrosstabRequestV1 = {
  /** Current-user query filter; record locks and core field rules apply. */
  filter?: QueryFilter | null
  /** FULL field defining crosstab rows. */
  rowField: string
  /** FULL field defining crosstab columns. */
  columnField: string
  /** Maximum sample points (1 to 2000, default 2000) or kept crosstab categories per axis (1 to 20, default 20). */
  limit?: number
}

/** DataAnalysisCrosstabV1 wire schema (extension 1.2.0). */
export type DataAnalysisCrosstabV1 = {
  /** Rows. */
  rows?: Array<DataAnalysisPivotHeaderV1> | null
  /** Columns. */
  columns?: Array<DataAnalysisPivotHeaderV1> | null
  /** Cells. */
  cells?: Array<DataAnalysisCrosstabCellV1> | null
  /** Test assumptions, two-sided p-value, degrees of freedom and plain-language conclusion. */
  significance?: DataAnalysisSignificanceV1 | null
}

/** DataAnalysisFieldComparisonV1 wire schema (extension 1.2.0). */
export type DataAnalysisFieldComparisonV1 = {
  /** FULL field whose distribution is compared over time. */
  field?: string | null
  /** Values. */
  values?: Array<DataAnalysisComparisonValueV1> | null
  /** Test assumptions, two-sided p-value, degrees of freedom and plain-language conclusion. */
  significance?: DataAnalysisSignificanceV1 | null
  /** Semantic series; category comparisons are grouped and category time series are stacked. */
  chart?: DataAnalysisChartV1 | null
}

/** DataAnalysisScatterRequestV1 wire schema (extension 1.2.0). */
export type DataAnalysisScatterRequestV1 = {
  /** Table for the scatter link; route parameter takes precedence. */
  tableName?: string | null
  /** Compatibility flag; scatter always returns the bounded sample. */
  exact?: boolean | null
  /** Current-user query filter; record locks and core field rules apply. */
  filter?: QueryFilter | null
  /** FULL numeric field on the x axis. */
  xField: string
  /** FULL numeric field on the y axis. */
  yField: string
  /** Maximum sample points (1 to 2000, default 2000) or kept crosstab categories per axis (1 to 20, default 20). */
  limit?: number
}

/** DataAnalysisScatterV1 wire schema (extension 1.2.0). */
export type DataAnalysisScatterV1 = {
  /** Pairwise non-null population count; null when privacy suppresses it. */
  n?: number | null
  /** Number of displayed paired records. */
  sampleSize?: number | null
  /** Sampling method; core query currently uses a deterministic primary-key prefix. */
  sampling?: string | null
  /** Points. */
  points?: Array<DataAnalysisPointV1> | null
  /** Least-squares slope, intercept and r fitted to the displayed sample. */
  trend?: DataAnalysisTrendLineV1 | null
  /** Semantic series; category comparisons are grouped and category time series are stacked. */
  chart?: DataAnalysisChartV1 | null
}

/** DataAnalysisShiftBucketV1 wire schema (extension 1.2.0). */
export type DataAnalysisShiftBucketV1 = {
  /** Value. */
  value?: unknown
  /** Label. */
  label?: string | null
  /** True when the calendar bucket end has passed in the session timezone. */
  complete?: boolean | null
  /** Typed metrics with exact population drills unless privacy suppresses them. */
  metrics?: Array<DataAnalysisMetricV1> | null
}

/** DataAnalysisShiftRequestV1 wire schema (extension 1.2.0). */
export type DataAnalysisShiftRequestV1 = {
  /** Current-user query filter; record locks and core field rules apply. */
  filter?: QueryFilter | null
  /** FULL field whose distribution is compared over time. */
  field: string
  /** FULL DATE or DATE_TIME field for session-timezone calendar buckets. */
  dateField: string
  /** Calendar unit: HOUR, DAY, WEEK, MONTH, QUARTER or YEAR; default MONTH. */
  bucket?: string
}

/** DataAnalysisShiftV1 wire schema (extension 1.2.0). */
export type DataAnalysisShiftV1 = {
  /** Buckets. */
  buckets?: Array<DataAnalysisShiftBucketV1> | null
  /** Population stability index, null when inapplicable; zero shares are floored at 0.000001. */
  psi?: DataAnalysisMetricV1 | null
  /** Plain-language result or reason the statistic is not applicable. */
  sentence?: string | null
  /** Semantic series; category comparisons are grouped and category time series are stacked. */
  chart?: DataAnalysisChartV1 | null
}

/** DataAnalysisSignificanceV1 wire schema (extension 1.2.0). */
export type DataAnalysisSignificanceV1 = {
  /** Test. */
  test?: string | null
  /** Statistic. */
  statistic?: number | null
  /** Degrees of freedom; null when undefined. */
  df?: number | null
  /** Two-sided p-value; p >= 0.05 is never significant. */
  pValue?: number | null
  /** Whether all test validity and privacy requirements hold. */
  applicable?: boolean | null
  /** Plain-language result or reason the statistic is not applicable. */
  sentence?: string | null
  /** Cramer association strength computed on the pooled contingency table; null when invalid. */
  cramersV?: number | null
}

/** DataAnalysisTrendLineV1 wire schema (extension 1.2.0). */
export type DataAnalysisTrendLineV1 = {
  /** Slope. */
  slope?: number | null
  /** Intercept. */
  intercept?: number | null
  /** Pearson correlation; null for insufficient data, zero variance or privacy suppression. */
  r?: number | null
}

/** DataAnalysisSavedEntryV1 wire schema (extension 1.4.0). */
export type DataAnalysisSavedEntryV1 = {
  id?: number
  name?: string
  kind?: string
  tableName?: string
  tableLabel?: string
  owner?: string
  updated?: string | null
  shared?: boolean
  starred?: boolean
}

/** DataAnalysisSavedListV1 wire schema (extension 1.4.0). */
export type DataAnalysisSavedListV1 = {
  analyses?: Array<DataAnalysisSavedEntryV1>
}

/** DataAnalysisSavedResultV1 wire schema (extension 1.4.0). */
export type DataAnalysisSavedResultV1 = {
  kind?:
    | 'COLUMN_PROFILE'
    | 'TABLE_PROFILE'
    | 'PIVOT'
    | 'COMPARE'
    | 'CORRELATION'
    | 'CROSSTAB'
    | 'SHIFT'
  warnings?: Array<string>
  columnProfile?: DataAnalysisColumnProfileV1 | null
  compare?: DataAnalysisCompareV1 | null
  correlation?: DataAnalysisCorrelationV1 | null
  crosstab?: DataAnalysisCrosstabV1 | null
  pivot?: DataAnalysisPivotV1 | null
  shift?: DataAnalysisShiftV1 | null
  tableProfile?: DataAnalysisTableProfileV1 | null
}

/** DataAnalysisSqlV1 wire schema (extension 1.4.0). */
export type DataAnalysisSqlV1 = {
  available?: boolean
  note?: string
  sql?: string | null
}

/** DataAnalysisStarV1 wire schema (extension 1.4.0). */
export type DataAnalysisStarV1 = {
  starred?: boolean
}

/** DataAnalysisWatchBucketV1 wire schema (extension 1.4.0). */
export type DataAnalysisWatchBucketV1 = {
  start?: string
  value?: number | null
  categories?: Array<string>
  drill?: DataAnalysisDrillV1 | null
}

/** DataAnalysisWatchPreviewV1 wire schema (extension 1.4.0). */
export type DataAnalysisWatchPreviewV1 = {
  series?: Array<DataAnalysisWatchBucketV1>
  chart?: DataAnalysisChartV1
  verdict?: DataAnalysisWatchVerdictV1
}

/** DataAnalysisWatchVerdictV1 wire schema (extension 1.4.0). */
export type DataAnalysisWatchVerdictV1 = {
  evaluated?: boolean
  firing?: boolean
  value?: number | null
  baseline?: number | null
  baselineLow?: number | null
  baselineHigh?: number | null
  message?: string
  drill?: DataAnalysisDrillV1 | null
}

/** Typed operation shared by saved records, exports and SQL. */
export type AnalysisDefinition =
  | { kind: 'COLUMN_PROFILE'; request: DataAnalysisColumnProfileRequestV1 }
  | { kind: 'TABLE_PROFILE'; request: DataAnalysisTableProfileRequestV1 }
  | { kind: 'PIVOT'; request: DataAnalysisPivotRequestV1 }
  | { kind: 'COMPARE'; request: DataAnalysisCompareRequestV1 }
  | { kind: 'CORRELATION'; request: DataAnalysisCorrelationRequestV1 }
  | { kind: 'CROSSTAB'; request: DataAnalysisCrosstabRequestV1 }
  | { kind: 'SHIFT'; request: DataAnalysisShiftRequestV1 }
/** Export/SQL operation envelope. */
export type DataAnalysisSavedRequestV1 = AnalysisDefinition & {
  tableName?: string
  format?: 'csv' | 'xlsx'
}
