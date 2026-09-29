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
 * @file ScriptEditorDialog — Material's `ScriptEditor` modal: edit every file of a script in
 * split panes (each pane picks a file and colors it by its file type), choose the API name and
 * version the code runs against, test the unsaved code or read the docs beside it, and store
 * the result as a new, current revision (`storeScriptRevision`).
 *
 * Like Material, the editor does not close on Esc or on a click outside it, so unsaved code is
 * never dropped by accident; Cancel and the close button leave it. Leaving the page while the
 * code has changes asks for confirmation (beforeunload).
 */

'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Columns2, Loader2, X } from 'lucide-react'

import type { QRecord } from '@/types'
import { storeScriptRevision } from '@/lib/api/developer'
import { fetchTablePossibleValues } from '@/lib/api/possible-values'
import { useTableMetaData } from '@/lib/hooks/use-metadata'
import { useRestoreFocus } from '@/lib/hooks/use-restore-focus'
import { HANDLES_OWN_ERRORS, queryKeys } from '@/lib/query-client'
import { languageFor } from '@/lib/utils/code-highlight'
import { cn } from '@/lib/utils/cn'
import { getErrorMessage } from '@/lib/utils/error-utils'
import { CodeEditor } from './CodeEditor'
import { ALERT_CLASS, BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS, ScriptDocs, ScriptTest, type ScriptTestFields } from './ScriptPanels'
import { domId, type ScriptFileSchema } from './script-utils'

/** Commit message Material stores when none is typed. */
export const DEFAULT_COMMIT_MESSAGE = 'No commit message given'

/** The scripts model table whose apiName / apiVersion fields hold a revision's API. */
const SCRIPT_REVISION_TABLE = 'scriptRevision'

/** Message Material shows when a revision is saved without an API name and version. */
export const API_REQUIRED_MESSAGE = 'You must select a value for both API Name and API Version.'

type Tool = 'test' | 'docs'

/** Props for {@link ScriptEditorDialog}. */
export interface ScriptEditorDialogProps {
  /** Suffix of the dialog's DOM ids and `data-qqq-id`s. */
  idKey: string
  /** Dialog title. */
  title: string
  /** Every file of the script type, in schema order, with its starting contents. */
  files: (ScriptFileSchema & { contents: string })[]
  /** Script to add the revision to. */
  scriptId: string | number
  /** API name of the revision being edited. */
  initialApiName?: string
  /** API version of the revision being edited. */
  initialApiVersion?: string
  /** The script type (its docs), when loaded. */
  scriptType?: QRecord
  /** The tester's fields, when the session may test; enables the Test tool. */
  testFields?: ScriptTestFields
  /** Closes the dialog without saving. */
  onClose: () => void
  /**
   * Called with the new revision id after a successful save.
   * @param scriptRevisionId - The stored revision's id.
   */
  onSaved: (scriptRevisionId: number | undefined) => Promise<void>
}

/**
 * The choices of a script revision's API field, when the scripts model has that field.
 * @param fieldName - `apiName` or `apiVersion`.
 * @param enabled - Whether the field exists.
 * @returns The choices query.
 */
function useApiChoices(fieldName: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.fieldChoices(SCRIPT_REVISION_TABLE, fieldName),
    queryFn: () => fetchTablePossibleValues(SCRIPT_REVISION_TABLE, fieldName),
    enabled,
    meta: HANDLES_OWN_ERRORS,
    retry: false,
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * The multi-file script editor dialog.
 *
 * @param props - {@link ScriptEditorDialogProps}
 * @returns The dialog.
 */
export function ScriptEditorDialog({
  idKey,
  title,
  files,
  scriptId,
  initialApiName,
  initialApiVersion,
  scriptType,
  testFields,
  onClose,
  onSaved,
}: ScriptEditorDialogProps) {
  const initialContents = useMemo(() => Object.fromEntries(files.map((file) => [file.name, file.contents])), [files])
  const [contents, setContents] = useState<Record<string, string>>(initialContents)
  const [panes, setPanes] = useState<string[]>(() => (files.length ? [files[0].name] : []))
  const [commitMessage, setCommitMessage] = useState('')
  const [apiName, setApiName] = useState(initialApiName ?? '')
  const [apiVersion, setApiVersion] = useState(initialApiVersion ?? '')
  const [tool, setTool] = useState<Tool | null>(null)
  const [error, setError] = useState<string | null>(null)
  const restoreFocus = useRestoreFocus(true)

  const revisionTable = useTableMetaData(SCRIPT_REVISION_TABLE)
  const hasApiFields = Boolean(revisionTable.data?.fields?.apiName && revisionTable.data?.fields?.apiVersion)
  const apiNames = useApiChoices('apiName', hasApiFields)
  const apiVersions = useApiChoices('apiVersion', hasApiFields)

  const dirty = files.some((file) => (contents[file.name] ?? '') !== file.contents)
    || apiName !== (initialApiName ?? '') || apiVersion !== (initialApiVersion ?? '')
  useEffect(() => {
    if (!dirty) return
    /**
     * Asks before the page unloads with unsaved code.
     * @param event - The unload event.
     */
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', preventUnload)
    return () => window.removeEventListener('beforeunload', preventUnload)
  }, [dirty])

  const save = useMutation({
    mutationFn: () => storeScriptRevision({
      scriptId,
      commitMessage: commitMessage.trim() || DEFAULT_COMMIT_MESSAGE,
      files: Object.fromEntries(files.map((file) => [file.name, contents[file.name] ?? ''])),
      apiName: hasApiFields ? apiName : undefined,
      apiVersion: hasApiFields ? apiVersion : undefined,
    }),
    meta: HANDLES_OWN_ERRORS,
    onSuccess: (result) => onSaved(result.scriptRevisionId),
    onError: (saveError) => setError(getErrorMessage(saveError)),
  })

  /** Validates the API selection, then stores the revision. */
  function handleSave() {
    if (hasApiFields && (!apiName || !apiVersion)) {
      setError(API_REQUIRED_MESSAGE)
      return
    }
    setError(null)
    save.mutate()
  }

  const commitId = `script-commit-message-${domId(idKey)}`
  const fileType = (name: string) => files.find((file) => file.name === name)?.fileType

  return (
    <DialogPrimitive.Root open onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70" />
        <DialogPrimitive.Content
          onCloseAutoFocus={restoreFocus}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          aria-describedby={undefined}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[calc(100%-2rem)] max-w-6xl -translate-x-1/2 -translate-y-1/2 flex-col',
            'rounded-lg border border-border bg-card shadow-lg focus:outline-none'
          )}
          data-qqq-id={`dialog-script-editor-${idKey}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
            <DialogPrimitive.Title className="text-lg font-semibold text-foreground">{title}</DialogPrimitive.Title>
            <div className="flex items-center gap-2">
              <div role="group" aria-label="Tools" className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground" aria-hidden="true">Tools:</span>
                {testFields && (
                  <button
                    type="button"
                    aria-pressed={tool === 'test'}
                    className={cn(BUTTON_CLASS, tool === 'test' && 'border-primary bg-accent')}
                    onClick={() => setTool((current) => (current === 'test' ? null : 'test'))}
                    data-qqq-id={`button-script-editor-test-${idKey}`}
                  >
                    Test
                  </button>
                )}
                <button
                  type="button"
                  aria-pressed={tool === 'docs'}
                  className={cn(BUTTON_CLASS, tool === 'docs' && 'border-primary bg-accent')}
                  onClick={() => setTool((current) => (current === 'docs' ? null : 'docs'))}
                  data-qqq-id={`button-script-editor-docs-${idKey}`}
                >
                  Docs
                </button>
              </div>
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
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
            {hasApiFields && (
              <div className="grid gap-3 sm:grid-cols-2">
                <ApiSelect
                  id={`script-api-name-${domId(idKey)}`}
                  label="API Name"
                  value={apiName}
                  onChange={setApiName}
                  choices={apiNames.data}
                  isLoading={apiNames.isPending}
                  loadError={apiNames.error}
                  dataQqqId={`select-script-api-name-${idKey}`}
                />
                <ApiSelect
                  id={`script-api-version-${domId(idKey)}`}
                  label="API Version"
                  value={apiVersion}
                  onChange={setApiVersion}
                  choices={apiVersions.data}
                  isLoading={apiVersions.isPending}
                  loadError={apiVersions.error}
                  dataQqqId={`select-script-api-version-${idKey}`}
                />
              </div>
            )}

            <div className="flex flex-col gap-4 md:flex-row" data-qqq-id={`script-editor-panes-${idKey}`}>
              {panes.map((fileName, index) => {
                const selectId = `script-edit-file-${domId(idKey)}-${index}`
                return (
                  <div key={index} className="min-w-0 space-y-2 md:flex-1" data-qqq-id={`script-editor-pane-${idKey}-${index}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <label htmlFor={selectId} className="sr-only">File in editor {index + 1}</label>
                        <select
                          id={selectId}
                          className={cn(INPUT_CLASS, 'w-auto font-mono')}
                          value={fileName}
                          onChange={(event) => setPanes((current) => current.map((name, at) => (at === index ? event.target.value : name)))}
                          data-qqq-id={`select-script-editor-file-${idKey}-${index}`}
                        >
                          {files.map((file) => <option key={file.name} value={file.name}>{file.name}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-1">
                        {panes.length > 1 && (
                          <button
                            type="button"
                            aria-label={`Close editor split ${index + 1}`}
                            title="Close this editor split"
                            className={cn(BUTTON_CLASS, 'px-2')}
                            onClick={() => setPanes((current) => current.filter((_, at) => at !== index))}
                            data-qqq-id={`button-close-split-${idKey}-${index}`}
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}
                        {index === panes.length - 1 && (
                          <button
                            type="button"
                            aria-label="Open a new editor split"
                            title="Open a new editor split"
                            className={cn(BUTTON_CLASS, 'px-2')}
                            onClick={() => setPanes((current) => [...current, files[0].name])}
                            data-qqq-id={`button-split-editor-${idKey}`}
                          >
                            <Columns2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>
                    <CodeEditor
                      autocomplete
                      id={`script-edit-${domId(idKey)}-${index}`}
                      ariaLabel={fileName}
                      value={contents[fileName] ?? ''}
                      onChange={(value) => setContents((current) => ({ ...current, [fileName]: value }))}
                      language={languageFor(fileType(fileName))}
                      rows={tool ? 10 : 16}
                      dataQqqId={`script-editor-code-${idKey}-${index}`}
                    />
                  </div>
                )
              })}
            </div>

            {tool === 'test' && testFields && (
              <section aria-label="Test" className="rounded-md border border-border p-3">
                <ScriptTest
                  idKey={`${idKey}-editor`}
                  scriptId={scriptId}
                  files={contents}
                  inputFields={testFields.inputFields}
                  outputFields={testFields.outputFields}
                  apiName={apiName || undefined}
                  apiVersion={apiVersion || undefined}
                />
              </section>
            )}
            {tool === 'docs' && (
              <section aria-label="Docs" className="rounded-md border border-border p-3">
                <ScriptDocs idKey={`${idKey}-editor`} scriptType={scriptType} />
              </section>
            )}

            <div className="space-y-1">
              <label htmlFor={commitId} className="block text-sm font-medium text-foreground">Commit message</label>
              <input
                id={commitId}
                type="text"
                maxLength={250}
                className={INPUT_CLASS}
                value={commitMessage}
                onChange={(event) => setCommitMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    handleSave()
                  }
                }}
                placeholder={DEFAULT_COMMIT_MESSAGE}
              />
            </div>
            {error && <p role="alert" className={ALERT_CLASS} data-qqq-id={`script-editor-error-${idKey}`}>{error}</p>}
          </div>
          <div className="flex items-center justify-end gap-3 rounded-b-lg border-t border-border bg-muted px-4 py-3">
            <button
              type="button"
              className={BUTTON_CLASS}
              onClick={onClose}
              disabled={save.isPending}
              data-qqq-id={`button-cancel-script-${idKey}`}
            >
              Cancel
            </button>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={save.isPending}
              onClick={handleSave}
              data-qqq-id={`button-save-script-${idKey}`}
            >
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Save
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/**
 * A required select of a script revision's API name or version.
 *
 * @param props - Component props.
 * @param props.id - Select id.
 * @param props.label - Visible label (a required mark is added).
 * @param props.value - Selected value.
 * @param props.onChange - Called with the new value.
 * @param props.choices - The field's possible values.
 * @param props.isLoading - Whether choices are loading.
 * @param props.loadError - Error loading the choices.
 * @param props.dataQqqId - `data-qqq-id` of the select.
 * @returns The labeled select.
 */
function ApiSelect({ id, label, value, onChange, choices, isLoading, loadError, dataQqqId }: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  choices: { id: unknown; label: string }[] | undefined
  isLoading: boolean
  loadError: Error | null
  dataQqqId: string
}) {
  const options = choices ?? []
  const known = options.some((choice) => String(choice.id) === value)
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label} <span aria-hidden="true">*</span>
      </label>
      <select
        id={id}
        className={INPUT_CLASS}
        value={value}
        aria-required="true"
        aria-busy={isLoading || undefined}
        onChange={(event) => onChange(event.target.value)}
        data-qqq-id={dataQqqId}
      >
        <option value="">Select…</option>
        {value && !known && <option value={value}>{value}</option>}
        {options.map((choice) => <option key={String(choice.id)} value={String(choice.id)}>{choice.label}</option>)}
      </select>
      {loadError && <p role="alert" className="text-xs text-destructive">Could not load the choices: {getErrorMessage(loadError)}</p>}
    </div>
  )
}
