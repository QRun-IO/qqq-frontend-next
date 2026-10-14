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

/** @file Capability-driven pivot dimension and measure builder. */
'use client'
import type {
  DataAnalysisCapabilityFieldV1,
  DataAnalysisPivotDimensionV1,
  DataAnalysisPivotMeasureV1,
} from '@/types/data-analysis'
import { DATE_BUCKETS, PIVOT_OPERATORS, type PivotLayout } from '@/lib/utils/data-analysis-pivot'
import { controlClass } from './ProfileParts'

/** Accessible native controls for a pivot layout.
 * @param props - Draft state and readable capability fields.
 * @returns Wrapping builder fieldsets.
 */
export default function PivotBuilder({
  value,
  onChange,
  fields,
}: {
  value: PivotLayout
  onChange: (value: PivotLayout) => void
  fields: DataAnalysisCapabilityFieldV1[]
}) {
  const options = fields
    .filter((f) => f?.name)
    .map((f) => (
      <option key={f!.name} value={f!.name!}>
        {f!.label ?? 'Unlabeled field'}
      </option>
    ))
  const selectClass = `${controlClass} block w-full min-w-0 max-w-full`
  const dimensions = (axis: 'rows' | 'columns', limit: number) => {
    const items = value[axis] ?? []
    const title = axis === 'rows' ? 'Rows' : 'Columns'
    const update = (index: number, dimension: DataAnalysisPivotDimensionV1) =>
      onChange({ ...value, [axis]: items.map((d, i) => (i === index ? dimension : d)) })
    return (
      <fieldset className="min-w-0 space-y-3 rounded border border-border p-3">
        <legend className="px-1 font-semibold">{title}</legend>
        {items.map((d, i) => {
          const kind = fields.find((f) => f?.name === d.field)?.kind
          const label = `${title} ${i + 1}`
          return (
            <div key={i} className="flex min-w-0 flex-wrap items-end gap-2">
              <label className="min-w-0 flex-1 basis-40">
                {label} field
                <select
                  className={selectClass}
                  value={d.field}
                  onChange={(e) => update(i, { field: e.target.value })}
                  data-qqq-id={`pivot-${axis}-${i}`}
                >
                  <option value="">Choose field</option>
                  {options}
                </select>
              </label>
              {(kind === 'DATE' || kind === 'DATE_TIME') && (
                <label className="min-w-0 flex-1 basis-36">
                  {label} bucket
                  <select
                    className={selectClass}
                    value={d.dateBucket ?? ''}
                    onChange={(e) =>
                      update(i, {
                        field: d.field,
                        ...(e.target.value
                          ? {
                              dateBucket: e.target
                                .value as DataAnalysisPivotDimensionV1['dateBucket'],
                            }
                          : {}),
                      })
                    }
                    data-qqq-id={`pivot-${axis}-${i}-bucket`}
                  >
                    <option value="">No bucket</option>
                    {DATE_BUCKETS.map((b) => (
                      <option key={b} value={b}>
                        {b
                          .toLowerCase()
                          .replace(/_/g, ' ')
                          .replace(/^./, (c) => c.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {kind === 'NUMERIC' && (
                <label className="min-w-0 flex-1 basis-28">
                  {label} bins
                  <input
                    type="number"
                    min={1}
                    max={200}
                    placeholder="No bins"
                    className={selectClass}
                    value={d.numericBins?.count ?? ''}
                    onChange={(e) =>
                      update(i, {
                        field: d.field,
                        ...(e.target.value
                          ? { numericBins: { count: Number(e.target.value) } }
                          : {}),
                      })
                    }
                    data-qqq-id={`pivot-${axis}-${i}-bins`}
                  />
                </label>
              )}
              <button
                type="button"
                className={controlClass}
                aria-label={`Remove ${label}`}
                onClick={() => onChange({ ...value, [axis]: items.filter((_, n) => n !== i) })}
                data-qqq-id={`pivot-remove-${axis}-${i}`}
              >
                Remove
              </button>
            </div>
          )
        })}
        <button
          type="button"
          className={controlClass}
          disabled={items.length >= limit}
          onClick={() => onChange({ ...value, [axis]: [...items, { field: '' }] })}
          data-qqq-id={`pivot-add-${axis}`}
        >
          Add {axis === 'rows' ? 'row' : 'column'}
        </button>
      </fieldset>
    )
  }
  const updateMeasure = (index: number, measure: DataAnalysisPivotMeasureV1) =>
    onChange({ ...value, values: value.values.map((m, i) => (i === index ? measure : m)) })
  return (
    <div className="min-w-0 space-y-4 text-sm">
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        {dimensions('rows', 3)}
        {dimensions('columns', 2)}
      </div>
      <fieldset className="min-w-0 space-y-3 rounded border border-border p-3">
        <legend className="px-1 font-semibold">Values</legend>
        {value.values.map((m, i) => (
          <div key={i} className="flex min-w-0 flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1 basis-40">
              Value {i + 1} operator
              <select
                className={selectClass}
                value={m.operator}
                onChange={(e) =>
                  updateMeasure(i, {
                    operator: e.target.value as DataAnalysisPivotMeasureV1['operator'],
                    field: m.field,
                    ...(e.target.value === 'PERCENTILE' ? { percentile: 0.5 } : {}),
                  })
                }
                data-qqq-id={`pivot-operator-${i}`}
              >
                {Object.entries(PIVOT_OPERATORS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 flex-1 basis-40">
              Value {i + 1} field
              <select
                className={selectClass}
                value={m.field ?? ''}
                onChange={(e) => updateMeasure(i, { ...m, field: e.target.value || undefined })}
                data-qqq-id={`pivot-value-${i}`}
              >
                <option value="">{m.operator === 'COUNT' ? 'All records' : 'Choose field'}</option>
                {options}
              </select>
            </label>
            {m.operator === 'PERCENTILE' && (
              <label className="min-w-0 flex-1 basis-28">
                Value {i + 1} p
                <input
                  className={selectClass}
                  type="number"
                  min={0}
                  max={1}
                  step="any"
                  value={m.percentile ?? ''}
                  onChange={(e) =>
                    updateMeasure(i, {
                      ...m,
                      percentile: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                  data-qqq-id={`pivot-percentile-${i}`}
                />
              </label>
            )}
            <button
              type="button"
              className={controlClass}
              aria-label={`Remove value ${i + 1}`}
              onClick={() => onChange({ ...value, values: value.values.filter((_, n) => n !== i) })}
              data-qqq-id={`pivot-remove-value-${i}`}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className={controlClass}
          disabled={value.values.length >= 6}
          onClick={() => onChange({ ...value, values: [...value.values, { operator: 'COUNT' }] })}
          data-qqq-id="pivot-add-value"
        >
          Add value
        </button>
      </fieldset>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={value.showTotals !== false}
          onChange={(e) => onChange({ ...value, showTotals: e.target.checked })}
          data-qqq-id="pivot-show-totals"
        />
        Show totals
      </label>
    </div>
  )
}
