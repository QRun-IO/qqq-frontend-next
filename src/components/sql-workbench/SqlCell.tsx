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

/**
 * @file SqlCell — one SQL cell of a notebook: backend and mode, the editor, Run / Cancel /
 * Explain / Format, and the result as a grid, a quick chart or a plan. Write mode runs the
 * two-step protocol: a preview (rolled-back dry run) opens {@link WriteConfirmDialog}, and only
 * its confirmation commits.
 */

'use client'

import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Loader2, Lock, Pin, Play, Square, WrapText } from 'lucide-react'
import { toast } from 'sonner'

import type {
  SqlExecuteResponse,
  SqlExplainResponse,
  SqlNotebookCell,
  SqlResultSnapshot,
  SqlWorkbenchCapabilities,
} from '@/types'
import {
  cancelSqlExecution,
  createSqlSnapshot,
  executeSql,
  explainSql,
  getSqlSchema,
} from '@/lib/api/sql-workbench'
import { HANDLES_OWN_ERRORS, queryKeys } from '@/lib/query-client'
import { getErrorMessage } from '@/lib/utils/error-utils'
import { formatDuration, newCellKey } from '@/lib/utils/sql-workbench'
import { cn } from '@/lib/utils/cn'
import {
  ALERT_CLASS,
  BADGE_CLASS,
  buttonClass,
  CARD_CLASS,
  CHECKBOX_CLASS,
  SELECT_CLASS,
  WARNING_CLASS,
} from '@/components/ui/controls'
import { DateTimeText } from '@/components/ui/DateTimeText'
import { PlanTree } from './PlanTree'
import { QuickChart } from './QuickChart'
import { ResultGrid } from './ResultGrid'
import { SqlEditor } from './SqlEditor'
import { WorkbenchTabs } from './WorkbenchTabs'
import { WriteConfirmDialog } from './WriteConfirmDialog'

/** The result views of a cell. */
type ResultTab = 'grid' | 'chart' | 'plan'

/** Props for {@link SqlCell}. */
export interface SqlCellProps {
  cell: SqlNotebookCell
  index: number
  capabilities: SqlWorkbenchCapabilities
  defaultBackendName: string
  /** Parameter values for this run, by name (already typed). */
  paramsFor: (sql: string) => Record<string, string | number | boolean | null>
  notebookId: number | null
  canEdit: boolean
  /** Cell controls (move, delete) shown in the header. */
  actions?: React.ReactNode
  snapshots: SqlResultSnapshot[]
  onChange: (cell: SqlNotebookCell) => void
  onSnapshotsChanged: () => void
}

/**
 * Renders a SQL cell.
 *
 * @param props - Component props.
 * @returns The cell.
 */
export function SqlCell(props: SqlCellProps) {
  const {
    cell,
    index,
    capabilities,
    defaultBackendName,
    paramsFor,
    notebookId,
    canEdit,
    actions,
    snapshots,
    onChange,
    onSnapshotsChanged,
  } = props
  const queryClient = useQueryClient()
  const backendName = cell.backendName || defaultBackendName
  const backend = capabilities.backends.find((b) => b.name === backendName)
  const [writeMode, setWriteMode] = useState(false)
  const [runningUuid, setRunningUuid] = useState<string | null>(null)
  const [result, setResult] = useState<SqlExecuteResponse | null>(null)
  const [explain, setExplain] = useState<SqlExplainResponse | null>(null)
  const [preview, setPreview] = useState<SqlExecuteResponse | null>(null)
  const [committing, setCommitting] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [tab, setTab] = useState<ResultTab>('grid')
  const resultsId = React.useId()

  const { data: schema } = useQuery({
    queryKey: queryKeys.sqlWorkbenchSchema(backendName),
    queryFn: () => getSqlSchema(backendName),
    enabled: !!backend,
    staleTime: 5 * 60_000,
    meta: HANDLES_OWN_ERRORS,
  })

  const afterRun = () => queryClient.invalidateQueries({ queryKey: queryKeys.sqlHistory() })

  const run = async () => {
    if (!backend || runningUuid || !cell.content.trim()) return
    const executionUuid = newCellKey()
    setRunningUuid(executionUuid)
    setRequestError(null)
    try {
      const response = await executeSql({
        backendName,
        sql: cell.content,
        params: paramsFor(cell.content),
        mode: writeMode ? 'WRITE' : 'READ_ONLY',
        notebookId: notebookId ?? undefined,
        cellKey: cell.cellKey,
        executionUuid,
      })
      if (response.status === 'PREVIEW') {
        setPreview(response)
      } else {
        setResult(response)
        setTab('grid')
      }
    } catch (error) {
      setRequestError(getErrorMessage(error))
    } finally {
      setRunningUuid(null)
      void afterRun()
    }
  }

  const commit = async (acknowledgeRowGuard: boolean) => {
    if (!preview?.confirmToken) return
    setCommitting(true)
    try {
      const response = await executeSql({
        backendName,
        sql: cell.content,
        params: paramsFor(cell.content),
        mode: 'WRITE',
        notebookId: notebookId ?? undefined,
        cellKey: cell.cellKey,
        confirmToken: preview.confirmToken,
        acknowledgeRowGuard,
      })
      setResult(response)
      setTab('grid')
      if (response.status === 'SUCCEEDED')
        toast.success(`Committed: ${response.rowsAffected ?? 0} rows affected`)
    } catch (error) {
      setRequestError(getErrorMessage(error))
    } finally {
      setCommitting(false)
      setPreview(null)
      void afterRun()
    }
  }

  const cancel = async () => {
    if (!runningUuid) return
    try {
      await cancelSqlExecution(runningUuid)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const runExplain = async (analyze: boolean) => {
    if (!backend || !cell.content.trim()) return
    setRequestError(null)
    try {
      setExplain(
        await explainSql({
          backendName,
          sql: cell.content,
          params: paramsFor(cell.content),
          analyze,
        })
      )
      setTab('plan')
    } catch (error) {
      setRequestError(getErrorMessage(error))
    } finally {
      void afterRun()
    }
  }

  const format = async () => {
    try {
      const { formatWorkbenchSql } = await import('@/lib/utils/sql-format')
      onChange({ ...cell, content: formatWorkbenchSql(cell.content, backend?.dialect) })
    } catch (error) {
      toast.error(`Could not format: ${getErrorMessage(error)}`)
    }
  }

  const pin = async () => {
    if (!notebookId || !result) return
    try {
      await createSqlSnapshot(notebookId, {
        executionUuid: result.executionUuid,
        cellKey: cell.cellKey,
      })
      toast.success('Result pinned')
      onSnapshotsChanged()
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const resultTabs: { value: ResultTab; label: string; qqqId: string }[] = [
    { value: 'grid', label: 'Results', qqqId: `tab-sql-grid-${index}` },
    { value: 'chart', label: 'Chart', qqqId: `tab-sql-chart-${index}` },
    { value: 'plan', label: 'Plan', qqqId: `tab-sql-plan-${index}` },
  ]

  return (
    <section
      className={cn(CARD_CLASS, 'space-y-3 p-3')}
      aria-label={`SQL cell ${index + 1}`}
      data-qqq-id={`section-sql-cell-${index}`}
    >
      <div className="flex items-center gap-2">
        <input
          className="h-8 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 text-sm font-semibold text-foreground placeholder:text-muted-foreground hover:border-input focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
          value={cell.title ?? ''}
          placeholder={`SQL cell ${index + 1}`}
          aria-label={`Title of SQL cell ${index + 1}`}
          onChange={(e) => onChange({ ...cell, title: e.target.value })}
          data-qqq-id={`input-sql-cell-title-${index}`}
        />
        {actions}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="inline-flex min-w-0 max-w-full items-center gap-2 text-sm text-foreground">
          <span className="whitespace-nowrap">Backend</span>
          <select
            className={SELECT_CLASS}
            value={backendName}
            onChange={(e) => onChange({ ...cell, backendName: e.target.value })}
            data-qqq-id={`select-sql-backend-${index}`}
          >
            {capabilities.backends.map((b) => (
              <option key={b.name} value={b.name}>
                {b.label} ({b.dialect})
              </option>
            ))}
          </select>
        </label>
        {capabilities.canWrite ? (
          <label
            className={cn(
              'inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border px-2.5 text-sm font-medium transition-colors',
              writeMode
                ? 'border-destructive/50 bg-destructive/10 text-destructive'
                : 'border-input bg-card text-foreground hover:bg-accent'
            )}
          >
            <input
              type="checkbox"
              className={CHECKBOX_CLASS}
              checked={writeMode}
              onChange={(e) => setWriteMode(e.target.checked)}
              data-qqq-id={`checkbox-sql-write-mode-${index}`}
            />
            Write mode
          </label>
        ) : (
          <span className={BADGE_CLASS}>
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            Read-only
          </span>
        )}
      </div>

      <SqlEditor
        value={cell.content}
        onChange={(content) => onChange({ ...cell, content })}
        dialect={backend?.dialect}
        schema={schema}
        onRun={run}
        label={`SQL for cell ${index + 1}`}
        qqqId={`editor-sql-cell-${index}`}
      />

      <div className="flex flex-wrap items-center gap-2">
        {runningUuid ? (
          <button
            type="button"
            className={buttonClass('secondary', 'sm')}
            onClick={cancel}
            data-qqq-id={`button-sql-cancel-${index}`}
          >
            <Square className="h-4 w-4" aria-hidden="true" />
            Cancel
          </button>
        ) : (
          <button
            type="button"
            className={buttonClass(writeMode ? 'danger' : 'primary', 'sm')}
            onClick={run}
            disabled={!backend}
            data-qqq-id={`button-sql-run-${index}`}
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            {writeMode ? 'Preview write' : 'Run'}
          </button>
        )}
        <button
          type="button"
          className={buttonClass('secondary', 'sm')}
          onClick={() => runExplain(false)}
          disabled={!backend || !!runningUuid}
          data-qqq-id={`button-sql-explain-${index}`}
        >
          Explain
        </button>
        {capabilities.canWrite && (
          <button
            type="button"
            className={buttonClass('secondary', 'sm')}
            onClick={() => runExplain(true)}
            disabled={!backend || !!runningUuid}
            title="Executes the statement in a transaction that is rolled back"
            data-qqq-id={`button-sql-explain-analyze-${index}`}
          >
            Explain analyze
          </button>
        )}
        <button
          type="button"
          className={buttonClass('ghost', 'sm')}
          onClick={format}
          data-qqq-id={`button-sql-format-${index}`}
        >
          <WrapText className="h-4 w-4" aria-hidden="true" />
          Format
        </button>
        {runningUuid && (
          <span
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
            role="status"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Running…
          </span>
        )}
      </div>

      {backend && !backend.readOnlyEnforced && !writeMode && (
        <p className={WARNING_CLASS}>
          This backend does not enforce read-only sessions; only the statement check applies.
        </p>
      )}

      {requestError && (
        <p className={ALERT_CLASS} role="alert">
          {requestError}
        </p>
      )}

      {preview && (
        <WriteConfirmDialog
          preview={preview}
          backendName={backendName}
          pending={committing}
          onConfirm={commit}
          onCancel={() => setPreview(null)}
        />
      )}

      {(result || explain) && (
        <div className="space-y-3">
          <WorkbenchTabs
            label="Result views"
            idBase={resultsId}
            value={tab}
            onChange={setTab}
            tabs={resultTabs}
          >
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
              {result && (
                <span
                  className="text-sm text-muted-foreground"
                  data-qqq-id={`text-sql-status-${index}`}
                >
                  {resultSummary(result)}
                </span>
              )}
              {result?.status === 'SUCCEEDED' &&
                notebookId &&
                canEdit &&
                (result.columns?.length ?? 0) > 0 && (
                  <button
                    type="button"
                    className={buttonClass('secondary', 'sm')}
                    onClick={pin}
                    data-qqq-id={`button-sql-pin-${index}`}
                  >
                    <Pin className="h-4 w-4" aria-hidden="true" />
                    Pin result
                  </button>
                )}
            </span>
          </WorkbenchTabs>
          <div
            role="tabpanel"
            id={`${resultsId}-panel`}
            aria-labelledby={`${resultsId}-tab-${tab}`}
          >
            {tab === 'grid' &&
              (result ? (
                <ResultView
                  key={result.executionUuid}
                  result={result}
                  pageSize={capabilities.limits.pageSize}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Run the cell to see results.</p>
              ))}
            {tab === 'chart' &&
              (result?.status === 'SUCCEEDED' ? (
                <QuickChart
                  key={result.executionUuid}
                  columns={result.columns ?? []}
                  rows={result.rows ?? []}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Run the cell to chart its results.</p>
              ))}
            {tab === 'plan' &&
              (explain ? (
                <PlanTree explain={explain} />
              ) : (
                <p className="text-sm text-muted-foreground">Use Explain to see the plan.</p>
              ))}
          </div>
        </div>
      )}

      {snapshots.length > 0 && (
        <details className="group">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            <ChevronRight
              className="h-4 w-4 transition-transform group-open:rotate-90"
              aria-hidden="true"
            />
            Pinned results ({snapshots.length})
          </summary>
          {snapshots.map((s) => (
            <div key={s.id} className="mt-3 space-y-2">
              <p className="flex flex-wrap gap-x-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{s.label ?? 'Pinned result'}</span>
                <DateTimeText
                  value={s.createDate}
                  type="DATE_TIME"
                  className="text-muted-foreground"
                />
                <span>
                  {s.rowCount} {s.rowCount === 1 ? 'row' : 'rows'}
                  {s.truncated ? ' (truncated)' : ''}
                </span>
              </p>
              <ResultGrid
                executionUuid={s.executionUuid ?? String(s.id)}
                columns={s.result.columns ?? []}
                firstPage={s.result.rows ?? []}
                rowCount={s.rowCount}
                pageSize={s.rowCount || 1}
                staticRows
              />
            </div>
          ))}
        </details>
      )}
    </section>
  )
}

/** Plain names of the run statuses. */
const STATUS_LABELS: Record<SqlExecuteResponse['status'], string> = {
  SUCCEEDED: 'Succeeded',
  FAILED: 'Failed',
  TIMED_OUT: 'Timed out',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
  PREVIEW: 'Preview',
  DRIFTED: 'Not committed',
}

/**
 * One line about a run: its status, duration, and rows returned or affected.
 *
 * @param result - The run.
 * @returns The summary.
 */
export function resultSummary(result: SqlExecuteResponse): string {
  const parts = [STATUS_LABELS[result.status] ?? result.status]
  if (result.durationMs != null) parts.push(formatDuration(result.durationMs))
  if (result.rowsAffected != null)
    parts.push(
      `${result.rowsAffected.toLocaleString()} ${result.rowsAffected === 1 ? 'row' : 'rows'} affected`
    )
  else if (
    result.status === 'SUCCEEDED' &&
    (result.columns?.length ?? 0) > 0 &&
    result.rowCount != null
  )
    parts.push(`${result.rowCount.toLocaleString()} ${result.rowCount === 1 ? 'row' : 'rows'}`)
  return parts.join(' · ')
}

/**
 * Renders a run's outcome: the grid, or the failure, drift or rejection message.
 *
 * @param props - Component props.
 * @param props.result - The run.
 * @param props.pageSize - Rows per page.
 * @returns The outcome.
 */
function ResultView({ result, pageSize }: { result: SqlExecuteResponse; pageSize: number }) {
  if (result.status === 'DRIFTED') {
    return (
      <p className={WARNING_CLASS} role="alert">
        Nothing was committed: the affected rows changed since the preview (
        {result.previewAffectedRows} → {result.actualAffectedRows}). Preview again.
      </p>
    )
  }
  if (result.status !== 'SUCCEEDED') {
    return (
      <p className={cn(ALERT_CLASS, 'font-mono')} role="alert">
        {result.status === 'TIMED_OUT'
          ? 'Timed out: '
          : result.status === 'CANCELLED'
            ? 'Cancelled: '
            : ''}
        {result.error ?? STATUS_LABELS[result.status] ?? result.status}
      </p>
    )
  }
  return (
    <ResultGrid
      executionUuid={result.executionUuid}
      columns={result.columns ?? []}
      firstPage={result.rows ?? []}
      rowCount={result.rowCount ?? 0}
      pageSize={pageSize}
      truncated={result.truncated}
      truncatedReason={result.truncatedReason}
    />
  )
}
