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
 * @file ScriptViewer — Material's `ScriptViewer`: a script's versions (with their API name and
 * version), each version's syntax-colored files, run logs with a "View All" link, a test
 * runner, the script type's docs, and the editor that stores a new version.
 *
 * Shared by the record developer view (a record's associated scripts) and the scriptViewer
 * widget on a script's own record view.
 */

'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import type { QRecord } from '@/types'
import {
  loadScriptTestDetails,
  queryScriptRevisionFiles,
  queryScriptRevisions,
  queryScriptTypeFileSchemas,
} from '@/lib/api/developer'
import { toast } from '@/lib/hooks/use-toast'
import { HANDLES_OWN_ERRORS, queryKeys } from '@/lib/query-client'
import { languageFor } from '@/lib/utils/code-highlight'
import { cn } from '@/lib/utils/cn'
import { getErrorMessage } from '@/lib/utils/error-utils'
import { CodeBlock } from './HighlightedCode'
import { ScriptEditorDialog } from './ScriptEditorDialog'
import { ALERT_CLASS, BUTTON_CLASS, INPUT_CLASS, ScriptDocs, ScriptTest, type ScriptTestFields } from './ScriptPanels'
import {
  FILE_MODE_MULTI_PRE_DEFINED,
  dateTimeText,
  domId,
  revisionApiLine,
  revisionFiles,
  sameId,
  text,
} from './script-utils'

export type { ScriptTestFields } from './ScriptPanels'

type TabKey = 'code' | 'logs' | 'test' | 'docs'

/** Where a viewer reads a revision's run logs from. */
export interface ScriptLogsSource {
  /**
   * Query key of one revision's logs.
   * @param scriptRevisionId - Revision id.
   * @returns The key.
   */
  queryKey: (scriptRevisionId: string | number) => readonly unknown[]
  /**
   * Loads one revision's logs, each with its lines in `values.scriptLogLine`.
   * @param scriptRevisionId - Revision id.
   * @returns The log records.
   */
  load: (scriptRevisionId: string | number) => Promise<QRecord[]>
  /**
   * The "View All" link to the script log table filtered to one revision, when the session can read it.
   * @param scriptRevisionId - Revision id.
   * @returns The link, or `undefined` for no link.
   */
  viewAllHref?: (scriptRevisionId: string | number) => string | undefined
}

/** Props for {@link ScriptViewer}. */
export interface ScriptViewerProps {
  /** Suffix of the viewer's DOM ids and `data-qqq-id`s (an associated-script field, or a widget name). */
  idKey: string
  /** What the viewer shows, for the tab list's accessible name (e.g. the field label). */
  label: string
  /** Script id. */
  scriptId: string | number
  /** The script record (`name`, `currentScriptRevisionId`, `scriptTypeId`). */
  script: QRecord
  /** The script type record (`fileMode`, `helpText`, `sampleCode`), when loaded. */
  scriptType?: QRecord
  /** Whether the session may store revisions (the `storeScriptRevision` process is available). */
  canEdit: boolean
  /** Whether the session may test scripts (the `testScript` process is available). */
  canTest: boolean
  /** The tester's fields when the caller already has them; otherwise they are loaded for the type. */
  testFields?: ScriptTestFields
  /** Where the logs come from. */
  logs: ScriptLogsSource
  /** Prefix of each version button's `data-qqq-id` (defaults to `script-version-`). */
  versionIdPrefix?: string
  /** Called after a new revision was stored. */
  onChanged: () => Promise<unknown>
}

/**
 * The tabbed viewer of an existing script (Code, Logs, Test, Docs).
 *
 * @param props - {@link ScriptViewerProps}
 * @returns The viewer.
 */
export function ScriptViewer({
  idKey,
  label,
  scriptId,
  script,
  scriptType,
  canEdit,
  canTest,
  testFields,
  logs,
  versionIdPrefix = 'script-version-',
  onChanged,
}: ScriptViewerProps) {
  const queryClient = useQueryClient()
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
  const rawScriptTypeId = scriptType?.values.id ?? script.values.scriptTypeId
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
  const testDetailsQuery = useQuery({
    queryKey: queryKeys.scriptTestDetails(scriptTypeId ?? ''),
    queryFn: () => loadScriptTestDetails(scriptTypeId!),
    enabled: canTest && !testFields && scriptTypeId !== undefined,
    meta: HANDLES_OWN_ERRORS,
    retry: false,
  })
  const tester: ScriptTestFields | undefined = testFields
    ?? (testDetailsQuery.data ? { inputFields: testDetailsQuery.data.testInputFields, outputFields: testDetailsQuery.data.testOutputFields } : undefined)

  const { fileSchemas, contents: fileContents } = revisionFiles(fileMode, schemasQuery.data ?? [], filesQuery.data ?? [])
  const fileNames = fileSchemas.map((schema) => schema.name)
  const selectedFileName = fileChoice && fileNames.includes(fileChoice) ? fileChoice : fileNames[0]
  const selectedFileType = fileSchemas.find((schema) => schema.name === selectedFileName)?.fileType

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
  const tabDomId = (key: TabKey) => `script-tab-${domId(idKey)}-${key}`
  const panelDomId = (key: TabKey) => `script-panel-${domId(idKey)}-${key}`

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
      idPrefix={versionIdPrefix}
    />
  )
  const viewAllHref = selectedRevisionId !== undefined ? logs.viewAllHref?.(selectedRevisionId) : undefined

  return (
    <div>
      <div role="tablist" aria-label={`${label} script`} className="mb-4 flex gap-1 overflow-x-auto border-b border-border">
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
            data-qqq-id={`script-tab-${idKey}-${item.key}`}
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
                    data-qqq-id={`button-edit-script-${idKey}`}
                  >
                    {editText}
                  </button>
                )}
              </div>
              {selected && fileNames.length > 1 && (
                <div className="flex items-center gap-2">
                  <label htmlFor={`script-file-select-${domId(idKey)}`} className="text-sm text-foreground">File</label>
                  <select
                    id={`script-file-select-${domId(idKey)}`}
                    className={cn(INPUT_CLASS, 'w-auto')}
                    value={selectedFileName}
                    onChange={(event) => setFileChoice(event.target.value)}
                    data-qqq-id={`select-script-file-${idKey}`}
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
                <figure data-qqq-id={`script-file-${idKey}-${selectedFileName}`}>
                  <figcaption className="mb-1 font-mono text-xs font-semibold text-foreground">{selectedFileName}</figcaption>
                  <CodeBlock
                    code={fileContents[selectedFileName] ?? ''}
                    language={languageFor(selectedFileType)}
                    className="max-h-96"
                    dataQqqId={`script-code-${idKey}-${selectedFileName}`}
                  />
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
                  <div className="flex flex-wrap items-baseline gap-3">
                    <h4 className="text-base font-semibold text-foreground">Script Logs (Version {text(selected.values.sequenceNo)})</h4>
                    {viewAllHref && (
                      <Link
                        href={viewAllHref}
                        className="text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
                        data-qqq-id={`script-logs-view-all-${idKey}`}
                      >
                        View All
                      </Link>
                    )}
                  </div>
                  <ScriptLogs idKey={idKey} source={logs} scriptRevisionId={selectedRevisionId} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Select a version to view logs</p>
              )}
            </div>
          </div>
        )}

        {tab === 'test' && canTest && (
          tester ? (
            <ScriptTest
              idKey={idKey}
              scriptId={scriptId}
              files={fileContents}
              inputFields={tester.inputFields}
              outputFields={tester.outputFields}
              apiName={text(selected?.values.apiName) || undefined}
              apiVersion={text(selected?.values.apiVersion) || undefined}
            />
          ) : testDetailsQuery.isError ? (
            <p role="alert" className={ALERT_CLASS}>{getErrorMessage(testDetailsQuery.error)}</p>
          ) : (
            <p className="text-sm text-muted-foreground" role="status" aria-busy="true">Loading…</p>
          )
        )}

        {tab === 'docs' && <ScriptDocs idKey={idKey} scriptType={scriptType} />}
      </div>

      {editing && (
        <ScriptEditorDialog
          idKey={idKey}
          title={`${selected ? 'Editing' : 'Initializing'} Code for Script: ${text(script.values.name)}`}
          files={fileSchemas.map((schema) => ({ ...schema, contents: fileContents[schema.name] ?? '' }))}
          scriptId={scriptId}
          initialApiName={text(selected?.values.apiName) || undefined}
          initialApiVersion={text(selected?.values.apiVersion) || undefined}
          scriptType={scriptType}
          testFields={canTest ? tester : undefined}
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
 * The list of a script's versions, newest first, each with its API name and version.
 *
 * @param props - Component props.
 * @param props.revisions - Revision records.
 * @param props.selected - The selected revision.
 * @param props.currentId - Id of the script's current revision.
 * @param props.isLoading - Whether revisions are still loading.
 * @param props.error - Load error, if any.
 * @param props.onSelect - Selects a revision by id.
 * @param props.idPrefix - Prefix of each version button's `data-qqq-id`.
 * @returns The versions list.
 */
function VersionsList({ revisions, selected, currentId, isLoading, error, onSelect, idPrefix }: {
  revisions: QRecord[]
  selected: QRecord | undefined
  currentId: unknown
  isLoading: boolean
  error: Error | null
  onSelect: (id: unknown) => void
  idPrefix: string
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
            const id = text(revision.values.id)
            const apiLine = revisionApiLine(revision)
            return (
              <li key={id}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelect(revision.values.id)}
                  className={cn(
                    'w-full rounded-md border px-3 py-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-ring',
                    isSelected ? 'border-primary bg-accent' : 'border-border hover:bg-accent'
                  )}
                  data-qqq-id={`${idPrefix}${id}`}
                >
                  <span className="flex items-center gap-2 font-medium text-foreground">
                    <span>Version {text(revision.values.sequenceNo)}</span>
                    {isCurrent && (
                      <span className="rounded border border-green-600 px-1 text-xs text-green-700 dark:text-green-400">CURRENT</span>
                    )}
                  </span>
                  <span className="block break-words text-foreground">{text(revision.values.commitMessage)}</span>
                  <span className="block text-xs text-muted-foreground" data-qqq-id={`script-version-when-${id}`}>
                    {dateTimeText(revision.values.createDate)} by {text(revision.values.author)}
                  </span>
                  {apiLine && (
                    <span className="block break-words text-xs text-muted-foreground" data-qqq-id={`script-version-api-${id}`}>
                      {apiLine}
                    </span>
                  )}
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
 * @param props.idKey - Viewer id suffix.
 * @param props.source - Where logs come from.
 * @param props.scriptRevisionId - Revision whose logs are shown.
 * @returns The logs table or its loading, error and empty states.
 */
function ScriptLogs({ idKey, source, scriptRevisionId }: {
  idKey: string
  source: ScriptLogsSource
  scriptRevisionId: string | number
}) {
  const logsQuery = useQuery({
    queryKey: source.queryKey(scriptRevisionId),
    queryFn: () => source.load(scriptRevisionId),
    meta: HANDLES_OWN_ERRORS,
    retry: false,
  })
  if (logsQuery.isPending) return <p className="text-sm text-muted-foreground" role="status" aria-busy="true">Loading…</p>
  if (logsQuery.isError) return <p role="alert" className={ALERT_CLASS}>Error loading script logs: {getErrorMessage(logsQuery.error)}</p>
  if (logsQuery.data.length === 0) return <p className="text-sm text-muted-foreground">No logs available for this version.</p>
  return (
    <div className="max-h-[28rem] overflow-auto rounded-md border border-border">
      <table className="min-w-full text-sm" data-qqq-id={`script-logs-${idKey}`}>
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
