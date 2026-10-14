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

/** @file Saved analysis viewer: rerun as viewer, retain warnings, star and export. */
'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import type { QRecord } from '@/types'
import type {
  AnalysisDefinition,
  DataAnalysisCapabilityFieldV1,
  DataAnalysisChartV1,
} from '@/types/data-analysis'
import { getRecord } from '@/lib/api/tables'
import { listSavedAnalyses, runSavedAnalysis, starAnalysis } from '@/lib/api/data-analysis'
import { queryKeys } from '@/lib/query-client'
import { AnalysisActions } from './AnalysisActions'
import { controlClass, ProfileBadges, ProfileError, ProfileLoading } from './ProfileParts'
import ColumnProfilePanel from './ColumnProfilePanel'
import TableProfilePanel from './TableProfilePanel'
import PivotResult from './PivotResult'
import {
  CompareResult,
  CorrelationResult,
  CrosstabResult,
  ShiftResult,
} from './RelationshipResults'
const PivotChart = dynamic(() => import('./PivotChart'), { ssr: false })
const object = z.object({}).passthrough()
const field = z.string().min(1)
const schemas = {
  COLUMN_PROFILE: object.extend({ fieldName: field }),
  TABLE_PROFILE: object,
  PIVOT: object.extend({
    rows: z.array(object.extend({ field })),
    values: z.array(object.extend({ operator: field })),
  }),
  COMPARE: object.extend({ fields: z.array(field) }),
  CORRELATION: object.extend({ fields: z.array(field) }),
  CROSSTAB: object.extend({ rowField: field, columnField: field }),
  SHIFT: object.extend({ field, dateField: field }),
}

/** Reads a stored definition for display controls; the server owns permission validation.
 * @param record - Core saved record.
 * @returns Validated operation envelope.
 */
export function savedDefinition(record: QRecord): AnalysisDefinition {
  const kind = z
    .enum([
      'COLUMN_PROFILE',
      'TABLE_PROFILE',
      'PIVOT',
      'COMPARE',
      'CORRELATION',
      'CROSSTAB',
      'SHIFT',
    ])
    .parse(record.values.kind)
  const request = schemas[kind].parse(JSON.parse(String(record.values.definition_json)))
  if (kind !== 'COMPARE' && request.filter == null && record.values.filter_json)
    request.filter = object.parse(JSON.parse(String(record.values.filter_json)))
  return { kind, request } as AnalysisDefinition
}

/** Renders the server's typed result without reissuing an unsanitised ad hoc request.
 * @param props - Saved id, source metadata and navigation.
 * @returns Saved result and actions.
 */
export default function SavedAnalysisViewer({
  id,
  tableName,
  tableLabel,
  fields,
  sqlAvailable = false,
  onBack,
}: {
  id: string
  tableName: string
  tableLabel: string
  fields: DataAnalysisCapabilityFieldV1[]
  sqlAvailable?: boolean
  onBack: () => void
}) {
  const root = useRef<HTMLElement>(null)
  const [pngAvailable, setPngAvailable] = useState(false)
  useEffect(() => {
    const element = root.current
    if (!element) return
    const update = () =>
      setPngAvailable(Boolean(element.querySelector('svg.recharts-surface, svg[role="img"]')))
    update()
    const observer = new MutationObserver(update)
    observer.observe(element, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])
  const client = useQueryClient()
  const savedKey = [...queryKeys.dataAnalysis('data_analysis_saved'), 'library']
  const library = useQuery({ queryKey: savedKey, queryFn: listSavedAnalyses, retry: false })
  const loaded = useQuery({
    queryKey: [...queryKeys.dataAnalysis(tableName), 'saved', id],
    queryFn: async () => {
      const [record, result] = await Promise.all([
        getRecord('data_analysis_saved', id),
        runSavedAnalysis(id),
      ])
      if (record.values.table_name !== tableName)
        throw new Error(
          'This saved analysis belongs to another table. Open it from its saved record.'
        )
      return { record, result, definition: savedDefinition(record) }
    },
    retry: false,
    refetchOnWindowFocus: false,
  })
  const entry = library.data?.analyses?.find((a) => String(a.id) === id)
  const star = useMutation({
    mutationFn: (value: boolean) => starAnalysis(id, value),
    onSuccess: (result) => {
      client.setQueryData(savedKey, {
        ...library.data,
        analyses: library.data?.analyses?.map((a) =>
          String(a.id) === id ? { ...a, starred: result.starred } : a
        ),
      })
    },
  })
  const data = loaded.data
  const result = data?.result
  const definition = data?.definition
  const title =
    typeof data?.record.values.name === 'string' ? data.record.values.name : 'Saved analysis'
  const chartKind = data?.record.values.chart_kind
  const savedChartKind =
    typeof chartKind === 'string' &&
    ['HISTOGRAM', 'BOX', 'BAR', 'PARETO', 'TIME_SERIES', 'SCATTER', 'HEATMAP'].includes(chartKind)
      ? (chartKind as NonNullable<NonNullable<DataAnalysisChartV1>['kind']>)
      : undefined
  return (
    <section
      ref={root}
      className="w-full min-w-0 space-y-4 [overflow-wrap:anywhere]"
      aria-label="Saved analysis"
      data-qqq-id="saved-analysis-viewer"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button className={controlClass} onClick={onBack} data-qqq-id="saved-back">
          Back to records
        </button>
      </header>
      {loaded.isPending && <ProfileLoading />}
      {loaded.error && (
        <ProfileError
          error={loaded.error}
          retry={() => {
            void loaded.refetch()
          }}
        />
      )}
      {data && result && definition && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className={controlClass}
              aria-pressed={entry?.starred ?? false}
              disabled={!entry || star.isPending}
              onClick={() => star.mutate(!entry?.starred)}
              data-qqq-id="saved-star"
            >
              {entry?.starred ? 'Unstar' : 'Star'}
            </button>
            {entry?.shared && <span>Shared</span>}
            <Link
              className="underline"
              href={`/app/data_analysis_saved/${encodeURIComponent(id)}`}
              data-qqq-id="saved-record"
            >
              Saved record
            </Link>
          </div>
          {(library.error || star.error) && <ProfileError error={library.error ?? star.error} />}
          <ProfileBadges profile={{ warnings: result.warnings }} />
          <AnalysisActions
            definition={definition}
            tableName={tableName}
            savedId={id}
            sqlAvailable={sqlAvailable}
            chartRoot={() => root.current}
            pngAvailable={pngAvailable}
          />
          {result.kind === 'COLUMN_PROFILE' &&
            result.columnProfile &&
            definition.kind === 'COLUMN_PROFILE' && (
              <ColumnProfilePanel
                tableName={tableName}
                tableLabel={tableLabel}
                fieldName={definition.request.fieldName}
                fieldLabel={
                  fields.find((f) => f?.name === definition.request.fieldName)?.label ??
                  'Column profile'
                }
                filter={{}}
                onClose={onBack}
                savedChartKind={savedChartKind}
                savedResult={result.columnProfile}
              />
            )}
          {result.kind === 'TABLE_PROFILE' && result.tableProfile && (
            <TableProfilePanel
              tableName={tableName}
              tableLabel={tableLabel}
              fields={fields}
              filter={{}}
              onClose={onBack}
              savedChartKind={savedChartKind}
              savedResult={result.tableProfile}
            />
          )}
          {result.kind === 'PIVOT' && result.pivot && definition.kind === 'PIVOT' && (
            <>
              <ProfileBadges profile={result.pivot} />
              {(chartKind === 'BAR' || chartKind === 'TIME_SERIES') && (
                <PivotChart result={result.pivot} kind={chartKind} />
              )}
              <PivotResult
                result={result.pivot}
                rowLabels={definition.request.rows.map(
                  (d) => fields.find((f) => f?.name === d.field)?.label ?? 'Unlabeled field'
                )}
                columnCount={definition.request.columns?.length ?? 0}
                showTotals={definition.request.showTotals !== false}
              />
            </>
          )}
          {result.kind === 'COMPARE' && result.compare && (
            <CompareResult result={result.compare} fields={fields} />
          )}
          {result.kind === 'CORRELATION' && result.correlation && (
            <CorrelationResult result={result.correlation} fields={fields} tableName={tableName} />
          )}
          {result.kind === 'CROSSTAB' && result.crosstab && (
            <CrosstabResult result={result.crosstab} />
          )}
          {result.kind === 'SHIFT' && result.shift && <ShiftResult result={result.shift} />}
          {!result.columnProfile &&
            !result.tableProfile &&
            !result.pivot &&
            !result.compare &&
            !result.correlation &&
            !result.crosstab &&
            !result.shift && <p>No result is available with your current permissions.</p>}
        </>
      )}
    </section>
  )
}
