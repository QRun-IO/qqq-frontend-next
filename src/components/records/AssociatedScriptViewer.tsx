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
 * @file AssociatedScriptViewer — one associated script of a record in the record
 * developer view: create the script, browse its versions and code, edit (store a new
 * revision), read its run logs, test it, and read its script type's documentation.
 *
 * Parity with Material's `RecordDeveloperView` + `ScriptViewer`.
 */

'use client'

import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Loader2, X } from 'lucide-react'

import type { QFieldMetaData, QRecord } from '@/types'
import {
  getAssociatedScriptLogs,
  queryScriptRevisionFiles,
  queryScriptRevisions,
  queryScriptTypeFileSchemas,
  storeRecordAssociatedScript,
  storeScriptRevision,
  testScript,
  type AssociatedScriptData,
} from '@/lib/api/developer'
import { toast } from '@/lib/hooks/use-toast'
import { useRestoreFocus } from '@/lib/hooks/use-restore-focus'
import { HANDLES_OWN_ERRORS, queryKeys } from '@/lib/query-client'
import { cn } from '@/lib/utils/cn'
import { formatDateTime } from '@/lib/utils/datetime-utils'
import { getErrorMessage } from '@/lib/utils/error-utils'
import { ScriptEditor, type ScriptEditorProps } from '@/components/forms/ScriptEditor'

/** Code and commit message Material stores when a script is first created. */
const NEW_SCRIPT_CONTENTS = '// Edit this new script to define its code.'
const NEW_SCRIPT_COMMIT_MESSAGE = 'Initial version'

/** Commit message Material stores when none is typed. */
const DEFAULT_COMMIT_MESSAGE = 'No commit message given'

/** Script type file modes (`scriptType.fileMode`). */
const FILE_MODE_SINGLE = 1
const FILE_MODE_MULTI_PRE_DEFINED = 2

/** The one file of a single-file script type, as Material names it. */
const SINGLE_FILE: ScriptFileSchema = { name: 'Script.js', fileType: 'javascript' }

const BUTTON_CLASS = cn(
  'inline-flex items-center gap-2 rounded-md border border-input bg-card px-3 py-1.5 text-sm font-medium text-foreground',
  'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  'disabled:cursor-not-allowed disabled:opacity-50'
)
const PRIMARY_BUTTON_CLASS = cn(
  'inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground',
  'hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  'disabled:cursor-not-allowed disabled:opacity-50'
)
const INPUT_CLASS =
  'w-full rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring'
const ALERT_CLASS =
  'whitespace-pre-wrap rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'

type TabKey = 'code' | 'logs' | 'test' | 'docs'

/** A file a script revision is made of. */
interface ScriptFileSchema {
  /** File name, e.g. `Script.js`. */
  name: string
  /** Language of the file, from the script type file schema. */
  fileType: string
}

/** Props for {@link AssociatedScriptViewer}. */
export interface AssociatedScriptViewerProps {
  /** Exact backend table identifier of the record. */
  tableName: string
  /** Primary key of the record. */
  recordId: string | number
  /** Label of the associated-script field (the card heading). */
  fieldLabel: string
  /** Developer data of this associated script. */
  data: AssociatedScriptData
  /** The script id the record's field holds, if any. */
  scriptId: string | number | null | undefined
  /** Whether the session may create the script (table edit permission). */
  canCreate: boolean
  /** Whether the session may store revisions (the `storeScriptRevision` process is available). */
  canEdit: boolean
  /** Whether the session may test scripts (the `testScript` process is available). */
  canTest: boolean
  /** Reloads the record's developer data after the script changed. */
  onChanged: () => Promise<unknown>
}

/**
 * Makes a value safe to use inside an HTML id.
 * @param value - Raw name.
 * @returns The name with every character outside `[A-Za-z0-9_-]` replaced by `-`.
 */
export function domId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '-')
}

/**
 * Plain text of a backend value.
 * @param value - Any wire value.
 * @returns The text (`''` for null/undefined, JSON for objects).
 */
function text(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/**
 * Formats a timestamp with the dashboards' date-time format, keeping unreadable values as they are.
 * @param value - Wire timestamp.
 * @returns The display text.
 */
function dateTimeText(value: unknown): string {
  return formatDateTime(value) ?? text(value)
}

/**
 * Whether two record ids are the same (ids may arrive as numbers or strings).
 * @param a - First id.
 * @param b - Second id.
 * @returns True when both are present and equal as text.
 */
function sameId(a: unknown, b: unknown): boolean {
  return a !== null && a !== undefined && b !== null && b !== undefined && String(a) === String(b)
}

/**
 * The editor language for a script file type.
 * @param fileType - File type from the script type file schema.
 * @returns A {@link ScriptEditor} language.
 */
function editorLanguage(fileType: string): NonNullable<ScriptEditorProps['language']> {
  const type = fileType.toLowerCase()
  if (type === 'javascript' || type === 'js') return 'javascript'
  if (type === 'json' || type === 'groovy' || type === 'python' || type === 'sql') return type
  return 'text'
}

/**
 * Renders one associated script of a record: the create prompt when the field is empty,
 * otherwise the script viewer.
 *
 * @param props - {@link AssociatedScriptViewerProps}
 * @returns The associated script card.
 */
export function AssociatedScriptViewer(props: AssociatedScriptViewerProps) {
  const { tableName, recordId, fieldLabel, data, scriptId, canCreate, onChanged } = props
  const fieldName = data.associatedScript.fieldName
  const headingId = `associated-script-${domId(fieldName)}-heading`
  const hasScript = scriptId !== null && scriptId !== undefined && scriptId !== ''

  return (
    <section
      className="rounded-xl border border-border bg-card"
      aria-labelledby={headingId}
      data-qqq-id={`associated-script-${fieldName}`}
    >
      <h3 id={headingId} className="px-4 pt-4 text-lg font-semibold text-foreground">{fieldLabel}</h3>
      <div className="p-4">
        {!hasScript ? (
          <CreateScript tableName={tableName} recordId={recordId} fieldName={fieldName} canCreate={canCreate} onChanged={onChanged} />
        ) : data.script ? (
          <ScriptViewer {...props} scriptId={scriptId} script={data.script} />
        ) : (
          <p role="alert" className="text-sm text-muted-foreground">Script code could not be found.</p>
        )}
      </div>
    </section>
  )
}

/**
 * The empty-field prompt with the "Create Script" action.
 *
 * @param props - Component props.
 * @param props.tableName - Table of the record.
 * @param props.recordId - Record id.
 * @param props.fieldName - Associated-script field.
 * @param props.canCreate - Whether the create action is offered.
 * @param props.onChanged - Reloads developer data once created.
 * @returns The prompt.
 */
function CreateScript({ tableName, recordId, fieldName, canCreate, onChanged }: {
  tableName: string
  recordId: string | number
  fieldName: string
  canCreate: boolean
  onChanged: () => Promise<unknown>
}) {
  const create = useMutation({
    mutationFn: () => storeRecordAssociatedScript(tableName, recordId, fieldName, NEW_SCRIPT_CONTENTS, NEW_SCRIPT_COMMIT_MESSAGE),
    meta: HANDLES_OWN_ERRORS,
    onSuccess: () => onChanged(),
  })
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-foreground">No script has been created in this field for this record at this time.</p>
      {canCreate && (
        <button
          type="button"
          className={BUTTON_CLASS}
          disabled={create.isPending}
          onClick={() => create.mutate()}
          data-qqq-id={`button-create-script-${fieldName}`}
        >
          {create.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Create Script
        </button>
      )}
      {create.error && <p role="alert" className={cn(ALERT_CLASS, 'w-full')}>{getErrorMessage(create.error)}</p>}
    </div>
  )
}

/**
 * The tabbed viewer of an existing script (Code, Logs, Test, Docs).
 *
 * @param props - Viewer props plus the loaded script record.
 * @returns The viewer.
 */
function ScriptViewer({ tableName, recordId, fieldLabel, data, scriptId, script, canEdit, canTest, onChanged }: AssociatedScriptViewerProps & {
  scriptId: string | number
  script: QRecord
}) {
  const queryClient = useQueryClient()
  const fieldName = data.associatedScript.fieldName
  const scriptType = data.scriptType
  const currentId = script.values.currentScriptRevisionId
  const [tab, setTab] = useState<TabKey>('code')
  const [selectedId, setSelectedId] = useState<unknown>(undefined)
  const [fileChoice, setFileChoice] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  const revisionsQuery = useQuery({
    queryKey: queryKeys.scriptRevisions(scriptId),
    queryFn: () => queryScriptRevisions(scriptId),
    meta: HANDLES_OWN_ERRORS,
    retry: false,
  })
  const revisions = revisionsQuery.data ?? []
  const selected = revisions.find((revision) => sameId(revision.values.id, selectedId))
    ?? revisions.find((revision) => sameId(revision.values.id, currentId))
    ?? revisions[0]
  const selectedRevisionId = selected?.values.id as string | number | undefined
  const selectedIsCurrent = selected !== undefined && sameId(selected.values.id, currentId)

  const fileMode = Number(scriptType?.values.fileMode)
  const rawScriptTypeId = scriptType?.values.id ?? data.associatedScript.scriptTypeId ?? script.values.scriptTypeId
  const scriptTypeId = typeof rawScriptTypeId === 'string' || typeof rawScriptTypeId === 'number' ? rawScriptTypeId : undefined
  const schemasQuery = useQuery({
    queryKey: queryKeys.scriptTypeFileSchemas(scriptTypeId ?? ''),
    queryFn: () => queryScriptTypeFileSchemas(scriptTypeId!),
    enabled: fileMode === FILE_MODE_MULTI_PRE_DEFINED && scriptTypeId !== undefined,
    meta: HANDLES_OWN_ERRORS,
    retry: false,
  })
  const filesQuery = useQuery({
    queryKey: queryKeys.scriptRevisionFiles(selectedRevisionId ?? ''),
    queryFn: () => queryScriptRevisionFiles(selectedRevisionId!),
    enabled: selectedRevisionId !== undefined && selectedRevisionId !== null,
    meta: HANDLES_OWN_ERRORS,
    retry: false,
  })

  let fileContents: Record<string, string> = {}
  for (const file of filesQuery.data ?? []) fileContents[text(file.values.fileName)] = text(file.values.contents)
  let fileSchemas: ScriptFileSchema[]
  if (fileMode === FILE_MODE_SINGLE) {
    fileSchemas = [SINGLE_FILE]
    // A single-file script has one file whatever name it was stored under: the backend's
    // create-script route stores the first revision's file as "script".
    const storedNames = Object.keys(fileContents)
    const single = fileContents[SINGLE_FILE.name] ?? (storedNames.length === 1 ? fileContents[storedNames[0]] : undefined)
    fileContents = single === undefined ? {} : { [SINGLE_FILE.name]: single }
  } else if (fileMode === FILE_MODE_MULTI_PRE_DEFINED) {
    fileSchemas = (schemasQuery.data ?? []).map((schema) => ({ name: text(schema.values.name), fileType: text(schema.values.fileType) }))
  } else {
    fileSchemas = Object.keys(fileContents).map((name) => ({ name, fileType: name.endsWith('.js') ? 'javascript' : 'text' }))
  }
  const fileNames = fileSchemas.map((schema) => schema.name)
  const selectedFileName = fileChoice && fileNames.includes(fileChoice) ? fileChoice : fileNames[0]

  let editText = 'Create New Version'
  let editTitle: string | undefined
  if (selected) {
    if (selectedIsCurrent) {
      editText = 'Edit'
      editTitle = 'If you make any changes to this script, a new version will be created when you hit Save.'
    } else {
      editText = 'Edit and Activate'
      editTitle = 'Open the editor, make any changes the old version needs, then Save: a new version is created and set as current.'
    }
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'code', label: 'Code' },
    { key: 'logs', label: 'Logs' },
    ...(canTest ? [{ key: 'test' as const, label: 'Test' }] : []),
    { key: 'docs', label: 'Docs' },
  ]
  const tabDomId = (key: TabKey) => `script-tab-${domId(fieldName)}-${key}`
  const panelDomId = (key: TabKey) => `script-panel-${domId(fieldName)}-${key}`

  /**
   * Moves between tabs with the arrow, Home and End keys (automatic activation).
   * @param event - Key event on a tab.
   * @param index - Index of the focused tab.
   */
  function handleTabKey(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number | undefined
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    if (next === undefined) return
    event.preventDefault()
    setTab(tabs[next].key)
    document.getElementById(tabDomId(tabs[next].key))?.focus()
  }

  const versionsList = (
    <VersionsList
      revisions={revisions}
      selected={selected}
      currentId={currentId}
      isLoading={revisionsQuery.isPending}
      error={revisionsQuery.error}
      onSelect={setSelectedId}
    />
  )

  return (
    <div>
      <div role="tablist" aria-label={`${fieldLabel} script`} className="mb-4 flex gap-1 border-b border-border">
        {tabs.map((item, index) => (
          <button
            key={item.key}
            id={tabDomId(item.key)}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            aria-controls={panelDomId(item.key)}
            tabIndex={tab === item.key ? 0 : -1}
            onClick={() => setTab(item.key)}
            onKeyDown={(event) => handleTabKey(event, index)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring',
              tab === item.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
            data-qqq-id={`script-tab-${fieldName}-${item.key}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={panelDomId(tab)} aria-labelledby={tabDomId(tab)} tabIndex={0} className="focus:outline-none">
        {tab === 'code' && (
          <div className="grid gap-4 md:grid-cols-[minmax(12rem,1fr)_2fr]">
            {versionsList}
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {selected ? (
                  <h4 className="text-base font-semibold text-foreground">
                    Version {text(selected.values.sequenceNo)}{selectedIsCurrent ? ' (Current)' : ''}
                  </h4>
                ) : <span />}
                {canEdit && (
                  <button
                    type="button"
                    className={BUTTON_CLASS}
                    title={editTitle}
                    disabled={revisionsQuery.isPending || (selected !== undefined && filesQuery.isPending)}
                    onClick={() => setEditing(true)}
                    data-qqq-id={`button-edit-script-${fieldName}`}
                  >
                    {editText}
                  </button>
                )}
              </div>
              {selected && fileNames.length > 1 && (
                <div className="flex items-center gap-2">
                  <label htmlFor={`script-file-select-${domId(fieldName)}`} className="text-sm text-foreground">File</label>
                  <select
                    id={`script-file-select-${domId(fieldName)}`}
                    className={cn(INPUT_CLASS, 'w-auto')}
                    value={selectedFileName}
                    onChange={(event) => setFileChoice(event.target.value)}
                    data-qqq-id={`select-script-file-${fieldName}`}
                  >
                    {fileNames.map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                </div>
              )}
              {selected && filesQuery.isPending && (
                <p className="text-sm text-muted-foreground" role="status" aria-busy="true">Loading…</p>
              )}
              {selected && filesQuery.isError && (
                <p role="alert" className={ALERT_CLASS}>Error loading script files: {getErrorMessage(filesQuery.error)}</p>
              )}
              {schemasQuery.isError && (
                <p role="alert" className={ALERT_CLASS}>Error loading script files: {getErrorMessage(schemasQuery.error)}</p>
              )}
              {selected && filesQuery.isSuccess && selectedFileName !== undefined && (
                <figure>
                  <figcaption className="mb-1 font-mono text-xs font-semibold text-foreground">{selectedFileName}</figcaption>
                  <pre
                    className="max-h-96 overflow-auto rounded-md bg-muted p-3 font-mono text-xs text-foreground"
                    data-qqq-id={`script-code-${fieldName}-${selectedFileName}`}
                  >
                    {fileContents[selectedFileName] ?? ''}
                  </pre>
                </figure>
              )}
            </div>
          </div>
        )}

        {tab === 'logs' && (
          <div className="grid gap-4 md:grid-cols-[minmax(12rem,1fr)_2fr]">
            {versionsList}
            <div className="min-w-0 space-y-3">
              {selected && selectedRevisionId !== undefined ? (
                <>
                  <h4 className="text-base font-semibold text-foreground">Script Logs (Version {text(selected.values.sequenceNo)})</h4>
                  <ScriptLogs tableName={tableName} recordId={recordId} fieldName={fieldName} scriptRevisionId={selectedRevisionId} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Select a version to view logs</p>
              )}
            </div>
          </div>
        )}

        {tab === 'test' && canTest && (
          <ScriptTest
            fieldName={fieldName}
            scriptId={scriptId}
            files={fileContents}
            inputFields={data.testInputFields ?? []}
            outputFields={data.testOutputFields ?? []}
          />
        )}

        {tab === 'docs' && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="min-w-0">
              <h4 className="mb-2 text-base font-semibold text-foreground">Documentation</h4>
              <pre
                className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-sm text-foreground"
                data-qqq-id={`script-docs-help-${fieldName}`}
              >
                {text(scriptType?.values.helpText)}
              </pre>
            </div>
            <div className="min-w-0">
              <h4 className="mb-2 text-base font-semibold text-foreground">Example Code</h4>
              <pre
                className="max-h-96 overflow-auto rounded-md bg-muted p-3 font-mono text-xs text-foreground"
                data-qqq-id={`script-docs-example-${fieldName}`}
              >
                {text(scriptType?.values.sampleCode)}
              </pre>
            </div>
          </div>
        )}
      </div>

      {editing && (
        <ScriptEditDialog
          fieldName={fieldName}
          title={`${selected ? 'Editing' : 'Initializing'} Code for Script: ${text(script.values.name)}`}
          files={fileSchemas.map((schema) => ({ ...schema, contents: fileContents[schema.name] ?? '' }))}
          scriptId={scriptId}
          onClose={() => setEditing(false)}
          onSaved={async (scriptRevisionId) => {
            setEditing(false)
            setSelectedId(scriptRevisionId)
            toast.success('Saved New Script Version')
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: queryKeys.scriptRevisions(scriptId) }),
              onChanged(),
            ])
          }}
        />
      )}
    </div>
  )
}

/**
 * The list of a script's versions, newest first.
 *
 * @param props - Component props.
 * @param props.revisions - Revision records.
 * @param props.selected - The selected revision.
 * @param props.currentId - Id of the script's current revision.
 * @param props.isLoading - Whether revisions are still loading.
 * @param props.error - Load error, if any.
 * @param props.onSelect - Selects a revision by id.
 * @returns The versions list.
 */
function VersionsList({ revisions, selected, currentId, isLoading, error, onSelect }: {
  revisions: QRecord[]
  selected: QRecord | undefined
  currentId: unknown
  isLoading: boolean
  error: Error | null
  onSelect: (id: unknown) => void
}) {
  return (
    <div className="min-w-0">
      <h4 className="mb-2 text-base font-semibold text-foreground">Versions</h4>
      {isLoading ? (
        <p className="text-sm text-muted-foreground" role="status" aria-busy="true">Loading…</p>
      ) : error ? (
        <p role="alert" className={ALERT_CLASS}>Error loading script versions: {getErrorMessage(error)}</p>
      ) : revisions.length === 0 ? (
        <p className="text-sm text-muted-foreground">There are not any versions of this script.</p>
      ) : (
        <ul className="max-h-96 space-y-1 overflow-auto" aria-label="Versions">
          {revisions.map((revision) => {
            const isSelected = revision === selected
            const isCurrent = sameId(revision.values.id, currentId)
            return (
              <li key={text(revision.values.id)}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelect(revision.values.id)}
                  className={cn(
                    'w-full rounded-md border px-3 py-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-ring',
                    isSelected ? 'border-primary bg-accent' : 'border-border hover:bg-accent'
                  )}
                  data-qqq-id={`script-version-${text(revision.values.id)}`}
                >
                  <span className="flex items-center gap-2 font-medium text-foreground">
                    <span>Version {text(revision.values.sequenceNo)}</span>
                    {isCurrent && (
                      <span className="rounded border border-green-600 px-1 text-xs text-green-700 dark:text-green-400">CURRENT</span>
                    )}
                  </span>
                  <span className="block break-words text-foreground">{text(revision.values.commitMessage)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {dateTimeText(revision.values.createDate)} by {text(revision.values.author)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/**
 * The latest run logs of one script revision.
 *
 * @param props - Component props.
 * @param props.tableName - Table of the record.
 * @param props.recordId - Record id.
 * @param props.fieldName - Associated-script field.
 * @param props.scriptRevisionId - Revision whose logs are shown.
 * @returns The logs table or its loading, error and empty states.
 */
function ScriptLogs({ tableName, recordId, fieldName, scriptRevisionId }: {
  tableName: string
  recordId: string | number
  fieldName: string
  scriptRevisionId: string | number
}) {
  const logsQuery = useQuery({
    queryKey: queryKeys.associatedScriptLogs(tableName, recordId, fieldName, scriptRevisionId),
    queryFn: () => getAssociatedScriptLogs(tableName, recordId, fieldName, scriptRevisionId),
    meta: HANDLES_OWN_ERRORS,
    retry: false,
  })
  if (logsQuery.isPending) return <p className="text-sm text-muted-foreground" role="status" aria-busy="true">Loading…</p>
  if (logsQuery.isError) return <p role="alert" className={ALERT_CLASS}>Error loading script logs: {getErrorMessage(logsQuery.error)}</p>
  if (logsQuery.data.length === 0) return <p className="text-sm text-muted-foreground">No logs available for this version.</p>
  return (
    <div className="max-h-[28rem] overflow-auto rounded-md border border-border">
      <table className="min-w-full text-sm" data-qqq-id={`script-logs-${fieldName}`}>
        <thead className="bg-muted text-left">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium text-foreground">Timestamp</th>
            <th scope="col" className="px-3 py-2 text-right font-medium text-foreground">Run Time (ms)</th>
            <th scope="col" className="px-3 py-2 font-medium text-foreground">Had Error?</th>
            <th scope="col" className="px-3 py-2 font-medium text-foreground">Input</th>
            <th scope="col" className="px-3 py-2 font-medium text-foreground">Output</th>
            <th scope="col" className="px-3 py-2 font-medium text-foreground">Logs</th>
          </tr>
        </thead>
        <tbody>
          {logsQuery.data.map((log) => {
            const lines = Array.isArray(log.values.scriptLogLine) ? log.values.scriptLogLine as unknown[] : []
            const logText = lines
              .map((line) => (line && typeof line === 'object' && 'values' in line ? text((line as QRecord).values.text) : ''))
              .join('\n')
            const hadError = log.values.hadError
            return (
              <tr key={text(log.values.id)} className="border-t border-border align-top" data-qqq-id={`script-log-${text(log.values.id)}`}>
                <td className="whitespace-nowrap px-3 py-2 text-foreground">{dateTimeText(log.values.startTimestamp)}</td>
                <td className="px-3 py-2 text-right text-foreground">{text(log.values.runTimeMillis)}</td>
                <td className={cn('px-3 py-2', hadError === true ? 'text-destructive' : 'text-foreground')}>
                  {hadError === true ? 'Yes' : hadError === false ? 'No' : ''}
                </td>
                <td className="whitespace-pre-wrap px-3 py-2 font-mono text-xs text-foreground">{text(log.values.input)}</td>
                <td className="whitespace-pre-wrap px-3 py-2 font-mono text-xs text-foreground">
                  {text(log.values.output)}
                  {log.values.error !== null && log.values.error !== undefined && (
                    <span className="block text-destructive">{text(log.values.error)}</span>
                  )}
                </td>
                <td className="whitespace-pre-wrap px-3 py-2 font-mono text-xs text-foreground">{logText}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Display text of a test output value: the backend value, with date-times in the dashboards' format.
 * @param field - Output field metadata.
 * @param value - Output value.
 * @returns The display text.
 */
function outputText(field: QFieldMetaData, value: unknown): string {
  return field.type === 'DATE_TIME' ? dateTimeText(value) : text(value)
}

/**
 * The script test form and its output.
 *
 * @param props - Component props.
 * @param props.fieldName - Associated-script field.
 * @param props.scriptId - Script under test.
 * @param props.files - Code of the selected version, by file name.
 * @param props.inputFields - Tester input fields.
 * @param props.outputFields - Tester output fields.
 * @returns The test form.
 */
function ScriptTest({ fieldName, scriptId, files, inputFields, outputFields }: {
  fieldName: string
  scriptId: string | number
  files: Record<string, string>
  inputFields: QFieldMetaData[]
  outputFields: QFieldMetaData[]
}) {
  const [inputValues, setInputValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(inputFields.map((field) => [field.name, text(field.defaultValue)])))
  const run = useMutation({
    mutationFn: () => testScript({ scriptId, files, inputValues }),
    meta: HANDLES_OWN_ERRORS,
  })
  const result = run.data
  const outputs = result?.outputObject ?? {}
  const outputValues = outputs.values && typeof outputs.values === 'object' && !Array.isArray(outputs.values)
    ? outputs.values as Record<string, unknown>
    : outputs
  const errorMessage = run.error ? getErrorMessage(run.error) : result?.exceptionMessage

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <form
        className="space-y-3 rounded-md border border-border p-4"
        onSubmit={(event) => {
          event.preventDefault()
          run.mutate()
        }}
      >
        <h4 className="text-base font-semibold text-foreground">Test Input</h4>
        {inputFields.map((field) => {
          const id = `script-test-${domId(fieldName)}-${domId(field.name)}`
          const common = {
            id,
            value: inputValues[field.name] ?? '',
            className: INPUT_CLASS,
            'aria-required': Boolean(field.isRequired),
          }
          return (
            <div key={field.name} className="space-y-1">
              <label htmlFor={id} className="block text-sm font-medium text-foreground">{field.label || field.name}</label>
              {field.type === 'TEXT' ? (
                <textarea {...common} rows={3} onChange={(event) => setInputValues((values) => ({ ...values, [field.name]: event.target.value }))} />
              ) : (
                <input {...common} type="text" onChange={(event) => setInputValues((values) => ({ ...values, [field.name]: event.target.value }))} />
              )}
            </div>
          )
        })}
        <div className="flex justify-end">
          <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={run.isPending} data-qqq-id={`button-test-script-${fieldName}`}>
            {run.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Submit
          </button>
        </div>
      </form>

      <div className="min-w-0 space-y-3 rounded-md border border-border p-4">
        <h4 className="text-base font-semibold text-foreground">Test Output</h4>
        <div className="space-y-1" aria-live="polite" data-qqq-id={`script-test-output-${fieldName}`}>
          {run.isPending && <p className="text-sm text-muted-foreground" role="status" aria-busy="true">Running…</p>}
          {errorMessage && (
            <p role="alert" className={ALERT_CLASS} data-qqq-id={`script-test-error-${fieldName}`}>{errorMessage}</p>
          )}
          {outputFields.map((field) => (
            <p key={field.name} className="text-sm text-foreground" data-qqq-id={`script-test-output-${fieldName}-${field.name}`}>
              <span className="pr-1 font-semibold">{field.label || field.name}:</span>
              {' '}
              <span>{outputText(field, outputValues[field.name])}</span>
            </p>
          ))}
        </div>
        {result && result.logLines.length > 0 && (
          <div>
            <h4 className="mb-2 text-base font-semibold text-foreground">Test Log Lines</h4>
            <table className="min-w-full text-sm" data-qqq-id={`script-test-log-lines-${fieldName}`}>
              <thead className="bg-muted text-left">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium text-foreground">Timestamp</th>
                  <th scope="col" className="px-3 py-2 font-medium text-foreground">Log Line</th>
                </tr>
              </thead>
              <tbody>
                {result.logLines.map((line, index) => (
                  <tr key={index} className="border-t border-border align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-foreground">{dateTimeText(line.timestamp)}</td>
                    <td className="whitespace-pre-wrap px-3 py-2 text-foreground">{line.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * The modal editor that stores a new script revision.
 *
 * @param props - Component props.
 * @param props.fieldName - Associated-script field.
 * @param props.title - Dialog title.
 * @param props.files - Files to edit, with their starting contents.
 * @param props.scriptId - Script to add the revision to.
 * @param props.onClose - Closes the dialog without saving.
 * @param props.onSaved - Called with the new revision id after a successful save.
 * @returns The dialog.
 */
function ScriptEditDialog({ fieldName, title, files, scriptId, onClose, onSaved }: {
  fieldName: string
  title: string
  files: (ScriptFileSchema & { contents: string })[]
  scriptId: string | number
  onClose: () => void
  onSaved: (scriptRevisionId: number | undefined) => Promise<void>
}) {
  const [contents, setContents] = useState<Record<string, string>>(() =>
    Object.fromEntries(files.map((file) => [file.name, file.contents])))
  const [commitMessage, setCommitMessage] = useState('')
  const restoreFocus = useRestoreFocus(true)
  const save = useMutation({
    mutationFn: () => storeScriptRevision({
      scriptId,
      commitMessage: commitMessage.trim() || DEFAULT_COMMIT_MESSAGE,
      files: Object.fromEntries(files.map((file) => [file.name, contents[file.name] ?? ''])),
    }),
    meta: HANDLES_OWN_ERRORS,
    onSuccess: (result) => onSaved(result.scriptRevisionId),
  })
  const commitId = `script-commit-message-${domId(fieldName)}`

  return (
    <DialogPrimitive.Root open onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70" />
        <DialogPrimitive.Content
          onCloseAutoFocus={restoreFocus}
          aria-describedby={undefined}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col',
            'rounded-lg border border-border bg-card shadow-lg focus:outline-none'
          )}
          data-qqq-id={`dialog-script-editor-${fieldName}`}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border p-4">
            <DialogPrimitive.Title className="text-lg font-semibold text-foreground">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                aria-label="Close dialog"
                className="rounded-md p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </DialogPrimitive.Close>
          </div>
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault()
              save.mutate()
            }}
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
              {files.map((file) => (
                <ScriptEditor
                  key={file.name}
                  id={`script-edit-${domId(fieldName)}-${domId(file.name)}`}
                  label={file.name}
                  language={editorLanguage(file.fileType)}
                  value={contents[file.name] ?? ''}
                  onChange={(value) => setContents((current) => ({ ...current, [file.name]: value }))}
                  rows={16}
                />
              ))}
              <div className="space-y-1">
                <label htmlFor={commitId} className="block text-sm font-medium text-foreground">Commit message</label>
                <input
                  id={commitId}
                  type="text"
                  className={INPUT_CLASS}
                  value={commitMessage}
                  onChange={(event) => setCommitMessage(event.target.value)}
                  placeholder={DEFAULT_COMMIT_MESSAGE}
                />
              </div>
              {save.error && <p role="alert" className={ALERT_CLASS}>{getErrorMessage(save.error)}</p>}
            </div>
            <div className="flex items-center justify-end gap-3 rounded-b-lg border-t border-border bg-muted px-4 py-3">
              <button
                type="button"
                className={BUTTON_CLASS}
                onClick={onClose}
                disabled={save.isPending}
                data-qqq-id={`button-cancel-script-${fieldName}`}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={PRIMARY_BUTTON_CLASS}
                disabled={save.isPending}
                data-qqq-id={`button-save-script-${fieldName}`}
              >
                {save.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Save
              </button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
