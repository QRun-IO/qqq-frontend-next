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
 * @file NotebookEditor — one notebook: title, default backend, :parameters, ordered SQL and
 * markdown cells, save (each save is a version), publish to the shared library, duplicate,
 * delete, and the version history with restore. With no notebook id it edits an unsaved
 * scratch notebook that Save creates.
 */

'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import type {
  SqlNotebook,
  SqlNotebookCell,
  SqlNotebookInput,
  SqlNotebookParameter,
  SqlWorkbenchCapabilities,
} from '@/types'
import {
  createSqlNotebook,
  deleteSqlNotebook,
  duplicateSqlNotebook,
  getSqlNotebook,
  listSqlNotebookVersions,
  listSqlSnapshots,
  publishSqlNotebook,
  restoreSqlNotebookVersion,
  saveSqlNotebook,
} from '@/lib/api/sql-workbench'
import { HANDLES_OWN_ERRORS, queryKeys } from '@/lib/query-client'
import { getErrorMessage } from '@/lib/utils/error-utils'
import { coerceParameterValue, extractSqlParameters, newCellKey } from '@/lib/utils/sql-workbench'
import { MarkdownView } from './MarkdownView'
import { SqlCell } from './SqlCell'

/** A request to add a cell (e.g. from history). */
export interface InsertCellRequest {
  sql: string
  backendName: string
  nonce: number
}

/** Props for {@link NotebookEditor}. */
export interface NotebookEditorProps {
  notebookId: number | null
  capabilities: SqlWorkbenchCapabilities
  insertRequest: InsertCellRequest | null
  onSelect: (id: number | null) => void
}

const PARAMETER_TYPES: NonNullable<SqlNotebookParameter['type']>[] = [
  'STRING',
  'INTEGER',
  'DECIMAL',
  'BOOLEAN',
  'DATE',
  'DATE_TIME',
]

/**
 * Loads the notebook (when saved) and renders its editor.
 *
 * @param props - Component props.
 * @returns The editor, or a loading / error state.
 */
export function NotebookEditor(props: NotebookEditorProps) {
  const { notebookId, capabilities } = props
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.sqlNotebook(notebookId ?? -1),
    queryFn: () => getSqlNotebook(notebookId!),
    enabled: notebookId !== null,
    meta: HANDLES_OWN_ERRORS,
  })

  if (notebookId !== null && isLoading) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Loading notebook…
      </p>
    )
  }
  if (notebookId !== null && (error || !data)) {
    return (
      <p className="text-sm text-destructive" role="alert">
        Could not open the notebook: {getErrorMessage(error, 'not found')}
      </p>
    )
  }

  const notebook: SqlNotebook = data ?? {
    id: -1,
    title: 'Untitled notebook',
    description: null,
    visibility: 'PERSONAL',
    ownerUserId: '',
    ownerName: null,
    defaultBackendName: capabilities.backends[0]?.name ?? null,
    currentVersion: 0,
    canEdit: true,
    createDate: null,
    modifyDate: null,
    parameters: [],
    cells: [
      { cellKey: newCellKey(), cellType: 'SQL', content: '', title: null, backendName: null },
    ],
  }
  return (
    <NotebookDraft
      key={`${notebookId ?? 'new'}-${notebook.currentVersion}`}
      {...props}
      notebook={notebook}
      saved={notebookId !== null}
    />
  )
}

/**
 * The editable draft of a notebook.
 *
 * @param props - Component props.
 * @param props.notebook - The loaded (or blank) notebook.
 * @param props.saved - Whether it exists on the server.
 * @returns The editor.
 */
function NotebookDraft(props: NotebookEditorProps & { notebook: SqlNotebook; saved: boolean }) {
  const { notebook, saved, capabilities, insertRequest, onSelect } = props
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(notebook.title)
  const [defaultBackendName, setDefaultBackendName] = useState(
    notebook.defaultBackendName ?? capabilities.backends[0]?.name ?? ''
  )
  const [cells, setCells] = useState<SqlNotebookCell[]>(notebook.cells)
  const [parameters, setParameters] = useState<SqlNotebookParameter[]>(notebook.parameters ?? [])
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries((notebook.parameters ?? []).map((p) => [p.name, p.defaultValue ?? '']))
  )
  const [dirty, setDirty] = useState(!saved)
  const [saving, setSaving] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  const [previewing, setPreviewing] = useState<Record<string, boolean>>({})
  const canEdit = notebook.canEdit

  useEffect(() => {
    if (!insertRequest) return
    setCells((current) => [
      ...current,
      {
        cellKey: newCellKey(),
        cellType: 'SQL',
        content: insertRequest.sql,
        backendName: insertRequest.backendName,
        title: null,
      },
    ])
    setDirty(true)
  }, [insertRequest])

  const { data: snapshots = [] } = useQuery({
    queryKey: queryKeys.sqlNotebookSnapshots(notebook.id),
    queryFn: () => listSqlSnapshots(notebook.id),
    enabled: saved,
    meta: HANDLES_OWN_ERRORS,
  })

  const { data: versions = [] } = useQuery({
    queryKey: queryKeys.sqlNotebookVersions(notebook.id),
    queryFn: () => listSqlNotebookVersions(notebook.id),
    enabled: saved && showVersions,
    meta: HANDLES_OWN_ERRORS,
  })

  const parameterNames = useMemo(() => {
    const names = parameters.map((p) => p.name)
    for (const cell of cells) {
      if (cell.cellType === 'SQL')
        for (const name of extractSqlParameters(cell.content))
          if (!names.includes(name)) names.push(name)
    }
    return names
  }, [cells, parameters])

  const paramsFor = (sql: string) =>
    Object.fromEntries(
      extractSqlParameters(sql).map((name) => [
        name,
        coerceParameterValue(values[name], parameters.find((p) => p.name === name)?.type),
      ])
    )

  const updateCells = (next: SqlNotebookCell[]) => {
    setCells(next)
    setDirty(true)
  }

  const setParameterType = (name: string, type: SqlNotebookParameter['type']) => {
    const existing = parameters.find((p) => p.name === name)
    setParameters(
      existing
        ? parameters.map((p) => (p.name === name ? { ...p, type } : p))
        : [...parameters, { name, type, defaultValue: values[name] ?? null }]
    )
    setDirty(true)
  }

  const input = (): SqlNotebookInput => ({
    title: title.trim() || 'Untitled notebook',
    defaultBackendName,
    parameters: parameterNames.map((name) => ({
      name,
      type: parameters.find((p) => p.name === name)?.type ?? 'STRING',
      defaultValue: values[name] ?? null,
    })),
    cells: cells.map((c, i) => ({ ...c, sortOrder: i })),
  })

  const refreshLists = () => {
    void queryClient.invalidateQueries({ queryKey: [...queryKeys.sqlWorkbench(), 'notebooks'] })
  }

  const save = async () => {
    setSaving(true)
    try {
      const result = saved
        ? await saveSqlNotebook(notebook.id, input())
        : await createSqlNotebook(input())
      queryClient.setQueryData(queryKeys.sqlNotebook(result.id), result)
      void queryClient.invalidateQueries({ queryKey: queryKeys.sqlNotebookVersions(result.id) })
      refreshLists()
      setDirty(false)
      toast.success(`Saved version ${result.currentVersion}`)
      if (!saved) onSelect(result.id)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const act = async (
    action: () => Promise<SqlNotebook | void>,
    message: string,
    select?: (n: SqlNotebook | void) => number | null
  ) => {
    try {
      const result = await action()
      if (result) queryClient.setQueryData(queryKeys.sqlNotebook(result.id), result)
      refreshLists()
      toast.success(message)
      if (select) onSelect(select(result))
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const move = (index: number, delta: number) => {
    const next = [...cells]
    const [cell] = next.splice(index, 1)
    next.splice(index + delta, 0, cell)
    updateCells(next)
  }

  const button = 'rounded border px-2 py-1 text-xs disabled:opacity-50'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="min-w-0 flex-1 rounded border px-2 py-1 text-base font-semibold"
          value={title}
          aria-label="Notebook title"
          onChange={(e) => {
            setTitle(e.target.value)
            setDirty(true)
          }}
          readOnly={!canEdit}
          data-qqq-id="input-sql-notebook-title"
        />
        <label className="inline-flex items-center gap-1 text-xs">
          Default backend
          <select
            className="rounded border px-1 py-0.5"
            value={defaultBackendName}
            onChange={(e) => {
              setDefaultBackendName(e.target.value)
              setDirty(true)
            }}
            data-qqq-id="select-sql-notebook-backend"
          >
            {capabilities.backends.map((b) => (
              <option key={b.name} value={b.name}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        {canEdit && (
          <button
            type="button"
            className={`${button} bg-primary text-primary-foreground`}
            onClick={save}
            disabled={saving || !dirty}
            data-qqq-id="button-sql-notebook-save"
          >
            {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </button>
        )}
        {saved && canEdit && capabilities.canShare && (
          <button
            type="button"
            className={button}
            onClick={() =>
              act(
                () => publishSqlNotebook(notebook.id, notebook.visibility !== 'SHARED'),
                notebook.visibility === 'SHARED'
                  ? 'Removed from the library'
                  : 'Published to the library'
              )
            }
            data-qqq-id="button-sql-notebook-publish"
          >
            {notebook.visibility === 'SHARED' ? 'Unpublish' : 'Publish'}
          </button>
        )}
        {saved && (
          <button
            type="button"
            className={button}
            onClick={() =>
              act(
                () => duplicateSqlNotebook(notebook.id),
                'Copied to your notebooks',
                (n) => (n ? n.id : null)
              )
            }
            data-qqq-id="button-sql-notebook-duplicate"
          >
            Duplicate
          </button>
        )}
        {saved && (
          <button
            type="button"
            className={button}
            onClick={() => setShowVersions(!showVersions)}
            aria-expanded={showVersions}
            data-qqq-id="button-sql-notebook-versions"
          >
            Versions
          </button>
        )}
        {saved && canEdit && (
          <button
            type="button"
            className={`${button} text-destructive`}
            onClick={() => {
              if (window.confirm(`Delete “${notebook.title}” and its versions?`))
                void act(
                  () => deleteSqlNotebook(notebook.id),
                  'Notebook deleted',
                  () => null
                )
            }}
            data-qqq-id="button-sql-notebook-delete"
          >
            Delete
          </button>
        )}
      </div>
      {!canEdit && (
        <p className="text-xs text-muted-foreground">
          Shared by {notebook.ownerName ?? notebook.ownerUserId}. You can run it; duplicate it to
          keep changes.
        </p>
      )}

      {showVersions && (
        <ul className="space-y-1 rounded-md border p-2 text-xs" aria-label="Versions">
          {versions.map((v) => (
            <li key={v.versionNumber} className="flex items-center gap-2">
              <span className="font-mono">v{v.versionNumber}</span>
              <span>{v.savedByName}</span>
              <span className="text-muted-foreground">{v.createDate}</span>
              {v.comment && <span className="truncate">{v.comment}</span>}
              {canEdit && v.versionNumber !== notebook.currentVersion && (
                <button
                  type="button"
                  className={`${button} ml-auto`}
                  onClick={() =>
                    act(
                      () => restoreSqlNotebookVersion(notebook.id, v.versionNumber),
                      `Restored version ${v.versionNumber}`
                    )
                  }
                  data-qqq-id={`button-sql-restore-${v.versionNumber}`}
                >
                  Restore
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {parameterNames.length > 0 && (
        <fieldset className="flex flex-wrap gap-3 rounded-md border p-2 text-xs">
          <legend className="px-1 font-medium">Parameters</legend>
          {parameterNames.map((name) => {
            const type = parameters.find((p) => p.name === name)?.type ?? 'STRING'
            return (
              <span key={name} className="inline-flex items-center gap-1">
                <label className="inline-flex items-center gap-1">
                  <span className="font-mono">:{name}</span>
                  <input
                    className="w-36 rounded border px-1 py-0.5"
                    type={
                      type === 'DATE'
                        ? 'date'
                        : type === 'DATE_TIME'
                          ? 'datetime-local'
                          : type === 'INTEGER' || type === 'DECIMAL'
                            ? 'number'
                            : 'text'
                    }
                    value={values[name] ?? ''}
                    onChange={(e) => setValues({ ...values, [name]: e.target.value })}
                    data-qqq-id={`input-sql-param-${name}`}
                  />
                </label>
                <select
                  className="rounded border px-1 py-0.5"
                  value={type}
                  aria-label={`Type of :${name}`}
                  onChange={(e) =>
                    setParameterType(name, e.target.value as SqlNotebookParameter['type'])
                  }
                  data-qqq-id={`select-sql-param-type-${name}`}
                >
                  {PARAMETER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </span>
            )
          })}
        </fieldset>
      )}

      {cells.map((cell, index) => (
        <div key={cell.cellKey} className="group relative">
          <div className="absolute -right-1 -top-2 z-10 hidden gap-1 group-focus-within:flex group-hover:flex">
            <button
              type="button"
              className="rounded border bg-background p-0.5"
              onClick={() => move(index, -1)}
              disabled={index === 0}
              aria-label={`Move cell ${index + 1} up`}
              data-qqq-id={`button-sql-cell-up-${index}`}
            >
              <span aria-hidden>▲</span>
            </button>
            <button
              type="button"
              className="rounded border bg-background p-0.5"
              onClick={() => move(index, 1)}
              disabled={index === cells.length - 1}
              aria-label={`Move cell ${index + 1} down`}
              data-qqq-id={`button-sql-cell-down-${index}`}
            >
              <span aria-hidden>▼</span>
            </button>
            <button
              type="button"
              className="rounded border bg-background p-0.5 text-destructive"
              onClick={() => updateCells(cells.filter((_, i) => i !== index))}
              aria-label={`Delete cell ${index + 1}`}
              data-qqq-id={`button-sql-cell-delete-${index}`}
            >
              <span aria-hidden>✕</span>
            </button>
          </div>
          {cell.cellType === 'MARKDOWN' ? (
            <section className="rounded-md border p-3" aria-label={`Markdown cell ${index + 1}`}>
              <button
                type="button"
                className="mb-1 text-xs text-muted-foreground underline"
                onClick={() =>
                  setPreviewing({ ...previewing, [cell.cellKey]: !previewing[cell.cellKey] })
                }
                data-qqq-id={`button-sql-markdown-toggle-${index}`}
              >
                {previewing[cell.cellKey] === false ? 'Preview' : 'Edit'}
              </button>
              {previewing[cell.cellKey] === false ? (
                <textarea
                  className="block h-28 w-full rounded border p-2 font-mono text-sm"
                  value={cell.content}
                  aria-label={`Markdown for cell ${index + 1}`}
                  onChange={(e) =>
                    updateCells(
                      cells.map((c, i) => (i === index ? { ...c, content: e.target.value } : c))
                    )
                  }
                  data-qqq-id={`textarea-sql-markdown-${index}`}
                />
              ) : (
                <MarkdownView source={cell.content || '*Empty markdown cell*'} />
              )}
            </section>
          ) : (
            <SqlCell
              cell={cell}
              index={index}
              capabilities={capabilities}
              defaultBackendName={defaultBackendName}
              paramsFor={paramsFor}
              notebookId={saved ? notebook.id : null}
              canEdit={canEdit}
              snapshots={snapshots.filter((s) => s.cellKey === cell.cellKey)}
              onChange={(next) => updateCells(cells.map((c, i) => (i === index ? next : c)))}
              onSnapshotsChanged={() =>
                queryClient.invalidateQueries({
                  queryKey: queryKeys.sqlNotebookSnapshots(notebook.id),
                })
              }
            />
          )}
        </div>
      ))}

      <div className="flex gap-2">
        <button
          type="button"
          className={button}
          onClick={() =>
            updateCells([
              ...cells,
              {
                cellKey: newCellKey(),
                cellType: 'SQL',
                content: '',
                title: null,
                backendName: null,
              },
            ])
          }
          data-qqq-id="button-sql-add-sql-cell"
        >
          + SQL cell
        </button>
        <button
          type="button"
          className={button}
          onClick={() => {
            const cellKey = newCellKey()
            setPreviewing({ ...previewing, [cellKey]: false })
            updateCells([
              ...cells,
              { cellKey, cellType: 'MARKDOWN', content: '', title: null, backendName: null },
            ])
          }}
          data-qqq-id="button-sql-add-markdown-cell"
        >
          + Markdown cell
        </button>
      </div>
    </div>
  )
}
