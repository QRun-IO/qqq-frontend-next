/** Saved analysis and watch 1.4.0 fixtures. */
import type {
  AnalysisDefinition,
  DataAnalysisSavedResultV1,
  DataAnalysisWatchPreviewV1,
} from '../../src/types/data-analysis'
import { column, table, pivotRequest, pivotResult, dateColumn } from './data-analysis'
import {
  compareResult,
  correlationResult,
  crosstabResult,
  shiftResult,
} from './data-analysis-compare'
export const savedCases: {
  definition: AnalysisDefinition
  result: DataAnalysisSavedResultV1
  text: string
}[] = [
  {
    definition: {
      kind: 'COLUMN_PROFILE',
      request: { fieldName: 'status', filter: { criteria: [] } },
    },
    result: { kind: 'COLUMN_PROFILE', columnProfile: column },
    text: 'Top values',
  },
  {
    definition: { kind: 'TABLE_PROFILE', request: { filter: { criteria: [] } } },
    result: { kind: 'TABLE_PROFILE', tableProfile: table },
    text: 'Candidate keys',
  },
  {
    definition: { kind: 'PIVOT', request: pivotRequest },
    result: { kind: 'PIVOT', pivot: pivotResult },
    text: 'Grand total',
  },
  {
    definition: {
      kind: 'COMPARE',
      request: {
        fields: ['amount'],
        filterA: { criteria: [{ fieldName: 'status', operator: 'EQUALS', values: ['Active'] }] },
        filterB: null,
        labelA: 'Current query',
        labelB: 'Whole table',
      },
    },
    result: { kind: 'COMPARE', compare: compareResult },
    text: 'Current query',
  },
  {
    definition: { kind: 'CORRELATION', request: { fields: ['id', 'amount'], filter: {} } },
    result: { kind: 'CORRELATION', correlation: correlationResult },
    text: 'Show as table',
  },
  {
    definition: {
      kind: 'CROSSTAB',
      request: { rowField: 'status', columnField: 'firstName', filter: {} },
    },
    result: { kind: 'CROSSTAB', crosstab: crosstabResult },
    text: 'Row %',
  },
  {
    definition: {
      kind: 'SHIFT',
      request: { field: 'amount', dateField: 'createdAt', bucket: 'MONTH', filter: {} },
    },
    result: { kind: 'SHIFT', shift: shiftResult },
    text: 'Population stability index:',
  },
]
export const watchPreview: DataAnalysisWatchPreviewV1 = {
  series: [
    { start: '2026-01-01', value: 10 },
    { start: '2026-02-01', value: 12 },
  ],
  chart: {
    ...dateColumn.chart,
    series: [
      {
        name: 'Count',
        points: [
          { x: '2026-01-01', y: 10 },
          { x: '2026-02-01', y: 12 },
        ],
      },
    ],
    annotations: ['Baseline band: 8 to 14.'],
  },
  verdict: {
    evaluated: true,
    firing: false,
    baseline: 11,
    baselineLow: 8,
    baselineHigh: 14,
    message: 'Count is within the baseline band.',
  },
}
