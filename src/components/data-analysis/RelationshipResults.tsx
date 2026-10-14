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

/** @file Semantic comparison, correlation, crosstab and shift results. */
'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import type {
  DataAnalysisCapabilityFieldV1,
  DataAnalysisCompareV1,
  DataAnalysisCorrelationV1,
  DataAnalysisCrosstabV1,
  DataAnalysisShiftV1,
  DataAnalysisSignificanceV1,
  DataAnalysisScatterRequestV1,
} from '@/types/data-analysis'
import { scatter } from '@/lib/api/data-analysis'
import { queryKeys } from '@/lib/query-client'
import { correlationColor } from '@/lib/utils/chart-colors'
import { controlClass, Metrics, MetricValue, ProfileError, ProfileLoading } from './ProfileParts'

const RelationshipChart = dynamic(() => import('./RelationshipChart'), { ssr: false })

/** Shows the server conclusion and applies the strict p < .05 badge rule.
 * @param props - Statistical test result.
 * @returns Plain language and test details.
 */
export function Significance({ value }: { value?: DataAnalysisSignificanceV1 | null }) {
  const badge =
    !value?.applicable || value.pValue == null
      ? 'Not applicable'
      : value.pValue < 0.05
        ? 'Significant'
        : 'Not significant'
  return (
    <div className="space-y-2">
      <p>{value?.sentence ?? 'Test not applicable.'}</p>
      <span className="inline-block rounded border border-border px-2 py-1 text-sm">{badge}</span>
      <p className="text-sm">
        {value?.test ?? 'Test unavailable'} · p = {value?.pValue ?? '—'}
      </p>
    </div>
  )
}

/** Comparison cards preserve every metric's suppression and drill.
 * @param props - Result and readable field labels.
 * @returns Field cards.
 */
export function CompareResult({
  result,
  fields,
}: {
  result: DataAnalysisCompareV1
  fields: DataAnalysisCapabilityFieldV1[]
}) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 min-[900px]:grid-cols-2">
      {!result.fields?.length && <p>No comparison results.</p>}
      {result.fields?.map((field, i) => (
        <section
          key={i}
          className="min-w-0 space-y-4 rounded border border-border p-4"
          aria-label={fields.find((f) => f?.name === field.field)?.label ?? 'Field comparison'}
        >
          <h3 className="font-semibold">
            {fields.find((f) => f?.name === field.field)?.label ?? 'Field comparison'}
          </h3>
          <Significance value={field.significance} />
          {field.values?.map((v, j) => (
            <div key={j} className="space-y-3">
              <h4 className="font-medium">
                {field.chart?.kind === 'BOX' ? 'Numeric summary' : v.label}
              </h4>
              <div className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-2">
                {[v.sideA, v.sideB].map((side, k) => (
                  <div key={k} className="min-w-0">
                    <p className="font-medium">{side?.label ?? (k ? 'B' : 'A')}</p>
                    <Metrics metrics={side?.metrics} />
                  </div>
                ))}
              </div>
              <dl className="flex flex-wrap gap-4">
                <div>
                  <dt>Delta (B − A)</dt>
                  <dd>
                    <MetricValue metric={v.delta ?? null} />
                  </dd>
                </div>
                <div>
                  <dt>% delta</dt>
                  <dd>
                    <MetricValue metric={v.percentDelta ?? null} />
                  </dd>
                </div>
              </dl>
              {v.significance && <Significance value={v.significance} />}
            </div>
          ))}
          {field.chart && <RelationshipChart chart={field.chart} />}
        </section>
      ))}
    </div>
  )
}

/** A bounded grid and equivalent table open server-supplied scatter requests.
 * @param props - Correlation result, labels and table scope.
 * @returns Heatmap and selected scatter.
 */
export function CorrelationResult({
  result,
  fields,
  tableName,
}: {
  result: DataAnalysisCorrelationV1
  fields: DataAnalysisCapabilityFieldV1[]
  tableName: string
}) {
  const [table, setTable] = useState(false)
  const [pair, setPair] = useState<DataAnalysisScatterRequestV1 | null>(null)
  const selected = useQuery({
    queryKey: [...queryKeys.dataAnalysis(tableName), 'scatter', pair],
    queryFn: () => scatter(tableName, pair!),
    enabled: Boolean(pair),
    retry: false,
    refetchOnWindowFocus: false,
  })
  const names = result.fields ?? []
  const label = (name: string) => fields.find((f) => f?.name === name)?.label ?? 'Unavailable field'
  const cell = (x: string, y: string) => {
    const c = result.cells?.find((c) => c.xField === x && c.yField === y)
    return (
      <button
        type="button"
        className="min-w-0 rounded border border-border p-1 text-xs tabular-nums text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        style={correlationColor(c?.r)}
        disabled={!c?.scatter}
        aria-label={`${label(y)} and ${label(x)}: r = ${c?.r?.toFixed(2) ?? 'unavailable'}`}
        onClick={() => setPair(c?.scatter ?? null)}
        data-qqq-id="correlation-cell"
      >
        {c?.r?.toFixed(2) ?? '—'}
      </button>
    )
  }
  return (
    <div className="min-w-0 space-y-4">
      <button
        className={controlClass}
        type="button"
        aria-pressed={table}
        onClick={() => setTable(!table)}
        data-qqq-id="correlation-table"
      >
        {table ? 'Show as heatmap' : 'Show as table'}
      </button>
      {!names.length ? (
        <p>No correlation results.</p>
      ) : table ? (
        <div className="max-w-full overflow-x-auto">
          <table className="w-full text-left">
            <caption>Correlation matrix</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 bg-background p-2">
                  Field
                </th>
                {names.map((n) => (
                  <th scope="col" className="p-2" key={n}>
                    {label(n)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {names.map((y) => (
                <tr key={y}>
                  <th scope="row" className="sticky left-0 bg-background p-2">
                    {label(y)}
                  </th>
                  {names.map((x) => (
                    <td className="p-2" key={x}>
                      {cell(x, y)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          className="grid min-w-0 gap-1"
          style={{
            gridTemplateColumns: `minmax(0, 1.5fr) repeat(${names.length}, minmax(0, 1fr))`,
          }}
          aria-label="Correlation heatmap"
        >
          <span className="text-xs">Field</span>
          {names.map((n) => (
            <span key={n} className="min-w-0 break-words text-xs">
              {label(n)}
            </span>
          ))}
          {names.map((y) => (
            <div key={y} className="contents">
              <span className="min-w-0 self-center break-words text-xs">{label(y)}</span>
              {names.map((x) => (
                <div className="grid min-w-0" key={x}>
                  {cell(x, y)}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {pair && (
        <section aria-label="Scatter" className="min-w-0 space-y-3">
          <h3 className="font-semibold">
            {label(pair.xField)} and {label(pair.yField)}
          </h3>
          {selected.isFetching ? (
            <ProfileLoading />
          ) : selected.error ? (
            <ProfileError
              error={selected.error}
              retry={() => {
                void selected.refetch()
              }}
            />
          ) : (
            selected.data && (
              <>
                <p>
                  {selected.data.trend?.r == null
                    ? 'Correlation is not available for this sample.'
                    : `The sample has a Pearson correlation of r = ${selected.data.trend.r.toFixed(2)}.`}
                </p>
                <p className="text-sm">
                  {selected.data.sampleSize ?? 0} sampled records
                  {selected.data.sampling ? ` · ${selected.data.sampling}` : ''}
                </p>
                {selected.data.chart && <RelationshipChart chart={selected.data.chart} />}
              </>
            )
          )}
        </section>
      )}
    </div>
  )
}

/** Displays counts and optional shares without reconstructing hidden cells.
 * @param props - Crosstab result.
 * @returns A scrollable semantic table and test.
 */
export function CrosstabResult({ result }: { result: DataAnalysisCrosstabV1 }) {
  const [rowShare, setRowShare] = useState(false),
    [columnShare, setColumnShare] = useState(false)
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap gap-4">
        <label>
          <input
            type="checkbox"
            checked={rowShare}
            onChange={(e) => setRowShare(e.target.checked)}
            data-qqq-id="crosstab-row-share"
          />{' '}
          Row shares
        </label>
        <label>
          <input
            type="checkbox"
            checked={columnShare}
            onChange={(e) => setColumnShare(e.target.checked)}
            data-qqq-id="crosstab-column-share"
          />{' '}
          Column shares
        </label>
      </div>
      <div className="max-w-full overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption>Crosstab counts</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 bg-background p-3">
                Row
              </th>
              {result.columns?.map((c, i) => (
                <th scope="col" className="p-3" key={i}>
                  {c.label ?? 'Blank'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows?.map((r, i) => (
              <tr key={i}>
                <th scope="row" className="sticky left-0 bg-background p-3">
                  {r.label ?? 'Blank'}
                </th>
                {result.columns?.map((_, j) => {
                  const c = result.cells?.find((c) => c.rowIndex === i && c.columnIndex === j)
                  return (
                    <td key={j} className="p-3">
                      <MetricValue metric={c?.count ?? null} />
                      {rowShare && (
                        <div>
                          Row: <MetricValue metric={c?.rowShare ?? null} />
                        </div>
                      )}
                      {columnShare && (
                        <div>
                          Column: <MetricValue metric={c?.columnShare ?? null} />
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Significance value={result.significance} />
      <p>Cramér’s V: {result.significance?.cramersV ?? '—'}</p>
    </div>
  )
}

/** Shows the PSI conclusion, bucket metrics and all time-series shares.
 * @param props - Shift result.
 * @returns Timeline and drillable metrics.
 */
export function ShiftResult({ result }: { result: DataAnalysisShiftV1 }) {
  return (
    <div className="min-w-0 space-y-4">
      <p>{result.sentence}</p>
      <p>
        Population stability index: <MetricValue metric={result.psi ?? null} />
      </p>
      {result.chart && <RelationshipChart chart={result.chart} />}
      <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
        {result.buckets?.map((b, i) => (
          <section key={i} className="min-w-0 space-y-2 rounded border border-border p-3">
            <h3>
              {b.label}
              {b.complete === false ? ' (incomplete)' : ''}
            </h3>
            <Metrics metrics={b.metrics} />
          </section>
        ))}
      </div>
    </div>
  )
}
