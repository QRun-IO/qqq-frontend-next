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

/** @file Sparse pivot matrix, totals, and readable phone cards. */
'use client'
import type { DataAnalysisMetricV1, DataAnalysisPivotV1 } from '@/types/data-analysis'
import { useMediaQuery } from '@/lib/hooks/use-media-query'
import { MetricValue } from './ProfileParts'

/** Displays suppression reasons alongside the shared metric/drill renderer.
 * @param props - A metric, or an absent sparse cell.
 * @returns The safe metric value.
 */
function CellValue({ metric }: { metric?: DataAnalysisMetricV1 }) {
  return (
    <>
      <MetricValue metric={metric ?? null} />
      {metric?.suppressed && (
        <span className="block text-xs font-normal text-muted-foreground">
          {metric.suppressedReason ?? 'This value is suppressed.'}
        </span>
      )}
    </>
  )
}

/** Renders column tuple levels and measure cells with sticky row headers.
 * @param props - Executed result and metadata labels.
 * @returns A single horizontal scroller, or phone row cards.
 */
export default function PivotResult({
  result,
  rowLabels,
  columnCount,
  showTotals,
}: {
  result: DataAnalysisPivotV1
  rowLabels: string[]
  columnCount: number
  showTotals: boolean
}) {
  const phone = useMediaQuery('(max-width: 639px)')
  const rows = result.rowHeaders ?? []
  const columns = result.columnHeaders ?? []
  const measures = result.measures ?? []
  const cells = new Map(
    result.cells?.map((cell) => [`${cell.rowIndex}:${cell.columnIndex}`, cell.values])
  )
  const rowLabel = (i: number) => rows[i].map((h) => h.label ?? 'Blank').join(' / ')
  const columnLabel = (i: number) =>
    columns[i].map((h) => h.label ?? 'Blank').join(' / ') || 'Values'
  const total =
    showTotals &&
    Boolean(result.grandTotals?.length || result.rowTotals?.length || result.columnTotals?.length)
  if (!rows.length) return <p>No matching pivot groups.</p>
  if (phone && columnCount === 1)
    return (
      <div className="space-y-3" data-qqq-id="pivot-cards">
        {rows.map((_, r) => (
          <section
            key={r}
            aria-label={rowLabel(r)}
            className="min-w-0 rounded border border-border p-3"
          >
            <h3 className="mb-2 break-words font-semibold">{rowLabel(r)}</h3>
            <dl className="space-y-2">
              {columns.flatMap((_, c) =>
                measures.map((m, v) => (
                  <div key={`${c}:${v}`} className="flex flex-wrap justify-between gap-2">
                    <dt>
                      {columnLabel(c)} · {m.label}
                    </dt>
                    <dd>
                      <CellValue metric={cells.get(`${r}:${c}`)?.[v]} />
                    </dd>
                  </div>
                ))
              )}
              {total &&
                measures.map((m, v) => (
                  <div key={v} className="flex flex-wrap justify-between gap-2 font-semibold">
                    <dt>Total · {m.label}</dt>
                    <dd>
                      <CellValue metric={result.rowTotals?.[r]?.[v]} />
                    </dd>
                  </div>
                ))}
            </dl>
          </section>
        ))}
        {total && (
          <section aria-label="Totals" className="rounded border border-border p-3">
            <h3 className="font-semibold">Totals</h3>
            <dl className="space-y-2">
              {columns.flatMap((_, c) =>
                measures.map((m, v) => (
                  <div key={`${c}:${v}`}>
                    <dt>
                      {columnLabel(c)} · {m.label}
                    </dt>
                    <dd>
                      <CellValue metric={result.columnTotals?.[c]?.[v]} />
                    </dd>
                  </div>
                ))
              )}
              {measures.map((m, v) => (
                <div key={v}>
                  <dt>Grand total · {m.label}</dt>
                  <dd>
                    <CellValue metric={result.grandTotals?.[v]} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>
    )
  const rowHeader =
    'sticky left-0 z-10 max-w-60 break-words border border-border bg-background p-3 text-left'
  const cellClass = 'border border-border p-3 text-right tabular-nums'
  return (
    <div
      className="max-w-full overflow-x-auto"
      role="region"
      aria-label="Pivot results"
      tabIndex={0}
      data-qqq-id="pivot-table-scroll"
    >
      <table className="w-full border-separate border-spacing-0 text-sm" aria-label="Pivot results">
        <thead>
          {Array.from({ length: Math.max(1, columnCount) }, (_, level) => {
            // Merge only contiguous equal prefixes, keeping the server's tuple/index order intact.
            const groups: { label: string; span: number; prefix: string }[] = []
            columns.forEach((tuple) => {
              const prefix = JSON.stringify(tuple.slice(0, level + 1))
              const previous = groups[groups.length - 1]
              if (previous && previous.prefix === prefix) previous.span += measures.length
              else
                groups.push({
                  label: tuple[level]?.label ?? 'Values',
                  span: measures.length,
                  prefix,
                })
            })
            return (
              <tr key={level}>
                {level === 0 && (
                  <th scope="col" rowSpan={Math.max(1, columnCount) + 1} className={rowHeader}>
                    {rowLabels.join(' / ')}
                  </th>
                )}
                {groups.map((g, i) => (
                  <th key={i} scope="colgroup" colSpan={g.span} className={cellClass}>
                    {g.label}
                  </th>
                ))}
                {total && level === 0 && (
                  <th
                    scope="colgroup"
                    colSpan={measures.length}
                    rowSpan={Math.max(1, columnCount)}
                    className={cellClass}
                  >
                    Total
                  </th>
                )}
              </tr>
            )
          })}
          <tr>
            {columns.flatMap((_, c) =>
              measures.map((m, v) => (
                <th key={`${c}:${v}`} scope="col" className={cellClass}>
                  {m.label}
                </th>
              ))
            )}
            {total &&
              measures.map((m, v) => (
                <th key={v} scope="col" className={cellClass}>
                  {m.label}
                </th>
              ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((_, r) => (
            <tr key={r}>
              <th scope="row" className={rowHeader}>
                {rowLabel(r)}
              </th>
              {columns.flatMap((_, c) =>
                measures.map((_, v) => (
                  <td key={`${c}:${v}`} className={cellClass}>
                    <CellValue metric={cells.get(`${r}:${c}`)?.[v]} />
                  </td>
                ))
              )}
              {total &&
                measures.map((_, v) => (
                  <td key={v} className={cellClass}>
                    <CellValue metric={result.rowTotals?.[r]?.[v]} />
                  </td>
                ))}
            </tr>
          ))}
        </tbody>
        {total && (
          <tfoot>
            <tr>
              <th scope="row" className={rowHeader}>
                Total
              </th>
              {columns.flatMap((_, c) =>
                measures.map((_, v) => (
                  <td key={`${c}:${v}`} className={cellClass}>
                    <CellValue metric={result.columnTotals?.[c]?.[v]} />
                  </td>
                ))
              )}
              {measures.map((_, v) => (
                <td key={v} className={cellClass}>
                  <CellValue metric={result.grandTotals?.[v]} />
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
