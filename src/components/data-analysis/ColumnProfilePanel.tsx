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

/** @file Column analysis of the current query, including exact runs and paged distinct values. */
'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import type { QQueryFilter } from '@/types'
import type {
  DataAnalysisChartV1,
  DataAnalysisValueCountV1,
  DataAnalysisCapabilityFieldV1,
} from '@/types/data-analysis'
import { columnProfile, distinctValues } from '@/lib/api/data-analysis'
import { analysisFilter } from '@/lib/utils/data-analysis'
import { normalizeFilter } from '@/lib/utils/filter-utils'
import { countFilterConditions } from '@/lib/utils/date-range-utils'
import { queryKeys } from '@/lib/query-client'
import {
  controlClass,
  Metrics,
  ProfileBadges,
  ProfileError,
  ProfileLoading,
  ProfileSheet,
  Values,
} from './ProfileParts'
import { useExactRun } from './use-exact-run'
import { ExactRun } from './ExactRun'
import { AnalysisActions } from './AnalysisActions'
import { WatchDialog } from './WatchDialog'
import type { DataAnalysisColumnProfileV1 } from '@/types/data-analysis'

const ProfileChart = dynamic(() => import('./ProfileChart'), {
  ssr: false,
  loading: () => <p role="status">Loading chart…</p>,
})

/** Metadata and query scope captured when opening a column profile. */
export interface ColumnProfilePanelProps {
  tableName: string
  tableLabel: string
  fields?: DataAnalysisCapabilityFieldV1[]
  fieldName: string
  fieldLabel: string
  filter: Partial<QQueryFilter>
  onClose: () => void
  unavailableReason?: string
  sqlAvailable?: boolean
  savedChartKind?: NonNullable<NonNullable<DataAnalysisChartV1>['kind']>
  savedResult?: DataAnalysisColumnProfileV1
}

/** Renders a chart for date pattern buckets using their semantic labels and drills.
 * @param props - Named value buckets.
 * @returns A lazy bar chart.
 */
function BucketChart({
  values,
  label,
}: {
  values?: DataAnalysisValueCountV1[] | null
  label: string
}) {
  if (!values?.length) return null
  return (
    <ProfileChart
      chart={{
        kind: 'BAR',
        x: { label },
        y: { label: 'Count' },
        series: [
          {
            name: label,
            points: values.map(
              (v) => v && { x: v.value, label: v.label, y: v.count, drill: v.drill }
            ),
          },
        ],
      }}
    />
  )
}

/** Profiles a field in a responsive sheet. Mount with a new key when the query scope changes.
 * @param props - Metadata, current filter and close action.
 * @returns The column profile panel.
 */
export default function ColumnProfilePanel({
  tableName,
  tableLabel,
  fields = [],
  fieldName,
  fieldLabel,
  filter,
  onClose,
  unavailableReason,
  sqlAvailable = false,
  savedResult,
  savedChartKind,
}: ColumnProfilePanelProps) {
  const [chartKind, setChartKind] =
    useState<NonNullable<NonNullable<DataAnalysisChartV1>['kind']>>()
  const [showAll, setShowAll] = useState(false)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  let requestFilter
  let filterError: unknown
  try {
    requestFilter = analysisFilter(filter)
    if (unavailableReason) throw new Error(unavailableReason)
  } catch (error) {
    filterError = error
  }
  const request = { fieldName, filter: requestFilter }
  const profile = useQuery({
    queryKey: [...queryKeys.dataAnalysis(tableName), 'column', request],
    queryFn: () => columnProfile(tableName, request),
    enabled: savedResult === undefined && !filterError,
    retry: false,
  })
  const exact = useExactRun({ operation: 'COLUMN_PROFILE', tableName, request })
  const data =
    savedResult ??
    (exact.run.data?.status === 'COMPLETE' ? exact.run.data.columnProfile : profile.data)
  const values = useQuery({
    queryKey: [...queryKeys.dataAnalysis(tableName), 'distinct', request, page, search],
    queryFn: () => distinctValues(tableName, { ...request, page, pageSize: 50, search }),
    enabled: showAll && !filterError,
    retry: false,
  })
  const conditions = countFilterConditions(normalizeFilter(filter), () => undefined)
  return (
    <ProfileSheet
      inline={savedResult !== undefined}
      title={fieldLabel}
      description={`${tableLabel} · ${conditions ? `Filtered: ${conditions} conditions` : 'All records'}`}
      onClose={onClose}
    >
      {filterError || (savedResult === undefined && profile.error) ? (
        <ProfileError
          error={filterError ?? profile.error}
          retry={
            filterError
              ? undefined
              : () => {
                  void profile.refetch()
                }
          }
        />
      ) : savedResult === undefined && profile.isPending ? (
        <ProfileLoading />
      ) : !data ? (
        <p>No profile data is available.</p>
      ) : (
        <>
          {savedResult === undefined && (
            <div className="space-y-2">
              <AnalysisActions
                definition={{ kind: 'COLUMN_PROFILE', request }}
                tableName={tableName}
                chartKind={chartKind ?? data.chart?.kind}
                sqlAvailable={sqlAvailable}
              />
              <WatchDialog
                tableName={tableName}
                fields={fields}
                filter={requestFilter}
                fieldName={fieldName}
              />
            </div>
          )}
          <ProfileBadges profile={data} />
          {savedResult === undefined && data.estimate === true && <ExactRun exact={exact} />}
          {!data.counts?.length &&
            !data.numeric &&
            !data.dates &&
            !data.text &&
            !data.booleans?.length &&
            !data.topValues?.length && <p>No profile data is available.</p>}
          <Metrics metrics={data.counts} />
          {data.chart && (
            <ProfileChart
              initialKind={savedChartKind}
              onKindChange={setChartKind}
              chart={data.chart}
              metrics={data.numeric?.metrics ?? []}
            />
          )}
          {data.numeric && (
            <section aria-label="Numeric statistics" className="space-y-3">
              <h3 className="font-semibold">Numeric statistics</h3>
              <Metrics metrics={data.numeric.metrics} />
              <Values label="Outliers" values={data.numeric.outliers} />
            </section>
          )}
          {data.dates && (
            <section aria-label="Date statistics" className="space-y-3">
              <h3 className="font-semibold">Dates</h3>
              <Metrics metrics={data.dates.metrics} />
              <Values label="Gaps" values={data.dates.gaps} />
              <BucketChart label="Day of week" values={data.dates.dayOfWeek} />
              <BucketChart label="Hour of day" values={data.dates.hourOfDay} />
            </section>
          )}
          {data.text && (
            <section aria-label="Text statistics" className="space-y-3">
              <h3 className="font-semibold">Text lengths</h3>
              <Metrics metrics={data.text.metrics} />
              <BucketChart label="Length distribution" values={data.text.histogram} />
              <Values label="Top patterns" values={data.text.patterns} />
              {data.text.sampleRows != null && (
                <p className="text-sm">
                  Patterns based on {data.text.sampleRows.toLocaleString()} sampled rows.
                </p>
              )}
            </section>
          )}
          {Boolean(data.booleans?.length) && (
            <section aria-label="Boolean statistics" className="space-y-3">
              <h3 className="font-semibold">Booleans</h3>
              <Metrics metrics={data.booleans} />
            </section>
          )}
          <Values label="Top values" values={data.topValues} />
          {savedResult === undefined && (
            <button
              className={controlClass}
              aria-expanded={showAll}
              onClick={() => setShowAll(!showAll)}
              data-qqq-id="analysis-all-values"
            >
              {showAll ? 'Hide all values' : 'Show all values'}
            </button>
          )}
          {showAll && (
            <section className="space-y-3" aria-label="All distinct values">
              <label className="block">
                Search values
                <input
                  type="search"
                  className={`${controlClass} mt-1 w-full`}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(0)
                  }}
                  data-qqq-id="analysis-values-search"
                />
              </label>
              {values.isPending ? (
                <ProfileLoading />
              ) : values.error ? (
                <ProfileError
                  error={values.error}
                  retry={() => {
                    void values.refetch()
                  }}
                />
              ) : (
                <>
                  <Values label="All values" values={values.data?.values} />
                  {!values.data?.values?.length && <p>No matching values.</p>}
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      className={controlClass}
                      disabled={page === 0 || values.isFetching}
                      onClick={() => setPage(page - 1)}
                      data-qqq-id="analysis-values-prev"
                    >
                      Previous
                    </button>
                    <span>Page {page + 1}</span>
                    <button
                      className={controlClass}
                      disabled={!values.data?.hasMore || values.isFetching}
                      onClick={() => setPage(page + 1)}
                      data-qqq-id="analysis-values-next"
                    >
                      Next
                    </button>
                  </div>
                </>
              )}
            </section>
          )}
        </>
      )}
    </ProfileSheet>
  )
}
