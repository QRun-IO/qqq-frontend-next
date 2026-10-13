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

/** @file Table completeness, candidate keys and duplicate groups for the current query. */
'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { QQueryFilter } from '@/types'
import type { DataAnalysisCapabilityFieldV1 } from '@/types/data-analysis'
import { duplicates, tableProfile } from '@/lib/api/data-analysis'
import { analysisFilter } from '@/lib/utils/data-analysis'
import { normalizeFilter } from '@/lib/utils/filter-utils'
import { countFilterConditions } from '@/lib/utils/date-range-utils'
import { queryKeys } from '@/lib/query-client'
import {
  controlClass,
  DrillLink,
  Metrics,
  MetricValue,
  ProfileBadges,
  ProfileError,
  ProfileLoading,
  ProfileSheet,
  Values,
} from './ProfileParts'
import { useExactRun } from './use-exact-run'
import { ExactRun } from './ExactRun'

const ProfileChart = dynamic(() => import('./ProfileChart'), {
  ssr: false,
  loading: () => <p role="status">Loading chart…</p>,
})

/** Scope and readable metadata for table analysis. */
export interface TableProfilePanelProps {
  tableName: string
  tableLabel: string
  filter: Partial<QQueryFilter>
  fields: DataAnalysisCapabilityFieldV1[]
  onClose: () => void
  unavailableReason?: string
}

/** Displays the current table profile and on-demand duplicate groups.
 * @param props - Metadata and captured query scope.
 * @returns The table profile sheet.
 */
export default function TableProfilePanel({
  tableName,
  tableLabel,
  filter,
  fields,
  onClose,
  unavailableReason,
}: TableProfilePanelProps) {
  const [selected, setSelected] = useState<string[]>([])
  let requestFilter
  let filterError: unknown
  try {
    requestFilter = analysisFilter(filter)
    if (unavailableReason) throw new Error(unavailableReason)
  } catch (error) {
    filterError = error
  }
  const request = { filter: requestFilter }
  const profile = useQuery({
    queryKey: [...queryKeys.dataAnalysis(tableName), 'table', request],
    queryFn: () => tableProfile(tableName, request),
    enabled: !filterError,
    retry: false,
  })
  const exact = useExactRun({ operation: 'TABLE_PROFILE', tableName, request })
  const data = exact.run.data?.status === 'COMPLETE' ? exact.run.data.tableProfile : profile.data
  const duplicateQuery = useMutation({
    mutationFn: () => duplicates(tableName, { ...request, fields: selected, limit: 50 }),
  })
  const conditions = countFilterConditions(normalizeFilter(filter), () => undefined)
  const labelFor = (name: string) =>
    fields.find((f) => f?.name === name)?.label ?? 'Unlabeled field'
  return (
    <ProfileSheet
      title={`Analyze ${tableLabel}`}
      description={conditions ? `Filtered: ${conditions} conditions` : 'All records'}
      onClose={onClose}
    >
      {filterError || profile.error ? (
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
      ) : profile.isPending ? (
        <ProfileLoading />
      ) : !data ? (
        <p>No profile data is available.</p>
      ) : (
        <>
          <ProfileBadges profile={data} />
          {data.estimate === true && <ExactRun exact={exact} />}
          <Metrics metrics={[data.rowCount ?? null]} />
          {!data.fields?.length ? (
            <p>No analyzable fields.</p>
          ) : (
            <table
              className="block w-full table-fixed text-left text-sm sm:table"
              aria-label="Field completeness"
            >
              <thead className="sr-only sm:not-sr-only sm:table-header-group">
                <tr>
                  <th scope="col">Field</th>
                  <th scope="col">Completeness</th>
                  <th scope="col">Distinct</th>
                  <th scope="col">Flags</th>
                </tr>
              </thead>
              <tbody className="block space-y-3 sm:table-row-group sm:space-y-0">
                {data.fields.map(
                  (field, index) =>
                    field && (
                      <tr
                        key={field.field ?? index}
                        className="block rounded border border-border p-3 sm:table-row sm:border-x-0"
                      >
                        <th scope="row" className="block break-words py-2 pr-2 sm:table-cell">
                          {field.label ?? (field.field ? labelFor(field.field) : 'Unlabeled field')}
                        </th>
                        <td className="block py-2 pr-2 align-top sm:table-cell">
                          <span className="sm:hidden">Completeness: </span>
                          {field.completeness == null
                            ? '—'
                            : `${Math.round(field.completeness * 100)}%`}
                          {field.completeness != null && (
                            <div className="my-1 h-2 rounded bg-muted">
                              <div
                                className="h-full rounded bg-primary"
                                style={{
                                  width: `${Math.max(0, Math.min(100, field.completeness * 100))}%`,
                                }}
                              />
                            </div>
                          )}
                          <div className="flex flex-wrap gap-x-1 text-xs text-muted-foreground">
                            {field.nulls && (
                              <span>
                                {field.nulls.label} <MetricValue metric={field.nulls} />
                              </span>
                            )}
                            {field.nulls && field.blanks && <span>{' · '}</span>}
                            {field.blanks && (
                              <span>
                                {field.blanks.label} <MetricValue metric={field.blanks} />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="block py-2 pr-2 align-top sm:table-cell">
                          <span className="sm:hidden">Distinct: </span>
                          {field.distinct?.toLocaleString() ?? '—'}
                        </td>
                        <td className="block py-2 align-top sm:table-cell">
                          {[
                            field.constant && 'Constant',
                            field.empty && 'Empty',
                            data.candidateKeys?.some(
                              (k) => k?.fields?.length === 1 && k.fields[0] === field.field
                            ) && 'Candidate key',
                          ]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </td>
                      </tr>
                    )
                )}
              </tbody>
            </table>
          )}
          {data.heatmap && <ProfileChart chart={data.heatmap} />}
          <section className="space-y-3">
            <h3 className="font-semibold">Candidate keys</h3>
            {data.candidateKeys?.length ? (
              <ul>
                {data.candidateKeys.map(
                  (key, i) =>
                    key && (
                      <li key={i}>
                        <DrillLink drill={key.drill}>
                          {key.fields?.map(labelFor).join(' + ')}
                          {key.rowCount != null && ` (${key.rowCount.toLocaleString()} rows)`}
                        </DrillLink>
                      </li>
                    )
                )}
              </ul>
            ) : (
              <p>No candidate keys found.</p>
            )}
          </section>
          <section className="space-y-3">
            <h3 className="font-semibold">Duplicates</h3>
            <fieldset className="flex flex-wrap gap-3">
              <legend className="mb-2 text-sm">Choose fields</legend>
              {fields.map(
                (field) =>
                  field?.name && (
                    <label key={field.name} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selected.includes(field.name)}
                        disabled={duplicateQuery.isPending}
                        onChange={(e) => {
                          setSelected(
                            e.target.checked
                              ? [...selected, field.name!]
                              : selected.filter((name) => name !== field.name)
                          )
                          duplicateQuery.reset()
                        }}
                        data-qqq-id={`analysis-duplicate-field-${field.name}`}
                      />
                      {field.label}
                    </label>
                  )
              )}
            </fieldset>
            <button
              className={controlClass}
              disabled={!selected.length || duplicateQuery.isPending}
              onClick={() => duplicateQuery.mutate()}
              data-qqq-id="analysis-find-duplicates"
            >
              Find duplicates
            </button>
            {duplicateQuery.isPending && <ProfileLoading />}
            {duplicateQuery.error && <ProfileError error={duplicateQuery.error} />}
            {duplicateQuery.isSuccess && (
              <>
                <ProfileBadges profile={duplicateQuery.data ?? {}} />
                <Values label="Duplicate groups" values={duplicateQuery.data?.groups} />
                {!duplicateQuery.data?.groups?.length && <p>No duplicate groups found.</p>}
              </>
            )}
          </section>
        </>
      )}
    </ProfileSheet>
  )
}
