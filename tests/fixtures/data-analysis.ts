/** Realistic v1 wire fixtures shared by unit and mocked browser tests. */
import type {
  DataAnalysisCapabilitiesV1,
  DataAnalysisColumnProfileV1,
  DataAnalysisTableProfileV1,
  DataAnalysisDistinctValuesPageV1,
  DataAnalysisDuplicatesResultV1,
} from '../../src/types/data-analysis'

export const activeDrill = {
  tableName: 'person',
  filter: {
    booleanOperator: 'AND' as const,
    criteria: [{ fieldName: 'status', operator: 'EQUALS' as const, values: ['active'] }],
  },
}
export const capabilities = {
  tableName: 'person',
  tableLabel: 'People',
  canAnalyze: true,
  fields: [
    { name: 'status', label: 'Status', type: 'STRING', kind: 'CATEGORY', defaultChartKind: 'BAR' },
    { name: 'id', label: 'ID', type: 'INTEGER', kind: 'NUMERIC', defaultChartKind: 'HISTOGRAM' },
  ],
  limits: { maxRows: 1000000, sampleThresholdRows: 1000000, sampleRows: 100000, minGroupSize: 5 },
  backendCapabilities: ['COUNT_DISTINCT', 'PERCENTILE'],
  sqlWorkbenchAvailable: false,
} satisfies NonNullable<DataAnalysisCapabilitiesV1>

export const column = {
  tableName: 'person',
  fieldName: 'status',
  fieldLabel: 'Status',
  fieldType: 'STRING',
  filter: { criteria: [], booleanOperator: 'AND' },
  estimate: true,
  sampleRows: 1000,
  rowsScanned: 1000,
  truncated: false,
  asOf: '2026-10-13T15:00:00Z',
  dataVersion: '42',
  warnings: ['Statistics describe a sample of 1,000 rows.'],
  counts: [
    {
      key: 'rows',
      label: 'Rows',
      value: 1000,
      valueType: 'COUNT',
      formatted: '1,000',
      drill: { tableName: 'person', filter: { criteria: [], booleanOperator: 'AND' } },
      suppressed: false,
    },
    {
      key: 'nonNull',
      label: 'Non-null rows',
      value: 998,
      valueType: 'COUNT',
      formatted: '998',
      drill: {
        tableName: 'person',
        filter: {
          criteria: [{ fieldName: 'status', operator: 'IS_NOT_BLANK', values: [] }],
          booleanOperator: 'AND',
        },
      },
      suppressed: false,
    },
    {
      key: 'distinct',
      label: 'Distinct values',
      value: 3,
      valueType: 'COUNT',
      formatted: '3',
      drill: null,
      suppressed: false,
    },
    {
      key: 'nulls',
      label: 'Nulls',
      value: null,
      valueType: 'COUNT',
      formatted: null,
      drill: null,
      suppressed: true,
      suppressedReason: 'Hidden: fewer than 5 records',
    },
  ],
  numeric: null,
  dates: null,
  text: null,
  booleans: null,
  topValues: [
    { value: 'active', label: 'Active', count: 800, share: 0.8, drill: activeDrill },
    {
      value: 'inactive',
      label: 'Inactive',
      count: 198,
      share: 0.198,
      drill: {
        tableName: 'person',
        filter: {
          booleanOperator: 'AND',
          criteria: [{ fieldName: 'status', operator: 'EQUALS', values: ['inactive'] }],
        },
      },
    },
    { value: null, label: 'Other', count: null, share: null, drill: null },
  ],
  chart: {
    kind: 'BAR',
    alternatives: ['PARETO'],
    x: { field: 'status', label: 'Status', valueType: 'TEXT' },
    y: { label: 'Rows', valueType: 'COUNT' },
    series: [
      {
        name: 'Status distribution',
        points: [
          { x: 'active', y: 800, label: 'Active', drill: activeDrill },
          { x: 'inactive', y: 198, label: 'Inactive', drill: null },
        ],
      },
    ],
    annotations: ['Groups smaller than five records are hidden.'],
  },
} satisfies NonNullable<DataAnalysisColumnProfileV1>

export const exactColumn = {
  ...column,
  estimate: false,
  sampleRows: null,
  rowsScanned: 12500,
  asOf: '2026-10-13T15:01:00Z',
  warnings: [],
  counts: [
    { ...column.counts[0], value: 12500, formatted: '12,500' },
    { ...column.counts[1], value: 12498, formatted: '12,498' },
    ...column.counts.slice(2),
  ],
  topValues: [
    { ...column.topValues[0], count: 10000, share: 0.8 },
    { ...column.topValues[1], count: 2498, share: 0.19984 },
    column.topValues[2],
  ],
  chart: {
    ...column.chart,
    series: [
      {
        name: 'Status distribution',
        points: [
          { x: 'active', y: 10000, label: 'Active', drill: activeDrill },
          { x: 'inactive', y: 2498, label: 'Inactive', drill: null },
        ],
      },
    ],
  },
} satisfies NonNullable<DataAnalysisColumnProfileV1>

export const numericColumn = {
  ...column,
  fieldName: 'id',
  fieldLabel: 'ID',
  fieldType: 'INTEGER',
  numeric: {
    metrics: [
      { key: 'min', label: 'Minimum', value: 1, valueType: 'DECIMAL' },
      { key: 'p25', label: '25th percentile', value: 250, valueType: 'DECIMAL' },
      { key: 'p50', label: 'Median', value: 500, valueType: 'DECIMAL' },
      { key: 'p75', label: '75th percentile', value: 750, valueType: 'DECIMAL' },
      { key: 'max', label: 'Maximum', value: 1000, valueType: 'DECIMAL' },
    ],
    histogram: [],
    outliers: [],
  },
  chart: { ...column.chart, kind: 'HISTOGRAM', alternatives: ['BOX'] },
} satisfies NonNullable<DataAnalysisColumnProfileV1>

export const table = {
  tableName: 'person',
  filter: { criteria: [], booleanOperator: 'AND' },
  estimate: false,
  rowsScanned: 1000,
  asOf: '2026-10-13T15:00:00Z',
  warnings: [],
  rowCount: column.counts[0],
  fields: [
    {
      field: 'id',
      label: 'ID',
      type: 'INTEGER',
      completeness: 1,
      distinct: 1000,
      uniqueness: 1,
      constant: false,
      empty: false,
      nulls: { key: 'nulls', label: 'Nulls', value: 0, valueType: 'COUNT' },
      blanks: null,
    },
    {
      field: 'status',
      label: 'Status',
      type: 'STRING',
      completeness: 0.998,
      distinct: 3,
      uniqueness: 0.003,
      constant: false,
      empty: false,
      nulls: column.counts[3],
      blanks: null,
    },
  ],
  heatmap: {
    kind: 'HEATMAP',
    alternatives: ['BAR'],
    x: { label: 'Field', valueType: 'TEXT' },
    y: { label: 'Completeness', valueType: 'PERCENT' },
    series: [
      {
        name: 'Completeness',
        points: [
          { x: 'id', label: 'ID', y: 1, drill: null },
          { x: 'status', label: 'Status', y: 0.998, drill: null },
        ],
      },
    ],
  },
  candidateKeys: [{ fields: ['id'], rowCount: 1000, drill: column.counts[0].drill }],
} satisfies NonNullable<DataAnalysisTableProfileV1>

export const distinctPage = {
  tableName: 'person',
  fieldName: 'status',
  page: 0,
  pageSize: 50,
  totalDistinct: 52,
  hasMore: true,
  estimate: false,
  values: [column.topValues[0]],
} satisfies NonNullable<DataAnalysisDistinctValuesPageV1>
export const duplicatesResult = {
  tableName: 'person',
  fields: ['status'],
  estimate: false,
  groups: [column.topValues[0]],
} satisfies NonNullable<DataAnalysisDuplicatesResultV1>
