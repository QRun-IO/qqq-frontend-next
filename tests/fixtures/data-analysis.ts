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
    {
      key: 'completeness',
      label: 'Completeness',
      value: 0.988,
      valueType: 'PERCENT',
      formatted: '98.8%',
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
      { key: 'min', label: 'Minimum', value: 60000, valueType: 'DECIMAL', formatted: '$60,000.00' },
      {
        key: 'p25',
        label: '25th percentile',
        value: 65000,
        valueType: 'DECIMAL',
        formatted: '$65,000.00',
      },
      {
        key: 'p50',
        label: 'Median',
        value: 81753.32,
        valueType: 'DECIMAL',
        formatted: '$81,753.32',
      },
      {
        key: 'p75',
        label: '75th percentile',
        value: 95000,
        valueType: 'DECIMAL',
        formatted: '$95,000.00',
      },
      {
        key: 'max',
        label: 'Maximum',
        value: 100000,
        valueType: 'DECIMAL',
        formatted: '$100,000.00',
      },
      {
        key: 'stddev',
        label: 'Standard deviation',
        value: 12498,
        valueType: 'DECIMAL',
        formatted: '12,498',
      },
    ],
    histogram: [],
    outliers: [],
  },
  chart: {
    ...column.chart,
    kind: 'HISTOGRAM',
    alternatives: ['BOX'],
    series: [
      {
        name: 'Count',
        points: Array.from({ length: 12 }, (_, i) => ({
          x: 60000 + i * 5000,
          label: `${(60000 + i * 5000).toLocaleString('en-US')} – ${(65000 + i * 5000).toLocaleString('en-US')}`,
          y: (i + 1) * 10,
        })),
      },
    ],
  },
} satisfies NonNullable<DataAnalysisColumnProfileV1>

const yearlyPoints = Array.from({ length: 40 }, (_, i) => ({
  x: `${1969 + i}-01-01`,
  label: String(1969 + i),
  y: (i + 1) * 10,
}))

export const dateColumn = {
  ...column,
  fieldName: 'birthDate',
  fieldLabel: 'Birth date',
  fieldType: 'DATE',
  dates: {
    metrics: [
      { key: 'min', label: 'Earliest', value: '1969-01-01', valueType: 'DATE', formatted: '1969' },
    ],
  },
  chart: {
    kind: 'TIME_SERIES',
    alternatives: ['BAR'],
    x: { label: 'Year', valueType: 'TEXT' },
    y: { label: 'Count', valueType: 'COUNT' },
    series: [
      { name: 'Count', points: yearlyPoints },
      {
        name: '7-bucket moving average',
        points: yearlyPoints.map((point, i) => ({
          ...point,
          y:
            yearlyPoints.slice(Math.max(0, i - 6), i + 1).reduce((sum, p) => sum + p.y, 0) /
            Math.min(7, i + 1),
        })),
      },
    ],
  },
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
      nulls: { key: 'nulls', label: 'Nulls', value: 0, valueType: 'COUNT', formatted: '0' },
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
      nulls: { key: 'nulls', label: 'Nulls', value: 51, valueType: 'COUNT', formatted: '51' },
      blanks: { key: 'blanks', label: 'Blanks', value: 51, valueType: 'COUNT', formatted: '51' },
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

/** Pivot fixtures use only capability-advertised local fields. */
export const pivotCapabilities = {
  ...capabilities,
  fields: [
    ...capabilities.fields,
    { name: 'createdAt', label: 'Created at', type: 'DATE_TIME', kind: 'DATE_TIME' },
    { name: 'amount', label: 'Amount', type: 'DECIMAL', kind: 'NUMERIC' },
  ],
} satisfies NonNullable<DataAnalysisCapabilitiesV1>

export const pivotRequest = {
  rows: [{ field: 'status' }],
  columns: [{ field: 'createdAt', dateBucket: 'MONTH' }],
  values: [{ operator: 'COUNT' }, { operator: 'AVG', field: 'amount' }],
  showTotals: true,
} satisfies import('../../src/types/data-analysis').DataAnalysisPivotRequestV1

const januaryDrill = {
  tableName: 'person',
  filter: {
    booleanOperator: 'AND' as const,
    criteria: [
      ...activeDrill.filter.criteria,
      {
        fieldName: 'createdAt',
        operator: 'GREATER_THAN_OR_EQUALS' as const,
        values: ['2026-01-01T00:00:00Z'],
      },
      { fieldName: 'createdAt', operator: 'LESS_THAN' as const, values: ['2026-02-01T00:00:00Z'] },
    ],
  },
}
const hiddenPivotMetric = {
  suppressed: true,
  suppressedReason: 'Fewer than 5 records',
  value: null,
  formatted: null,
  drill: null,
}
export const pivotResult = {
  rowHeaders: [
    [{ value: 'active', label: 'Active' }],
    [{ value: null, label: 'Other (3 groups)' }],
  ],
  columnHeaders: [
    [{ value: '2026-01-01T00:00:00Z', label: 'January 2026' }],
    [{ value: '2026-02-01T00:00:00Z', label: 'February 2026' }],
  ],
  measures: [
    { key: 'm0', label: 'Count', valueType: 'COUNT' },
    { key: 'm1', label: 'Average Amount', valueType: 'DECIMAL' },
  ],
  cells: [
    {
      rowIndex: 0,
      columnIndex: 0,
      values: [
        { value: 6, formatted: '6', valueType: 'COUNT', drill: januaryDrill },
        { value: 125.5, formatted: '125.50', valueType: 'DECIMAL', drill: januaryDrill },
      ],
    },
    {
      rowIndex: 0,
      columnIndex: 1,
      values: [
        {
          value: 8,
          formatted: '8',
          valueType: 'COUNT',
          drill: {
            ...januaryDrill,
            filter: {
              ...januaryDrill.filter,
              criteria: [
                activeDrill.filter.criteria[0],
                {
                  fieldName: 'createdAt',
                  operator: 'BETWEEN',
                  values: ['2026-02-01T00:00:00Z', '2026-02-28T23:59:59Z'],
                },
              ],
            },
          },
        },
        { value: 80, formatted: '80.00', valueType: 'DECIMAL', drill: null },
      ],
    },
    { rowIndex: 1, columnIndex: 0, values: [hiddenPivotMetric, hiddenPivotMetric] },
  ],
  rowTotals: [
    [
      { value: 14, formatted: '14', valueType: 'COUNT', drill: activeDrill },
      { value: 99.5, formatted: '99.50', valueType: 'DECIMAL', drill: activeDrill },
    ],
    [hiddenPivotMetric, hiddenPivotMetric],
  ],
  columnTotals: [
    [hiddenPivotMetric, hiddenPivotMetric],
    [hiddenPivotMetric, hiddenPivotMetric],
  ],
  grandTotals: [hiddenPivotMetric, hiddenPivotMetric],
  truncatedRows: true,
  truncatedColumns: false,
  estimate: false,
  warnings: [
    'Small groups and their dependent totals are hidden. Remaining groups are merged into Other.',
  ],
  asOf: '2026-10-13T15:00:00Z',
} satisfies import('../../src/types/data-analysis').DataAnalysisPivotV1
