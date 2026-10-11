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
 * @file SqlWorkbenchWidget — the qbit-sql-workbench app's `SQL_WORKBENCH` widget: notebook
 * library (mine / shared), execution history, and the notebook editor. Its data comes from the
 * permission-checked `/qqq/v1/sql-workbench` endpoints (as the ESB overview widget reads the ESB
 * endpoints); the open notebook is kept in the URL (`?notebook=<id>`). Loaded lazily by
 * WidgetRenderer, so CodeMirror and the formatter are only downloaded here.
 */

'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import type { QWidgetMetaData, SqlHistoryEntry } from '@/types'
import {
  getSqlHistory,
  getSqlWorkbenchCapabilities,
  listSqlNotebooks,
} from '@/lib/api/sql-workbench'
import { HANDLES_OWN_ERRORS, queryKeys } from '@/lib/query-client'
import { getErrorMessage } from '@/lib/utils/error-utils'
import { formatDuration } from '@/lib/utils/sql-workbench'
import { cn } from '@/lib/utils/cn'
import { NotebookEditor, type InsertCellRequest } from './NotebookEditor'

/**
 * The notebook id in the page URL.
 *
 * @returns The id, or null.
 */
function notebookFromUrl(): number | null {
  if (typeof window === 'undefined') return null
  const id = Number(new URLSearchParams(window.location.search).get('notebook'))
  return Number.isInteger(id) && id > 0 ? id : null
}

/**
 * Renders the workbench.
 *
 * @param props - Component props.
 * @param props.widgetMetaData - The widget's metadata, for `data-qqq-id` scoping.
 * @returns The workbench, or a loading / unavailable state.
 */
export default function SqlWorkbenchWidget({
  widgetMetaData,
}: {
  widgetMetaData: QWidgetMetaData
}) {
  const [notebookId, setNotebookId] = useState<number | null>(notebookFromUrl)
  const [scope, setScope] = useState<'mine' | 'shared'>('mine')
  const [insertRequest, setInsertRequest] = useState<InsertCellRequest | null>(null)

  const {
    data: capabilities,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.sqlWorkbenchCapabilities(),
    queryFn: getSqlWorkbenchCapabilities,
    meta: HANDLES_OWN_ERRORS,
  })
  const { data: notebooks = [], isLoading: notebooksLoading } = useQuery({
    queryKey: queryKeys.sqlNotebooks(scope),
    queryFn: () => listSqlNotebooks(scope),
    enabled: !!capabilities,
    meta: HANDLES_OWN_ERRORS,
  })
  const { data: history = [] } = useQuery({
    queryKey: queryKeys.sqlHistory(),
    queryFn: () => getSqlHistory(20),
    enabled: !!capabilities,
    meta: HANDLES_OWN_ERRORS,
  })

  const select = (id: number | null) => {
    setNotebookId(id)
    const url = new URL(window.location.href)
    if (id === null) url.searchParams.delete('notebook')
    else url.searchParams.set('notebook', String(id))
    window.history.replaceState(window.history.state, '', url)
  }

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Loading SQL Workbench…
      </p>
    )
  }
  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        Failed to load the SQL Workbench: {getErrorMessage(error)}
      </p>
    )
  }
  if (!capabilities) {
    return (
      <p className="text-sm text-muted-foreground">
        The SQL Workbench is not available to you on this server.
      </p>
    )
  }
  if (capabilities.backends.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No SQL backends are configured for the workbench.
      </p>
    )
  }

  const openFromHistory = (entry: SqlHistoryEntry) =>
    setInsertRequest({ sql: entry.sqlText, backendName: entry.backendName, nonce: Date.now() })

  return (
    <div
      className="grid gap-4 lg:grid-cols-[16rem_1fr]"
      data-qqq-id={`widget-${widgetMetaData.name}`}
    >
      <div className="space-y-4">
        <nav aria-label="Notebooks" className="space-y-2">
          <div className="flex gap-1 text-xs" role="tablist" aria-label="Notebook library">
            {(['mine', 'shared'] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={scope === s}
                className={cn(
                  'rounded px-2 py-1',
                  scope === s ? 'bg-muted font-medium' : 'text-muted-foreground'
                )}
                onClick={() => setScope(s)}
                data-qqq-id={`tab-sql-notebooks-${s}`}
              >
                {s === 'mine' ? 'My notebooks' : 'Shared library'}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="w-full rounded border px-2 py-1 text-left text-sm"
            onClick={() => select(null)}
            data-qqq-id="button-sql-new-notebook"
          >
            + New notebook
          </button>
          {notebooksLoading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : notebooks.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {scope === 'mine' ? 'No notebooks yet.' : 'Nothing has been shared yet.'}
            </p>
          ) : (
            <ul className="space-y-0.5 text-sm">
              {notebooks.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={cn(
                      'w-full truncate rounded px-2 py-1 text-left hover:bg-muted',
                      n.id === notebookId && 'bg-muted font-medium'
                    )}
                    onClick={() => select(n.id)}
                    aria-current={n.id === notebookId ? 'page' : undefined}
                    title={n.description ?? n.title}
                    data-qqq-id={`button-sql-notebook-${n.id}`}
                  >
                    {n.title}
                    {n.visibility === 'SHARED' && scope === 'mine' && (
                      <span className="ml-1 text-xs text-muted-foreground">(shared)</span>
                    )}
                    {scope === 'shared' && (
                      <span className="block text-xs text-muted-foreground">{n.ownerName}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>
        <section aria-label="History" className="space-y-1">
          <h3 className="text-xs font-medium text-muted-foreground">Recent runs</h3>
          <ul className="space-y-0.5 text-xs">
            {history.map((h) => (
              <li key={h.executionUuid}>
                <button
                  type="button"
                  className="w-full rounded px-1 py-0.5 text-left hover:bg-muted"
                  onClick={() => openFromHistory(h)}
                  title={`${h.mode} ${h.status} — add as a new cell`}
                  data-qqq-id={`button-sql-history-${h.executionUuid}`}
                >
                  <span
                    className={cn(
                      'mr-1',
                      h.status === 'SUCCEEDED' ? 'text-emerald-600' : 'text-destructive'
                    )}
                  >
                    {h.status === 'SUCCEEDED' ? '✓' : '✗'}
                  </span>
                  <span className="font-mono">{h.sqlText.slice(0, 60)}</span>
                  <span className="ml-1 text-muted-foreground">{formatDuration(h.durationMs)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div className="min-w-0">
        <NotebookEditor
          notebookId={notebookId}
          capabilities={capabilities}
          insertRequest={insertRequest}
          onSelect={select}
        />
      </div>
    </div>
  )
}
