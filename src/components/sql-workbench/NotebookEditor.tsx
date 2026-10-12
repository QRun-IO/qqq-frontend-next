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

import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Eye,
  History,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Share2,
  Trash2,
} from 'lucide-react'
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
import { cn } from '@/lib/utils/cn'
import {
  ALERT_CLASS,
  BADGE_CLASS,
  buttonClass,
  CARD_CLASS,
  iconButtonClass,
  INPUT_CLASS,
  SELECT_CLASS,
} from '@/components/ui/controls'
import { DateTimeText } from '@/components/ui/DateTimeText'
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
  /** Called once the pending insert request has been applied, so the owner can clear it. */
  onInsertConsumed: () => void
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

/** Plain labels of the parameter types. */
const PARAMETER_TYPE_LABELS: Record<NonNullable<SqlNotebookParameter['type']>, string> = {
  STRING: 'Text',
  INTEGER: 'Whole number',
  DECIMAL: 'Decimal',
  BOOLEAN: 'Yes / no',
  DATE: 'Date',
  DATE_TIME: 'Date and time',
}

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
      <p className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading notebook…
      </p>
    )
  }
  if (notebookId !== null && (error || !data)) {
    return (
      <p className={ALERT_CLASS} role="alert">
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
  const { notebook, saved, capabilities, insertRequest, onInsertConsumed, onSelect } = props
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
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const canEdit = notebook.canEdit

  // The request is parent state that outlives this draft (it remounts on save, restore,
  // duplicate and notebook switch), so apply each nonce once and hand it back to be cleared.
  const handledInsertNonce = useRef<number | null>(null)
  useEffect(() => {
    if (!insertRequest || handledInsertNonce.current === insertRequest.nonce) return
    handledInsertNonce.current = insertRequest.nonce
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
    onInsertConsumed()
  }, [insertRequest, onInsertConsumed])

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

  const addCell = (cellType: SqlNotebookCell['cellType']) => {
    const cellKey = newCellKey()
    if (cellType === 'MARKDOWN') setPreviewing({ ...previewing, [cellKey]: false })
    updateCells([...cells, { cellKey, cellType, content: '', title: null, backendName: null }])
  }

  /**
   * The move and delete buttons of a cell, shown in its header.
   *
   * @param index - The cell's position.
   * @returns The buttons, or nothing for a read-only notebook.
   */
  const cellActions = (index: number) =>
    canEdit ? (
      <span className="inline-flex items-center">
        <button
          type="button"
          className={iconButtonClass()}
          onClick={() => move(index, -1)}
          disabled={index === 0}
          aria-label={`Move cell ${index + 1} up`}
          title="Move up"
          data-qqq-id={`button-sql-cell-up-${index}`}
        >
          <ArrowUp className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={iconButtonClass()}
          onClick={() => move(index, 1)}
          disabled={index === cells.length - 1}
          aria-label={`Move cell ${index + 1} down`}
          title="Move down"
          data-qqq-id={`button-sql-cell-down-${index}`}
        >
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={iconButtonClass('destructive')}
          onClick={() => updateCells(cells.filter((_, i) => i !== index))}
          aria-label={`Delete cell ${index + 1}`}
          title="Delete cell"
          data-qqq-id={`button-sql-cell-delete-${index}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </span>
    ) : null

  return (
    <div className="@container space-y-4">
      <div className="space-y-3">
        <input
          className={cn(INPUT_CLASS, 'h-10 text-base font-semibold')}
          value={title}
          aria-label="Notebook title"
          onChange={(e) => {
            setTitle(e.target.value)
            setDirty(true)
          }}
          readOnly={!canEdit}
          data-qqq-id="input-sql-notebook-title"
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="inline-flex min-w-0 items-center gap-2 text-sm text-foreground">
            <span className="whitespace-nowrap">Default backend</span>
            <select
              className={SELECT_CLASS}
              value={defaultBackendName}
              disabled={!canEdit}
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
          <div className="flex flex-wrap items-center gap-2 @2xl:ml-auto">
            {canEdit && (
              <button
                type="button"
                className={buttonClass('primary', 'sm')}
                onClick={save}
                disabled={saving || !dirty}
                data-qqq-id="button-sql-notebook-save"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : dirty ? (
                  <Save className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Check className="h-4 w-4" aria-hidden="true" />
                )}
                {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
              </button>
            )}
            {saved && canEdit && capabilities.canShare && (
              <button
                type="button"
                className={buttonClass('secondary', 'sm')}
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
                <Share2 className="h-4 w-4" aria-hidden="true" />
                {notebook.visibility === 'SHARED' ? 'Unpublish' : 'Publish'}
              </button>
            )}
            {saved && (
              <button
                type="button"
                className={buttonClass('secondary', 'sm')}
                onClick={() =>
                  act(
                    () => duplicateSqlNotebook(notebook.id),
                    'Copied to your notebooks',
                    (n) => (n ? n.id : null)
                  )
                }
                data-qqq-id="button-sql-notebook-duplicate"
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                Duplicate
              </button>
            )}
            {saved && (
              <button
                type="button"
                className={buttonClass('secondary', 'sm')}
                onClick={() => setShowVersions(!showVersions)}
                aria-expanded={showVersions}
                data-qqq-id="button-sql-notebook-versions"
              >
                <History className="h-4 w-4" aria-hidden="true" />
                Versions
              </button>
            )}
            {saved && canEdit && (
              <button
                type="button"
                className={buttonClass('destructive', 'sm')}
                onClick={() => setConfirmingDelete(true)}
                data-qqq-id="button-sql-notebook-delete"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
      {!canEdit && (
        <p className="text-sm text-muted-foreground">
          Shared by {notebook.ownerName ?? notebook.ownerUserId}. You can run it; duplicate it to
          keep changes.
        </p>
      )}

      {confirmingDelete && (
        <ConfirmDeleteDialog
          title={notebook.title}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => {
            setConfirmingDelete(false)
            void act(
              () => deleteSqlNotebook(notebook.id),
              'Notebook deleted',
              () => null
            )
          }}
        />
      )}

      {showVersions && (
        <section className={cn(CARD_CLASS, 'p-3')} aria-labelledby="sql-versions-heading">
          <h3 id="sql-versions-heading" className="mb-2 text-sm font-semibold">
            Versions
          </h3>
          <ul className="divide-y divide-border" aria-label="Versions">
            {versions.map((v) => (
              <li
                key={v.versionNumber}
                className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2 text-sm"
              >
                <span className={BADGE_CLASS}>Version {v.versionNumber}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-foreground">
                    {v.comment ?? (v.versionNumber === notebook.currentVersion ? 'Current' : '')}
                  </span>
                  <span className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                    {v.savedByName && <span>{v.savedByName}</span>}
                    <DateTimeText
                      value={v.createDate}
                      type="DATE_TIME"
                      className="text-xs text-muted-foreground"
                    />
                  </span>
                </span>
                {canEdit && v.versionNumber !== notebook.currentVersion && (
                  <button
                    type="button"
                    className={buttonClass('secondary', 'sm')}
                    onClick={() =>
                      act(
                        () => restoreSqlNotebookVersion(notebook.id, v.versionNumber),
                        `Restored version ${v.versionNumber}`
                      )
                    }
                    data-qqq-id={`button-sql-restore-${v.versionNumber}`}
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Restore
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {parameterNames.length > 0 && (
        <fieldset className={cn(CARD_CLASS, 'p-3')}>
          <legend className="px-1 text-sm font-semibold">Parameters</legend>
          <div className="grid gap-3 @lg:grid-cols-[repeat(auto-fill,minmax(18rem,1fr))]">
            {parameterNames.map((name) => {
              const type = parameters.find((p) => p.name === name)?.type ?? 'STRING'
              return (
                <div key={name} className="space-y-1">
                  <label
                    htmlFor={`sql-param-${name}`}
                    className="block font-mono text-sm text-foreground"
                  >
                    :{name}
                  </label>
                  <div className="flex gap-2">
                    <input
                      id={`sql-param-${name}`}
                      className={cn(INPUT_CLASS, 'h-8 min-w-0 flex-1 py-1')}
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
                    <select
                      className={cn(SELECT_CLASS, 'w-32')}
                      value={type}
                      aria-label={`Type of :${name}`}
                      onChange={(e) =>
                        setParameterType(name, e.target.value as SqlNotebookParameter['type'])
                      }
                      data-qqq-id={`select-sql-param-type-${name}`}
                    >
                      {PARAMETER_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {PARAMETER_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )
            })}
          </div>
        </fieldset>
      )}

      {cells.map((cell, index) =>
        cell.cellType === 'MARKDOWN' ? (
          <section
            key={cell.cellKey}
            className={cn(CARD_CLASS, 'space-y-2 p-3')}
            aria-label={`Markdown cell ${index + 1}`}
            data-qqq-id={`section-sql-markdown-${index}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Notes</span>
              <span className="ml-auto inline-flex items-center gap-1">
                {canEdit && (
                  <button
                    type="button"
                    className={buttonClass('ghost', 'sm')}
                    onClick={() =>
                      setPreviewing({ ...previewing, [cell.cellKey]: !previewing[cell.cellKey] })
                    }
                    data-qqq-id={`button-sql-markdown-toggle-${index}`}
                  >
                    {previewing[cell.cellKey] === false ? (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    )}
                    {previewing[cell.cellKey] === false ? 'Preview' : 'Edit'}
                  </button>
                )}
                {cellActions(index)}
              </span>
            </div>
            {previewing[cell.cellKey] === false ? (
              <textarea
                className={cn(INPUT_CLASS, 'block min-h-28 resize-y font-mono')}
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
              <MarkdownView source={cell.content || '*Empty notes*'} />
            )}
          </section>
        ) : (
          <SqlCell
            key={cell.cellKey}
            cell={cell}
            index={index}
            capabilities={capabilities}
            defaultBackendName={defaultBackendName}
            paramsFor={paramsFor}
            notebookId={saved ? notebook.id : null}
            canEdit={canEdit}
            actions={cellActions(index)}
            snapshots={snapshots.filter((s) => s.cellKey === cell.cellKey)}
            onChange={(next) => updateCells(cells.map((c, i) => (i === index ? next : c)))}
            onSnapshotsChanged={() =>
              queryClient.invalidateQueries({
                queryKey: queryKeys.sqlNotebookSnapshots(notebook.id),
              })
            }
          />
        )
      )}

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={buttonClass('secondary', 'sm')}
            onClick={() => addCell('SQL')}
            data-qqq-id="button-sql-add-sql-cell"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add SQL cell
          </button>
          <button
            type="button"
            className={buttonClass('secondary', 'sm')}
            onClick={() => addCell('MARKDOWN')}
            data-qqq-id="button-sql-add-markdown-cell"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add notes cell
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Asks before a notebook and its versions are deleted (the app's standard alert dialog).
 *
 * @param props - Component props.
 * @param props.title - The notebook's title.
 * @param props.onConfirm - Deletes it.
 * @param props.onCancel - Closes the dialog.
 * @returns The dialog (open while mounted).
 */
function ConfirmDeleteDialog({
  title,
  onConfirm,
  onCancel,
}: {
  title: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <AlertDialog.Root open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <AlertDialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto',
            'rounded-xl border border-border bg-background text-foreground shadow-lg focus:outline-none'
          )}
          data-qqq-id="dialog-sql-notebook-delete"
        >
          <div className="space-y-2 p-6">
            <AlertDialog.Title className="text-lg font-semibold">
              Delete notebook?
            </AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-muted-foreground">
              “{title}” and all of its versions will be deleted. This cannot be undone.
            </AlertDialog.Description>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 rounded-b-xl bg-muted px-6 py-4">
            <AlertDialog.Cancel asChild>
              <button
                type="button"
                className={buttonClass('secondary')}
                data-qqq-id="button-sql-notebook-delete-cancel"
              >
                Cancel
              </button>
            </AlertDialog.Cancel>
            <button
              type="button"
              className={buttonClass('danger')}
              onClick={onConfirm}
              data-qqq-id="button-sql-notebook-delete-confirm"
            >
              Delete
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
