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

import React, { useCallback, useState } from 'react'
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
import { WorkbenchTabs } from './WorkbenchTabs'
import { CheckCircle2, Loader2, Plus, XCircle } from 'lucide-react'
import { DateTimeText } from '@/components/ui/DateTimeText'
import { ALERT_CLASS, buttonClass } from '@/components/ui/controls'

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
  const clearInsertRequest = useCallback(() => setInsertRequest(null), [])
  const libraryId = React.useId()

  const {
    data: capabilities,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.sqlWorkbenchCapabilities(),
    queryFn: getSqlWorkbenchCapabilities,
    meta: HANDLES_OWN_ERRORS,
  })
  const {
    data: notebooks = [],
    isLoading: notebooksLoading,
    error: notebooksError,
  } = useQuery({
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
      <p className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading SQL Workbench…
      </p>
    )
  }
  if (error) {
    return (
      <p className={ALERT_CLASS} role="alert">
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

  // One column until the widget is wide enough for a readable notebook beside the library (a
  // container query, so the app sidebar and the surrounding layout count): the library, then the
  // notebook, then the recent runs.
  return (
    <div className="@container" data-qqq-id={`widget-${widgetMetaData.name}`}>
      <div className="grid items-start gap-6 [grid-template-areas:'library'_'notebook'_'history'] @5xl:grid-cols-[17rem_minmax(0,1fr)] @5xl:grid-rows-[auto_1fr] @5xl:[grid-template-areas:'library_notebook'_'history_notebook']">
        <nav aria-label="Notebooks" className="min-w-0 space-y-3 [grid-area:library]">
          <WorkbenchTabs
            label="Notebook library"
            idBase={libraryId}
            value={scope}
            onChange={setScope}
            tabs={[
              { value: 'mine', label: 'My notebooks', qqqId: 'tab-sql-notebooks-mine' },
              { value: 'shared', label: 'Shared library', qqqId: 'tab-sql-notebooks-shared' },
            ]}
          />
          <button
            type="button"
            className={cn(buttonClass('secondary', 'md'), 'w-full')}
            onClick={() => select(null)}
            data-qqq-id="button-sql-new-notebook"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New notebook
          </button>
          <div
            role="tabpanel"
            id={`${libraryId}-panel`}
            aria-labelledby={`${libraryId}-tab-${scope}`}
          >
            {notebooksLoading ? (
              <p className="text-sm text-muted-foreground" role="status">
                Loading notebooks…
              </p>
            ) : notebooksError ? (
              <p className={ALERT_CLASS} role="alert">
                Could not load notebooks: {getErrorMessage(notebooksError)}
              </p>
            ) : notebooks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {scope === 'mine' ? 'No notebooks yet.' : 'Nothing has been shared yet.'}
              </p>
            ) : (
              <ul className="space-y-1">
                {notebooks.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={cn(
                        'block w-full rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        n.id === notebookId ? 'bg-primary/10 font-medium' : 'hover:bg-accent'
                      )}
                      onClick={() => select(n.id)}
                      aria-current={n.id === notebookId ? 'page' : undefined}
                      title={n.description ?? n.title}
                      data-qqq-id={`button-sql-notebook-${n.id}`}
                    >
                      <span className="block break-words">{n.title}</span>
                      {n.visibility === 'SHARED' && scope === 'mine' && (
                        <span className="block text-xs font-normal text-muted-foreground">
                          Shared
                        </span>
                      )}
                      {scope === 'shared' && (
                        <span className="block text-xs font-normal text-muted-foreground">
                          {n.ownerName}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </nav>
        <div className="min-w-0 [grid-area:notebook]">
          <NotebookEditor
            notebookId={notebookId}
            capabilities={capabilities}
            insertRequest={insertRequest}
            onInsertConsumed={clearInsertRequest}
            onSelect={select}
          />
        </div>
        <section
          aria-labelledby="sql-history-heading"
          className="min-w-0 space-y-2 [grid-area:history]"
        >
          <h3 id="sql-history-heading" className="text-sm font-semibold text-foreground">
            Recent runs
          </h3>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet.</p>
          ) : (
            <ul className="space-y-1">
              {history.map((h) => (
                <li key={h.executionUuid}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => openFromHistory(h)}
                    title="Add as a new cell"
                    data-qqq-id={`button-sql-history-${h.executionUuid}`}
                  >
                    {h.status === 'SUCCEEDED' ? (
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400"
                        aria-label="Succeeded"
                      />
                    ) : (
                      <XCircle
                        className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
                        aria-label="Failed"
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 break-all font-mono text-xs text-foreground">
                        {h.sqlText}
                      </span>
                      <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                        {h.startTime && (
                          <DateTimeText
                            value={h.startTime}
                            type="DATE_TIME"
                            relative
                            className="text-xs text-muted-foreground"
                          />
                        )}
                        <span>{formatDuration(h.durationMs)}</span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
