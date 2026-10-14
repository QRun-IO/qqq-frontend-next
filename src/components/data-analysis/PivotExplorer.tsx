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

/** @file Shareable pivot explorer hosted in the record query page. */
'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import type { QQueryFilter } from '@/types'
import type { DataAnalysisCapabilityFieldV1 } from '@/types/data-analysis'
import { pivot } from '@/lib/api/data-analysis'
import { queryKeys } from '@/lib/query-client'
import { analysisFilter } from '@/lib/utils/data-analysis'
import {
  decodePivot,
  pivotChartKind,
  validatePivot,
  type PivotLayout,
} from '@/lib/utils/data-analysis-pivot'
import { AnalysisActions } from './AnalysisActions'
import PivotBuilder from './PivotBuilder'
import PivotResult from './PivotResult'
import { controlClass, ProfileBadges, ProfileError, ProfileLoading } from './ProfileParts'

const PivotChart = dynamic(() => import('./PivotChart'), {
  ssr: false,
  loading: () => <p role="status">Loading chart…</p>,
})

/** The parent keys this component by the URL layout so Back/Forward restore the builder.
 * @param props - Capability metadata, current query scope and URL actions.
 * @returns The full-width explorer.
 */
export default function PivotExplorer({
  tableName,
  tableLabel,
  fields,
  filter,
  encoded,
  onRun,
  onBack,
  unavailableReason,
  sqlAvailable = false,
}: {
  tableName: string
  tableLabel: string
  fields: DataAnalysisCapabilityFieldV1[]
  filter: Partial<QQueryFilter>
  encoded: string | null
  onRun: (request: PivotLayout) => void
  onBack: () => void
  sqlAvailable?: boolean
  unavailableReason?: string
}) {
  let initial: PivotLayout | null = null
  let urlError: string | null = null
  try {
    if (encoded) initial = decodePivot(encoded)
  } catch (error) {
    urlError = (error as Error).message
  }
  const [draft, setDraft] = useState<PivotLayout>(
    () =>
      initial ?? {
        rows: [{ field: '' }],
        columns: [],
        values: [{ operator: 'COUNT' }],
        showTotals: true,
      }
  )
  const [chart, setChart] = useState(false)
  const missingField = (layout: PivotLayout) =>
    [...layout.rows, ...(layout.columns ?? []), ...layout.values.filter((m) => m.field)].some(
      (d) => !fields.some((f) => f?.name === d.field)
    )
  const fieldMessage =
    'A field in this pivot is no longer available. Choose from the current fields and Run again.'
  const validation = validatePivot(draft) ?? (missingField(draft) ? fieldMessage : null)
  const initialFieldError = initial && missingField(initial) ? new Error(fieldMessage) : null
  let scopeError: unknown
  let requestFilter
  try {
    if (unavailableReason) throw new Error(unavailableReason)
    requestFilter = analysisFilter(filter)
  } catch (error) {
    scopeError = error
  }
  const request = initial ? { ...initial, filter: requestFilter } : null
  const result = useQuery({
    queryKey: [...queryKeys.dataAnalysis(tableName), 'pivot', request],
    queryFn: () => pivot(tableName, request!),
    enabled: Boolean(request) && !scopeError && !initialFieldError,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const kind = initial ? pivotChartKind(initial, fields) : null
  return (
    <section
      className="w-full min-w-0 max-w-full space-y-4 [overflow-wrap:anywhere]"
      aria-label={`Pivot ${tableLabel}`}
      data-qqq-id="pivot-explorer"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Pivot {tableLabel}</h2>
        <button className={controlClass} onClick={onBack} data-qqq-id="pivot-back">
          Back to records
        </button>
      </header>
      <form
        className="min-w-0 space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!validation && !scopeError) {
            onRun(draft)
            if (initial && !initialFieldError && JSON.stringify(draft) === JSON.stringify(initial))
              void result.refetch()
          }
        }}
      >
        <PivotBuilder value={draft} onChange={setDraft} fields={fields} />
        {validation && <p role="status">{validation}</p>}
        <button
          className={controlClass}
          disabled={Boolean(validation || scopeError) || result.isFetching}
          data-qqq-id="pivot-run"
          type="submit"
        >
          Run
        </button>
      </form>
      {urlError && <p role="alert">{urlError}</p>}
      {scopeError || initialFieldError ? (
        <ProfileError error={scopeError ?? initialFieldError} />
      ) : result.error ? (
        <ProfileError
          error={result.error}
          retry={() => {
            void result.refetch()
          }}
        />
      ) : request && result.isFetching ? (
        <ProfileLoading />
      ) : result.data && initial ? (
        <>
          <AnalysisActions
            definition={{ kind: 'PIVOT', request: request! }}
            tableName={tableName}
            chartKind={kind}
            sqlAvailable={sqlAvailable}
          />
          <ProfileBadges profile={result.data} />
          <button
            className={controlClass}
            aria-pressed={chart}
            onClick={() => setChart(!chart)}
            data-qqq-id="pivot-chart-toggle"
          >
            Chart
          </button>
          {chart &&
            (kind ? (
              <PivotChart result={result.data} kind={kind} />
            ) : (
              <p>Chart not available for this layout</p>
            ))}
          <PivotResult
            result={result.data}
            rowLabels={initial.rows.map(
              (d) => fields.find((f) => f?.name === d.field)?.label ?? 'Unlabeled field'
            )}
            columnCount={initial.columns?.length ?? 0}
            showTotals={initial.showTotals !== false}
          />
        </>
      ) : (
        !request && <p>Choose rows and values, then Run to explore these records.</p>
      )}
    </section>
  )
}
