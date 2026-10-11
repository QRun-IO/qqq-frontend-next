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
import { PlanTree } from './PlanTree'
import { QuickChart } from './QuickChart'
import { ResultGrid } from './ResultGrid'
import { SqlEditor } from './SqlEditor'
import { WriteConfirmDialog } from './WriteConfirmDialog'

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
  const [tab, setTab] = useState<'grid' | 'chart' | 'plan'>('grid')

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

  const button = 'rounded border px-2 py-1 text-xs disabled:opacity-50'

  return (
    <section
      className="space-y-2 rounded-md border p-3"
      aria-label={`SQL cell ${index + 1}`}
      data-qqq-id={`section-sql-cell-${index}`}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <input
          className="min-w-0 flex-1 rounded border-transparent bg-transparent px-1 py-0.5 text-sm font-medium hover:border-border focus:border-border"
          value={cell.title ?? ''}
          placeholder={`SQL cell ${index + 1}`}
          aria-label={`Title of SQL cell ${index + 1}`}
          onChange={(e) => onChange({ ...cell, title: e.target.value })}
          data-qqq-id={`input-sql-cell-title-${index}`}
        />
        <label className="inline-flex items-center gap-1">
          Backend
          <select
            className="rounded border px-1 py-0.5"
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
              'inline-flex items-center gap-1 rounded px-1.5 py-0.5',
              writeMode ? 'bg-destructive/15 text-destructive' : 'bg-muted'
            )}
          >
            <input
              type="checkbox"
              checked={writeMode}
              onChange={(e) => setWriteMode(e.target.checked)}
              data-qqq-id={`checkbox-sql-write-mode-${index}`}
            />
            Write mode
          </label>
        ) : (
          <span className="rounded bg-muted px-1.5 py-0.5">Read-only</span>
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
            className={button}
            onClick={cancel}
            data-qqq-id={`button-sql-cancel-${index}`}
          >
            Cancel
          </button>
        ) : (
          <button
            type="button"
            className={cn(button, 'bg-primary text-primary-foreground')}
            onClick={run}
            disabled={!backend}
            data-qqq-id={`button-sql-run-${index}`}
          >
            {writeMode ? 'Preview write' : 'Run'}
          </button>
        )}
        <button
          type="button"
          className={button}
          onClick={() => runExplain(false)}
          disabled={!backend || !!runningUuid}
          data-qqq-id={`button-sql-explain-${index}`}
        >
          Explain
        </button>
        {capabilities.canWrite && (
          <button
            type="button"
            className={button}
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
          className={button}
          onClick={format}
          data-qqq-id={`button-sql-format-${index}`}
        >
          Format
        </button>
        {runningUuid && (
          <span className="text-xs text-muted-foreground" role="status">
            Running…
          </span>
        )}
        {backend && !backend.readOnlyEnforced && !writeMode && (
          <span className="text-xs text-amber-600">
            This backend does not enforce read-only sessions; only the statement check applies.
          </span>
        )}
      </div>

      {requestError && (
        <p className="text-sm text-destructive" role="alert">
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
        <div className="space-y-2">
          <div className="flex items-center gap-1 text-xs" role="tablist" aria-label="Result views">
            {(['grid', 'chart', 'plan'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                className={cn(
                  'rounded px-2 py-0.5',
                  tab === t ? 'bg-muted font-medium' : 'text-muted-foreground'
                )}
                onClick={() => setTab(t)}
                data-qqq-id={`tab-sql-${t}-${index}`}
              >
                {t === 'grid' ? 'Grid' : t === 'chart' ? 'Chart' : 'Plan'}
              </button>
            ))}
            {result && (
              <span className="ml-2 text-muted-foreground">
                {result.status}
                {result.durationMs != null && ` · ${formatDuration(result.durationMs)}`}
                {result.rowsAffected != null && ` · ${result.rowsAffected} rows affected`}
              </span>
            )}
            {result?.status === 'SUCCEEDED' &&
              notebookId &&
              canEdit &&
              (result.columns?.length ?? 0) > 0 && (
                <button
                  type="button"
                  className={cn(button, 'ml-auto')}
                  onClick={pin}
                  data-qqq-id={`button-sql-pin-${index}`}
                >
                  Pin result
                </button>
              )}
          </div>
          {tab === 'grid' && result && (
            <ResultView
              key={result.executionUuid}
              result={result}
              pageSize={capabilities.limits.pageSize}
            />
          )}
          {tab === 'chart' && result?.status === 'SUCCEEDED' && (
            <QuickChart
              key={result.executionUuid}
              columns={result.columns ?? []}
              rows={result.rows ?? []}
            />
          )}
          {tab === 'plan' &&
            (explain ? (
              <PlanTree explain={explain} />
            ) : (
              <p className="text-sm text-muted-foreground">Use Explain to see the plan.</p>
            ))}
        </div>
      )}

      {snapshots.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs text-muted-foreground">
            Pinned results ({snapshots.length})
          </summary>
          {snapshots.map((s) => (
            <div key={s.id} className="mt-2 space-y-1">
              <p className="text-xs text-muted-foreground">
                {s.label ?? 'Snapshot'} · {s.createDate ?? ''} · {s.rowCount} rows
                {s.truncated ? ' (truncated)' : ''}
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
      <p className="text-sm text-amber-700" role="alert">
        Nothing was committed: the affected rows changed since the preview (
        {result.previewAffectedRows} → {result.actualAffectedRows}). Preview again.
      </p>
    )
  }
  if (result.status !== 'SUCCEEDED') {
    return (
      <p className="whitespace-pre-wrap text-sm text-destructive" role="alert">
        {result.status === 'TIMED_OUT'
          ? 'Timed out: '
          : result.status === 'CANCELLED'
            ? 'Cancelled: '
            : ''}
        {result.error ?? result.status}
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
