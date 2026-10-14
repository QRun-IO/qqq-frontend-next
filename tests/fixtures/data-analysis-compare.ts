/** Phase (d) wire fixtures, including null and privacy-suppressed results. */
import type {
  DataAnalysisCapabilitiesV1,
  DataAnalysisCompareV1,
  DataAnalysisCorrelationV1,
  DataAnalysisCrosstabV1,
  DataAnalysisMetricV1,
  DataAnalysisScatterV1,
  DataAnalysisShiftV1,
} from '../../src/types/data-analysis'
import { activeDrill } from './data-analysis'

export const relationshipCapabilities = {
  canAnalyze: true,
  tableName: 'person',
  tableLabel: 'People',
  fields: [
    { name: 'status', label: 'Status', kind: 'CATEGORY', type: 'STRING' },
    { name: 'firstName', label: 'First name', kind: 'TEXT', type: 'STRING' },
    { name: 'id', label: 'ID', kind: 'NUMERIC', type: 'INTEGER' },
    { name: 'amount', label: 'Amount', kind: 'NUMERIC', type: 'DECIMAL' },
    { name: 'createdAt', label: 'Created at', kind: 'DATE_TIME', type: 'DATE_TIME' },
  ],
} satisfies DataAnalysisCapabilitiesV1
const metric = (
  key: string,
  value: number,
  formatted = String(value)
): NonNullable<DataAnalysisMetricV1> => ({
  key,
  label: key,
  value,
  formatted,
  drill: activeDrill,
  valueType: 'DECIMAL',
})
export const hiddenMetric = {
  key: 'count',
  label: 'Count',
  value: null,
  formatted: null,
  suppressed: true,
  suppressedReason: 'Fewer than 5 records',
  drill: null,
} satisfies DataAnalysisMetricV1
const numericSide = (label: string, offset: number) => ({
  label,
  metrics: ['count', 'mean', 'min', 'p25', 'median', 'p75', 'max'].map((key, i) =>
    metric(key, offset + i * 10)
  ),
})
const sides = [numericSide('Current query', 10), numericSide('Whole table', 20)]
export const compareResult = {
  fields: [
    {
      field: 'status',
      significance: {
        test: 'Chi-square',
        applicable: true,
        pValue: 0.003,
        sentence: 'A and B differ (p = 0.003).',
      },
      values: [
        {
          label: 'Active',
          sideA: {
            label: 'Current query',
            metrics: [metric('Count', 40), metric('Share', 0.4, '40%')],
          },
          sideB: {
            label: 'Whole table',
            metrics: [metric('Count', 60), metric('Share', 0.6, '60%')],
          },
          delta: metric('delta', 0.2, '0.20'),
          percentDelta: metric('percentDelta', 0.5, '50%'),
          significance: {
            test: 'Two-proportion z-test',
            applicable: true,
            pValue: 0.05,
            sentence: 'No significant difference.',
          },
        },
        {
          label: 'Hidden group',
          sideA: { label: 'Current query', metrics: [hiddenMetric] },
          sideB: { label: 'Whole table', metrics: [hiddenMetric] },
          significance: {
            test: 'Two-proportion z-test',
            applicable: false,
            pValue: null,
            sentence: 'Not applicable: privacy guard.',
          },
        },
      ],
      chart: {
        kind: 'BAR',
        series: [
          {
            name: 'Current query',
            points: [{ x: 'active', label: 'Active', y: 40, drill: activeDrill }],
          },
          {
            name: 'Whole table',
            points: [{ x: 'active', label: 'Active', y: 60, drill: activeDrill }],
          },
        ],
      },
    },
    {
      field: 'amount',
      significance: {
        test: "Welch's t-test",
        applicable: true,
        pValue: 0.12,
        sentence: 'No significant difference in means.',
      },
      values: [
        {
          sideA: sides[0],
          sideB: sides[1],
          delta: metric('delta', 10),
          percentDelta: metric('percentDelta', 0.5, '50%'),
        },
      ],
      chart: {
        kind: 'BOX',
        series: sides.map((s) => ({
          name: s.label,
          points: s.metrics
            .slice(2)
            .map((m) => ({ x: m.key, label: m.label, y: m.value as number, drill: m.drill })),
        })),
      },
    },
  ],
} satisfies DataAnalysisCompareV1
export const correlationResult = {
  fields: ['id', 'amount'],
  cells: [
    {
      xField: 'id',
      yField: 'id',
      n: 100,
      r: 1,
      scatter: { xField: 'id', yField: 'id', filter: activeDrill.filter },
    },
    {
      xField: 'amount',
      yField: 'id',
      n: 100,
      r: -0.75,
      scatter: { xField: 'amount', yField: 'id', filter: activeDrill.filter },
    },
    {
      xField: 'id',
      yField: 'amount',
      n: 100,
      r: -0.75,
      scatter: { xField: 'id', yField: 'amount', filter: activeDrill.filter },
    },
    { xField: 'amount', yField: 'amount', n: null, r: null, scatter: null },
  ],
} satisfies DataAnalysisCorrelationV1
export const scatterResult = {
  n: 100,
  sampleSize: 2,
  sampling: 'Primary-key prefix',
  trend: { slope: -1, intercept: 40, r: -0.75 },
  points: [
    { x: 10, y: 30, drill: activeDrill },
    { x: 20, y: 20, drill: activeDrill },
  ],
  chart: {
    kind: 'SCATTER',
    x: { label: 'Amount' },
    y: { label: 'ID' },
    series: [
      {
        name: 'Sample',
        points: [
          { x: 10, y: 30, drill: activeDrill },
          { x: 20, y: 20, drill: activeDrill },
        ],
      },
      {
        name: 'Least-squares trend',
        points: [
          { x: 10, y: 30 },
          { x: 20, y: 20 },
        ],
      },
    ],
    annotations: ['Trend describes the displayed sample, not the full population.'],
  },
} satisfies DataAnalysisScatterV1
export const crosstabResult = {
  rows: [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ],
  columns: [
    { value: 'Alex', label: 'Alex' },
    { value: 'Other', label: 'Other' },
  ],
  cells: [
    {
      rowIndex: 0,
      columnIndex: 0,
      count: metric('Count', 42),
      rowShare: metric('rowShare', 0.6, '60%'),
      columnShare: metric('columnShare', 0.7, '70%'),
    },
    {
      rowIndex: 0,
      columnIndex: 1,
      count: hiddenMetric,
      rowShare: hiddenMetric,
      columnShare: hiddenMetric,
    },
  ],
  significance: {
    test: 'Chi-square independence',
    applicable: true,
    pValue: 0.01,
    sentence: 'Status and First name are associated (p = 0.01).',
    cramersV: 0.32,
  },
} satisfies DataAnalysisCrosstabV1
export const shiftResult = {
  sentence: 'The distribution shifted between the first and last bucket (PSI = 0.18).',
  psi: metric('PSI', 0.18, '0.18'),
  buckets: [
    {
      value: '2026-01-01',
      label: 'January 2026',
      complete: true,
      metrics: [metric('Active share', 0.4, '40%')],
    },
    {
      value: '2026-02-01',
      label: 'February 2026',
      complete: false,
      metrics: [metric('Active share', 0.6, '60%')],
    },
  ],
  chart: {
    kind: 'TIME_SERIES',
    x: { label: 'Month' },
    y: { label: 'Share' },
    series: [
      {
        name: 'Active',
        points: [
          { x: '2026-01-01', label: 'January 2026', y: 0.4, drill: activeDrill },
          { x: '2026-02-01', label: 'February 2026', y: 0.6, drill: activeDrill },
        ],
      },
      {
        name: 'Inactive',
        points: [
          { x: '2026-01-01', label: 'January 2026', y: 0.6, drill: activeDrill },
          { x: '2026-02-01', label: 'February 2026', y: 0.4, drill: activeDrill },
        ],
      },
    ],
  },
} satisfies DataAnalysisShiftV1
