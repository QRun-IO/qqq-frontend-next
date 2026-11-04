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

/** @file Source-first editor for isolated TypeScript projects; every lifecycle action is explicit. */

'use client'

import React, { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { isAxiosError } from 'axios'
import {
  compileScriptRevision, getScriptApiTypes, getScriptBuild, getScriptDraft, getScriptProject, importScriptDraft,
  publishScriptBuild, saveScriptDraft, scriptCapabilitySchema, testScriptContext,
  type ScriptBuild, type ScriptContextResult, type ScriptProject, type ScriptSourceFile, type ScriptProvenance,
} from '@/lib/api/scripting'
import { useUiApiExtensionInstalled } from '@/lib/api/ui-api-extensions'
import { HANDLES_OWN_ERRORS } from '@/lib/query-client'
import { getErrorMessage } from '@/lib/utils/error-utils'
import { CodeEditor } from './CodeEditor'
import { ScriptHookPanel } from './ScriptHookPanel'
import type { IdeDefinition } from '@/lib/scripting/typescript-session'
import { ALERT_CLASS, BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from './ScriptPanels'

const INITIAL_SOURCE = 'import type { Context, Qqq } from "@qqq/sdk";\n\nexport async function main(context: Context, qqq: Qqq) {\n  return {};\n}\n'
const LanguageEditor = lazy(() => import('./TypeScriptSourceEditor').then((module) => ({ default: module.TypeScriptSourceEditor })))

/** Properties for a shared isolated Script project editor. */
export interface IsolatedScriptEditorProps {
  /** Core project identity; no caller-supplied runtime or actor. */
  scriptId: string | number
  /** Accessible panel heading. */
  label: string
}

/**
 * Discover the optional extension and load authorized project/source views.
 * @param props - Project identity and label.
 * @returns Source editor or a fail-closed availability message.
 */
export function IsolatedScriptEditor({ scriptId, label }: IsolatedScriptEditorProps) {
  const installed = useUiApiExtensionInstalled('scripting')
  const [selected, setSelected] = useState<number | null>(null)
  const project = useQuery({
    queryKey: ['scripting', scriptId, 'project'], queryFn: ({ signal }) => getScriptProject(scriptId, signal),
    enabled: installed, retry: false, meta: HANDLES_OWN_ERRORS,
  })
  const revisionId = selected ?? project.data?.latestRevisionId ?? null
  const draft = useQuery({
    queryKey: ['scripting', scriptId, 'revision', revisionId],
    queryFn: ({ signal }) => getScriptDraft(scriptId, revisionId!, signal),
    enabled: installed && revisionId !== null, retry: false, meta: HANDLES_OWN_ERRORS,
  })
  if (!installed) return <p role="status">The isolated scripting editor requires the scripting API extension.</p>
  if (project.error || draft.error) return <p role="alert" className={ALERT_CLASS}>{getErrorMessage(project.error ?? draft.error)}</p>
  if (!project.data || (revisionId !== null && !draft.data)) return <p role="status">Loading script project…</p>
  if (project.data.executionMode !== 'ISOLATED') return <p role="alert">This editor requires an isolated script project.</p>

  return <SourceWorkspace
    key={`${scriptId}:${revisionId ?? 'new'}`}
    scriptId={scriptId} label={label} project={project.data} revisionId={revisionId}
    initialFiles={draft.data?.files ?? [{ path: 'src/index.ts', content: INITIAL_SOURCE }]}
    provenance={draft.data?.provenance ?? null}
    onSelect={setSelected}
    onSaved={async (id) => { await project.refetch(); setSelected(id) }}
    onRefresh={async () => { await project.refetch() }}
  />
}

interface WorkspaceProps extends IsolatedScriptEditorProps {
  project: ScriptProject
  revisionId: number | null
  initialFiles: ScriptSourceFile[]
  provenance: ScriptProvenance | null
  onSelect: (id: number) => void
  onSaved: (id: number) => Promise<void>
  onRefresh: () => Promise<void>
}

/**
 * Keep unsaved files local while all durable state lives in the shared registry.
 * @param props - Authorized snapshot and refresh callbacks.
 * @returns Explicit draft/build/test/publish controls and diagnostics.
 */
function SourceWorkspace({ scriptId, label, project, revisionId, initialFiles, provenance, onSelect, onSaved, onRefresh }: WorkspaceProps) {
  const [files, setFiles] = useState(initialFiles)
  const [baseRevisionId] = useState(project.latestRevisionId)
  const [active, setActive] = useState(initialFiles[0]?.path ?? '')
  const [newPath, setNewPath] = useState('')
  const [entryPoint, setEntryPoint] = useState(initialFiles[0]?.path ?? 'src/index.ts')
  const [note, setNote] = useState('')
  const [capabilityText, setCapabilityText] = useState('[]')
  const [contextText, setContextText] = useState('{}')
  const [build, setBuild] = useState<ScriptBuild | null>(null)
  const [test, setTest] = useState<ScriptContextResult | null>(null)
  const [declarations, setDeclarations] = useState('')
  const [notice, setNotice] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const [repository, setRepository] = useState(provenance?.repository ?? '')
  const [commitSha, setCommitSha] = useState(provenance?.commitSha ?? '')
  const [subdirectory, setSubdirectory] = useState(provenance?.subdirectory ?? '')
  const [selection, setSelection] = useState<IdeDefinition | null>(null)
  const controller = useRef<AbortController | null>(null)
  const dirty = revisionId === null || JSON.stringify(files) !== JSON.stringify(initialFiles)
  const file = files.find((candidate) => candidate.path === active) ?? files[0]

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  useEffect(() => () => controller.current?.abort(), [])

  const operation = useMutation({
    mutationFn: async (work: (signal: AbortSignal) => Promise<void>) => {
      controller.current = new AbortController()
      setNotice('')
      await work(controller.current.signal)
    },
    onError: (error) => {
      if (isAxiosError(error) && !error.response) setUncertain(true)
    },
    meta: HANDLES_OWN_ERRORS,
  })
  const busy = operation.isPending
  const disabled = busy || uncertain
  const can = (action: string) => project.actions.includes(action)
  const capabilities = () => z.array(scriptCapabilitySchema).max(20).parse(JSON.parse(capabilityText))
  const changeFiles = (next: ScriptSourceFile[]) => { setFiles(next); setBuild(null); setTest(null) }

  return <section className="space-y-4 rounded-xl border border-border bg-card p-4" aria-label={label}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-lg font-semibold">{label}</h3><p className="text-sm text-muted-foreground">Isolated TypeScript · {dirty ? 'Unsaved draft' : `Revision ${revisionId}`}</p></div>
      <label className="text-sm">Source revision <select className={INPUT_CLASS} value={revisionId ?? ''} disabled={disabled}
        onChange={(event) => {
          if (!dirty || window.confirm('Discard unsaved source changes?')) onSelect(Number(event.target.value))
        }}>
        {revisionId === null && <option value="">New draft</option>}
        {project.revisions.map((item) => <option key={item.id} value={item.id}>#{item.sequence ?? item.id} {item.message ?? ''}</option>)}
      </select></label>
    </div>
    {!project.workerAvailable && <p role="status" className="text-sm">The isolated compiler/runtime is unavailable. Source can be reviewed and saved; building and testing require the configured worker.</p>}
    <p className="text-sm text-muted-foreground">Save creates a draft. Build compiles saved files. Test runs that build with the context below. Publish creates an immutable version; it does not attach a record hook.</p>
    {provenance && <p className="break-all text-sm" aria-label="Imported source provenance">Imported {provenance.repository}@{provenance.commitSha}{provenance.subdirectory ? ` / ${provenance.subdirectory}` : ''} · by {provenance.importedBy} · SHA-256 {provenance.sourceSha256}</p>}
    {project.importAvailable && <details><summary className="cursor-pointer text-sm font-medium">Import / sync from an exact GitHub commit</summary>
      <p className="my-2 text-sm text-muted-foreground">Select a directory containing only TypeScript source. Import creates a new draft; review it before building, testing and publishing. Repository access is managed by the server.</p>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm">GitHub repository<input className={INPUT_CLASS} value={repository} disabled={disabled || !can('draft')} maxLength={201} placeholder="owner/repository" onChange={(event) => setRepository(event.target.value)} /></label>
        <label className="text-sm">Commit SHA<input className={INPUT_CLASS} value={commitSha} disabled={disabled || !can('draft')} maxLength={40} onChange={(event) => setCommitSha(event.target.value)} /></label>
        <label className="text-sm">Source subdirectory<input className={INPUT_CLASS} value={subdirectory} disabled={disabled || !can('draft')} maxLength={200} placeholder="scripts" onChange={(event) => setSubdirectory(event.target.value)} /></label>
      </div>
      <button type="button" className={BUTTON_CLASS} disabled={disabled || !can('draft') || !repository || !/^[a-f0-9]{40}$/.test(commitSha) || (dirty && revisionId !== null)}
        onClick={() => operation.mutate(async (signal) => onSaved(await importScriptDraft(scriptId, baseRevisionId, repository, commitSha, subdirectory || null, signal)))}>Import commit as draft</button>
      {dirty && revisionId !== null && <p className="text-sm">Save or discard local source edits before importing.</p>}
    </details>}
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-sm">File <select className={INPUT_CLASS} value={file?.path ?? ''} onChange={(event) => setActive(event.target.value)}>
        {files.map((item) => <option key={item.path}>{item.path}</option>)}
      </select></label>
      <label className="text-sm">New file path <input className={INPUT_CLASS} value={newPath} disabled={disabled || !can('draft')} onChange={(event) => setNewPath(event.target.value)} placeholder="src/helper.ts" /></label>
      <button type="button" className={BUTTON_CLASS} disabled={disabled || !can('draft') || !newPath || files.some((item) => item.path === newPath)}
        onClick={() => { changeFiles([...files, { path: newPath, content: '' }]); setActive(newPath); setNewPath('') }}>Add file</button>
      <button type="button" className={BUTTON_CLASS} disabled={disabled || !can('draft') || files.length < 2}
        onClick={() => { const next = files.filter((item) => item.path !== file.path); changeFiles(next); setActive(next[0].path) }}>Remove file</button>
    </div>
    <Suspense fallback={<p role="status">Loading TypeScript editor…</p>}>
      <LanguageEditor files={files} active={file.path} readOnly={disabled || !can('draft')} declarations={declarations} selection={selection}
        onNavigate={(target) => { if (files.some((item) => item.path === target.file)) { setActive(target.file); setSelection(target) } }}
        onChange={(content) => changeFiles(files.map((item) => item.path === file.path ? { ...item, content } : item))} />
    </Suspense>
    <div className="grid gap-3 md:grid-cols-2">
      <label className="text-sm">Entry file <input className={INPUT_CLASS} value={entryPoint} disabled={disabled} onChange={(event) => { setEntryPoint(event.target.value); setBuild(null); setTest(null) }} /></label>
      <label className="text-sm">Revision / publication note <input className={INPUT_CLASS} value={note} maxLength={2000} disabled={disabled} onChange={(event) => setNote(event.target.value)} /></label>
    </div>
    <details><summary className="cursor-pointer text-sm font-medium">Read capabilities and scoped API types</summary>
      <p className="my-2 text-sm text-muted-foreground">Each declaration names operation READ, table, fields, maxRows and maxCalls. Reads also require your current permissions.</p>
      <CodeEditor id={`script-capabilities-${scriptId}`} ariaLabel="Read capability declarations" language="json" rows={6} value={capabilityText}
        readOnly={disabled} onChange={(value) => { setCapabilityText(value); setBuild(null); setTest(null); setDeclarations('') }} />
      <button type="button" className={BUTTON_CLASS} disabled={disabled} onClick={() => operation.mutate(async (signal) => setDeclarations(await getScriptApiTypes(scriptId, capabilities(), signal)))}>Load scoped API types</button>
      {declarations && <CodeEditor id={`script-types-${scriptId}`} ariaLabel="Scoped API declarations" language="typescript" rows={10} value={declarations} readOnly />}
    </details>
    <div className="flex flex-wrap gap-2">
      <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={disabled || !can('draft') || !dirty}
        onClick={() => operation.mutate(async (signal) => onSaved(await saveScriptDraft(scriptId, baseRevisionId, files, note, signal)))}>Save draft</button>
      <button type="button" className={BUTTON_CLASS} disabled={disabled || dirty || revisionId === null || !can('check') || !project.workerAvailable}
        onClick={() => operation.mutate(async (signal) => { setBuild(await compileScriptRevision(scriptId, revisionId!, entryPoint, capabilities(), signal)); setTest(null); await onRefresh() })}>Build saved revision</button>
      <button type="button" className={BUTTON_CLASS} disabled={disabled || dirty || !build?.success || !can('test') || !project.workerAvailable}
        onClick={() => operation.mutate(async (signal) => {
          const input = JSON.parse(contextText) as unknown
          if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Test context must be a JSON object')
          setTest(await testScriptContext(scriptId, build!.buildId, input as Record<string, unknown>, capabilities(), signal))
        })}>Test context</button>
      <button type="button" className={BUTTON_CLASS} disabled={disabled || dirty || !build?.success || test?.status !== 'OK' || !can('publish')}
        onClick={() => operation.mutate(async (signal) => { const id = await publishScriptBuild(scriptId, build!.buildId, note, signal); setNotice(`Published immutable version ${id}.`); await onRefresh() })}>Publish tested build</button>
      {busy && <button type="button" className={BUTTON_CLASS} onClick={() => { controller.current?.abort(); setUncertain(true) }}>Stop waiting</button>}
      {uncertain && <button type="button" className={BUTTON_CLASS} disabled={busy} onClick={() => operation.mutate(async () => { await onRefresh() })}>Refresh server history</button>}
    </div>
    <ScriptHookPanel scriptId={scriptId} project={project} build={dirty ? null : build} disabled={disabled} capabilities={capabilities}
      run={(work) => operation.mutate(work)} onTested={setTest} />
    {uncertain && <p role="status">Observation stopped. Server work may still finish. Refresh and inspect history, then reopen the editor before another mutation.</p>}
    {operation.error && !uncertain && <p role="alert" className={ALERT_CLASS}>{getErrorMessage(operation.error)}</p>}
    {notice && <p role="status">{notice}</p>}
    {build && <div aria-label="Build diagnostics">
      <p className="font-medium">Build {build.buildId}: {build.success ? 'Compiled' : 'Failed'}</p>
      <ul>{build.diagnostics.map((diagnostic, index) => <li key={index}>
        <button type="button" className="text-left underline" onClick={() => {
          const source = files.find((item) => item.path === diagnostic.file)
          if (!source) return
          const lines = source.content.split('\n')
          const line = Math.max(0, Math.min(lines.length - 1, diagnostic.line - 1))
          const offset = lines.slice(0, line).reduce((sum, text) => sum + text.length + 1, 0) + Math.max(0, Math.min(lines[line].length, diagnostic.column - 1))
          setActive(source.path); setSelection({ file: source.path, from: offset, to: offset })
        }}>{diagnostic.file}:{diagnostic.line}:{diagnostic.column}</button>
        {' '}{diagnostic.code}: {diagnostic.message}
      </li>)}</ul>
    </div>}
    <details open><summary className="cursor-pointer text-sm font-medium">Context test input and result</summary>
      <CodeEditor id={`script-context-${scriptId}`} ariaLabel="Context test input" language="json" rows={6} value={contextText} readOnly={disabled}
        onChange={(value) => { setContextText(value); setTest(null) }} />
      {test && <div role="status"><p>Execution {test.executionId}: {test.status}</p><pre className="overflow-auto whitespace-pre-wrap text-sm">{test.contextJson ?? test.message}</pre></div>}
    </details>
    <details><summary className="cursor-pointer text-sm font-medium">Recent builds and publications (up to 100 each)</summary>
      <ul>{project.builds.map((item) => <li key={item.id}>Build {item.id}: {item.status} · revision {item.revisionId}
        {item.revisionId === revisionId && <button type="button" className={BUTTON_CLASS} disabled={disabled || dirty}
          onClick={() => operation.mutate(async (signal) => { setBuild(await getScriptBuild(scriptId, item.id, signal)); setTest(null) })}>Load diagnostics</button>}
      </li>)}</ul>
      <ul>{project.publications.map((item) => <li key={item.id}>Publication {item.id} · version {item.version} · {item.actor}</li>)}</ul>
    </details>
  </section>
}
