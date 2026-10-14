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

/** @file URL-backed compare and relationship builders on the record query page. */
'use client'
import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useQuery } from '@tanstack/react-query'
import type { QQueryFilter, QTableMetaData } from '@/types'
import type { DataAnalysisCapabilityFieldV1 } from '@/types/data-analysis'
import type { SavedView } from '@/lib/utils/saved-view-utils'
import { compare, correlation, crosstab, shift } from '@/lib/api/data-analysis'
import { queryKeys } from '@/lib/query-client'
import { analysisFilter } from '@/lib/utils/data-analysis'
import { normalizeFilter } from '@/lib/utils/filter-utils'
import {
  decodeExplore,
  EXPLORE_LABELS,
  SHIFT_BUCKETS,
  validateExplore,
  type ExploreLayout,
  type RelationshipView,
} from '@/lib/utils/data-analysis-explore'
import { AnalysisActions } from './AnalysisActions'
import type { AnalysisDefinition } from '@/types/data-analysis'
import { FilterBuilder } from '@/components/query/FilterBuilder'
import { controlClass, ProfileError, ProfileLoading } from './ProfileParts'
import {
  CompareResult,
  CorrelationResult,
  CrosstabResult,
  ShiftResult,
} from './RelationshipResults'

/** Restores layouts on browser navigation; current query filters always own side A.
 * @param props - View, metadata, URL state and navigation.
 * @returns Full-width analysis builder and result.
 */
export default function RelationshipExplorer({
  view,
  tableName,
  tableMetaData,
  fields,
  filter,
  encoded,
  onRun,
  onBack,
  savedViews,
  unavailableReason,
  sqlAvailable = false,
}: {
  view: RelationshipView
  tableName: string
  tableMetaData: QTableMetaData
  fields: DataAnalysisCapabilityFieldV1[]
  filter: Partial<QQueryFilter>
  encoded: string | null
  onRun: (layout: ExploreLayout) => void
  onBack: () => void
  savedViews?: SavedView[]
  sqlAvailable?: boolean
  unavailableReason?: string
}) {
  let initial: ExploreLayout | null = null,
    urlError: string | null = null
  try {
    if (encoded) initial = decodeExplore(view, encoded)
  } catch (error) {
    urlError = (error as Error).message
  }
  const [draft, setDraft] = useState<ExploreLayout>(
    () =>
      initial ?? {
        fields: [],
        labelA: 'Current query',
        labelB: 'Whole table',
        sideB: 'whole',
        field: '',
        dateField: '',
        bucket: 'MONTH',
        rowField: '',
        columnField: '',
      }
  )
  const [editing, setEditing] = useState(false)
  const [editedFilter, setEditedFilter] = useState(() => normalizeFilter(initial?.filterB ?? {}))
  const patch = (value: Partial<ExploreLayout>) => setDraft((d) => ({ ...d, ...value }))
  const numeric = fields.filter((f) => f?.kind === 'NUMERIC')
  const categories = fields.filter((f) => ['CATEGORY', 'TEXT', 'BOOLEAN'].includes(f?.kind ?? ''))
  const dates = fields.filter((f) => ['DATE', 'DATE_TIME'].includes(f?.kind ?? ''))
  const available = (name: string | undefined, choices: DataAnalysisCapabilityFieldV1[]) =>
    choices.some((f) => f?.name === name)
  const fieldError = (layout: ExploreLayout) => {
    const valid =
      view === 'compare'
        ? layout.fields?.every((f) => available(f, fields))
        : view === 'correlation'
          ? layout.fields?.every((f) => available(f, numeric))
          : view === 'crosstab'
            ? available(layout.rowField, categories) && available(layout.columnField, categories)
            : available(layout.field, fields) && available(layout.dateField, dates)
    return valid
      ? null
      : 'A field is no longer available or has the wrong type. Choose from the current fields.'
  }
  const validation = validateExplore(view, draft) ?? fieldError(draft)
  let scopeError: unknown, requestFilter: ReturnType<typeof analysisFilter> | undefined
  try {
    if (unavailableReason) throw new Error(unavailableReason)
    requestFilter = analysisFilter(filter)
  } catch (error) {
    scopeError = error
  }
  const initialError = initial && fieldError(initial)
  const result = useQuery({
    queryKey: [...queryKeys.dataAnalysis(tableName), view, initial, requestFilter],
    queryFn: async () => {
      const layout = initial!
      if (view === 'compare')
        return {
          compare: await compare(tableName, {
            fields: layout.fields!,
            labelA: layout.labelA,
            labelB: layout.labelB,
            filterA: requestFilter,
            filterB: layout.sideB === 'whole' ? null : analysisFilter(layout.filterB!),
          }),
        }
      if (view === 'correlation')
        return {
          correlation: await correlation(tableName, {
            fields: layout.fields!,
            filter: requestFilter,
          }),
        }
      if (view === 'crosstab')
        return {
          crosstab: await crosstab(tableName, {
            rowField: layout.rowField!,
            columnField: layout.columnField!,
            filter: requestFilter,
          }),
        }
      return {
        shift: await shift(tableName, {
          field: layout.field!,
          dateField: layout.dateField!,
          bucket: layout.bucket,
          filter: requestFilter,
        }),
      }
    },
    enabled: Boolean(initial) && !initialError && !scopeError,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const definition: AnalysisDefinition | null = !initial
    ? null
    : view === 'compare'
      ? {
          kind: 'COMPARE',
          request: {
            fields: initial.fields!,
            labelA: initial.labelA,
            labelB: initial.labelB,
            filterA: requestFilter,
            filterB: initial.sideB === 'whole' ? null : analysisFilter(initial.filterB!),
          },
        }
      : view === 'correlation'
        ? { kind: 'CORRELATION', request: { fields: initial.fields!, filter: requestFilter } }
        : view === 'crosstab'
          ? {
              kind: 'CROSSTAB',
              request: {
                rowField: initial.rowField!,
                columnField: initial.columnField!,
                filter: requestFilter,
              },
            }
          : {
              kind: 'SHIFT',
              request: {
                field: initial.field!,
                dateField: initial.dateField!,
                bucket: initial.bucket,
                filter: requestFilter,
              },
            }
  const select = (
    label: string,
    key: 'field' | 'dateField' | 'rowField' | 'columnField',
    choices: DataAnalysisCapabilityFieldV1[]
  ) => (
    <label className="flex min-w-0 flex-col gap-1">
      {label}
      <select
        aria-label={label}
        className={`${controlClass} w-full min-w-0`}
        value={draft[key] ?? ''}
        onChange={(e) => patch({ [key]: e.target.value })}
        data-qqq-id={`explore-${key}`}
      >
        <option value="">Choose a field</option>
        {choices.map(
          (f) =>
            f?.name && (
              <option key={f.name} value={f.name}>
                {f.label ?? 'Unlabeled field'}
              </option>
            )
        )}
      </select>
    </label>
  )
  return (
    <section
      className="w-full min-w-0 max-w-full space-y-4 [overflow-wrap:anywhere]"
      aria-label={`${EXPLORE_LABELS[view]} ${tableMetaData.label}`}
      data-qqq-id={`${view}-explorer`}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {EXPLORE_LABELS[view]} {tableMetaData.label}
        </h2>
        <button className={controlClass} onClick={onBack} data-qqq-id="explore-back">
          Back to records
        </button>
      </header>
      <form
        className="min-w-0 space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!validation && !scopeError) {
            onRun(draft)
            if (JSON.stringify(draft) === JSON.stringify(initial)) void result.refetch()
          }
        }}
      >
        {view === 'compare' && (
          <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <label className="flex flex-col gap-1">
                Side A label
                <input
                  className={`${controlClass} min-w-0`}
                  value={draft.labelA ?? ''}
                  onChange={(e) => patch({ labelA: e.target.value })}
                  data-qqq-id="compare-label-a"
                />
              </label>
              <p>Side A uses the current query filter.</p>
            </div>
            <div className="min-w-0 space-y-2">
              <label className="flex flex-col gap-1">
                Side B label
                <input
                  className={`${controlClass} min-w-0`}
                  value={draft.labelB ?? ''}
                  onChange={(e) => patch({ labelB: e.target.value })}
                  data-qqq-id="compare-label-b"
                />
              </label>
              <label className="flex flex-col gap-1">
                Side B
                <select
                  aria-label="Side B"
                  className={`${controlClass} w-full min-w-0`}
                  value={draft.sideB}
                  onChange={(e) => {
                    const sideB = e.target.value as ExploreLayout['sideB']
                    patch({
                      sideB,
                      labelB:
                        sideB === 'whole'
                          ? 'Whole table'
                          : sideB === 'saved'
                            ? 'Saved view'
                            : 'Filter B',
                      filterB: sideB === 'edit' ? (draft.filterB ?? {}) : undefined,
                      savedViewId: undefined,
                    })
                    if (sideB === 'edit') {
                      setEditedFilter(normalizeFilter(draft.filterB ?? {}))
                      setEditing(true)
                    }
                  }}
                  data-qqq-id="compare-side-b"
                >
                  <option value="whole">Whole table</option>
                  {savedViews !== undefined && <option value="saved">Another saved view</option>}
                  <option value="edit">Edit filter B</option>
                </select>
              </label>
              {draft.sideB === 'saved' && (
                <label className="flex flex-col gap-1">
                  Saved view
                  <select
                    aria-label="Saved view"
                    className={`${controlClass} w-full min-w-0`}
                    value={draft.savedViewId ?? ''}
                    onChange={(e) => {
                      const saved = savedViews?.find((v) => v.id === Number(e.target.value))
                      patch({
                        savedViewId: saved?.id,
                        filterB: saved?.view.queryFilter,
                        labelB: saved?.label ?? 'Saved view',
                      })
                    }}
                    data-qqq-id="compare-saved-view"
                  >
                    <option value="">Choose a saved view</option>
                    {savedViews?.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {draft.sideB === 'edit' && (
                <button
                  type="button"
                  className={controlClass}
                  onClick={() => {
                    setEditedFilter(normalizeFilter(draft.filterB ?? {}))
                    setEditing(true)
                  }}
                  data-qqq-id="compare-edit-filter"
                >
                  Edit filter B
                </button>
              )}
            </div>
          </div>
        )}
        {(view === 'compare' || view === 'correlation') && (
          <fieldset className="min-w-0">
            <legend className="mb-2 font-medium">
              {view === 'correlation' ? 'Numeric fields (2–12)' : 'Fields'}
            </legend>
            <div className="grid grid-cols-1 gap-2 min-[900px]:grid-cols-3">
              {(view === 'correlation' ? numeric : fields).map(
                (f) =>
                  f?.name && (
                    <label className="flex min-w-0 items-start gap-2" key={f.name}>
                      <input
                        type="checkbox"
                        checked={draft.fields?.includes(f.name) ?? false}
                        onChange={(e) =>
                          patch({
                            fields: e.target.checked
                              ? [...(draft.fields ?? []), f.name!]
                              : draft.fields?.filter((n) => n !== f.name),
                          })
                        }
                        data-qqq-id={`explore-field-${f.name}`}
                      />
                      <span>{f.label ?? 'Unlabeled field'}</span>
                    </label>
                  )
              )}
            </div>
          </fieldset>
        )}
        {view === 'crosstab' && (
          <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
            {select('Row field', 'rowField', categories)}
            {select('Column field', 'columnField', categories)}
          </div>
        )}
        {view === 'shift' && (
          <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-3">
            {select('Field', 'field', fields)}
            {select('Date field', 'dateField', dates)}
            <label className="flex min-w-0 flex-col gap-1">
              Bucket
              <select
                aria-label="Bucket"
                className={controlClass}
                value={draft.bucket}
                onChange={(e) => patch({ bucket: e.target.value as ExploreLayout['bucket'] })}
                data-qqq-id="shift-bucket"
              >
                {SHIFT_BUCKETS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {validation && <p role="status">{validation}</p>}
        <button
          type="submit"
          className={controlClass}
          disabled={Boolean(validation || scopeError) || result.isFetching}
          data-qqq-id="explore-run"
        >
          Run
        </button>
      </form>
      <Dialog.Root open={editing} onOpenChange={setEditing}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[170] bg-black/40" />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 z-[180] max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded border border-border bg-background p-4 text-foreground"
            data-qqq-id="compare-filter-dialog"
          >
            <Dialog.Title className="font-semibold">Edit filter B</Dialog.Title>
            <Dialog.Description>Choose the records in population B.</Dialog.Description>
            <FilterBuilder
              tableMetaData={tableMetaData}
              filter={editedFilter}
              onChange={setEditedFilter}
            />
            <button
              type="button"
              className={controlClass}
              onClick={() => {
                patch({ filterB: editedFilter })
                setEditing(false)
              }}
              data-qqq-id="compare-filter-apply"
            >
              Apply filter B
            </button>
            <Dialog.Close className={controlClass} data-qqq-id="compare-filter-cancel">
              Cancel
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {urlError && <p role="alert">{urlError}</p>}
      {scopeError || initialError ? (
        <ProfileError error={scopeError ?? new Error(initialError!)} />
      ) : result.error ? (
        <ProfileError
          error={result.error}
          retry={() => {
            void result.refetch()
          }}
        />
      ) : initial && result.isFetching ? (
        <ProfileLoading />
      ) : result.data ? (
        <>
          {definition && (
            <AnalysisActions
              definition={definition}
              tableName={tableName}
              sqlAvailable={sqlAvailable}
              chartKind={
                view === 'shift'
                  ? result.data.shift?.chart?.kind
                  : view === 'compare'
                    ? result.data.compare?.fields?.find((f) => f?.chart)?.chart?.kind
                    : view === 'correlation'
                      ? 'HEATMAP'
                      : null
              }
            />
          )}
          {result.data.compare && <CompareResult result={result.data.compare} fields={fields} />}{' '}
          {result.data.correlation && (
            <CorrelationResult
              key={JSON.stringify(requestFilter)}
              result={result.data.correlation}
              fields={fields}
              tableName={tableName}
            />
          )}{' '}
          {result.data.crosstab && <CrosstabResult result={result.data.crosstab} />}{' '}
          {result.data.shift && <ShiftResult result={result.data.shift} />}
        </>
      ) : (
        <p>Choose fields, then Run to explore these records.</p>
      )}
    </section>
  )
}
