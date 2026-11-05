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

/** @file Source-project hook administration and read-only selected-record event tests. */

'use client'

import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createScriptBinding, getScriptHooks, setScriptBindingEnabled, testScriptHook,
  type ScriptBuild, type ScriptCapability, type ScriptHookEvent, type ScriptHookResult, type ScriptProject,
} from '@/lib/api/scripting'
import { HANDLES_OWN_ERRORS } from '@/lib/query-client'
import { getErrorMessage } from '@/lib/utils/error-utils'
import { CodeEditor } from './CodeEditor'
import { ALERT_CLASS, BUTTON_CLASS, INPUT_CLASS } from './ScriptPanels'

interface Props {
  scriptId: string | number
  project: ScriptProject
  build: ScriptBuild | null
  disabled: boolean
  capabilities: () => ScriptCapability[]
  run: (work: (signal: AbortSignal) => Promise<void>) => void
  onTested: (result: ScriptHookResult) => void
}

/**
 * Keep binding activation distinct from publication and tests distinct from writes.
 * @param props - Current authorized project and shared cancellable action runner.
 * @returns Explicit hook test, activation and paged retained binding controls.
 */
export function ScriptHookPanel({ scriptId, project, build, disabled, capabilities, run, onTested }: Props) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [tableName, setTableName] = useState('')
  const [event, setEvent] = useState<ScriptHookEvent>('PRE_INSERT')
  const [recordId, setRecordId] = useState('')
  const [changes, setChanges] = useState('{}')
  const [name, setName] = useState('')
  const [publication, setPublication] = useState<number | null>(null)
  const [patchFields, setPatchFields] = useState<string[]>([])
  const [tested, setTested] = useState<{ buildId: number; result: ScriptHookResult } | null>(null)
  const [cursor, setCursor] = useState<number | null>(null)
  const [notice, setNotice] = useState('')
  const catalog = useQuery({
    queryKey: ['scripting', scriptId, 'hooks', cursor],
    queryFn: ({ signal }) => getScriptHooks(scriptId, signal, cursor), enabled: open,
    retry: false, meta: HANDLES_OWN_ERRORS,
  })
  const target = catalog.data?.targets.find((item) => item.tableName === tableName) ?? catalog.data?.targets[0]
  const phase = target?.phases.find((item) => item.event === event) ?? target?.phases[0]
  const publicationId = publication ?? project.publications[0]?.id ?? null
  const canBind = project.actions.includes('bind')
  const canTest = project.actions.includes('test')
  const result = tested?.buildId === build?.buildId ? tested?.result : null
  const canChange = phase?.event === 'PRE_INSERT' || phase?.event === 'PRE_UPDATE'

  return <details data-qqq-id="script-hooks-panel" className="rounded-lg border border-border p-3" onToggle={(toggle) => setOpen(toggle.currentTarget.open)}>
    <summary data-qqq-id="script-hooks-toggle" className="cursor-pointer font-medium">Record hooks: test and bindings</summary>
    <p className="my-2 text-sm text-muted-foreground">Test reads the selected record and simulates this event. It never inserts, updates or deletes a record, and never applies the returned patch. Native field validation occurs during an actual write. Post events observe backend actions and do not prove commit.</p>
    {catalog.error && <p role="alert" className={ALERT_CLASS}>{getErrorMessage(catalog.error)}</p>}
    {catalog.isFetching && <p role="status">Loading authorized hook controls…</p>}
    {catalog.data && <div className="space-y-3">
      {target && phase ? <>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">Hook table<select data-qqq-id="script-hook-table" className={INPUT_CLASS} value={target.tableName} disabled={disabled} onChange={(change) => { setTableName(change.target.value); setRecordId(''); setPatchFields([]); setTested(null) }}>
            {catalog.data.targets.map((item) => <option key={item.tableName} value={item.tableName}>{item.label ?? item.tableName}</option>)}
          </select></label>
          <label className="text-sm">Hook event<select data-qqq-id="script-hook-event" className={INPUT_CLASS} value={phase.event} disabled={disabled} onChange={(change) => { setEvent(change.target.value as ScriptHookEvent); setPatchFields([]); setChanges('{}'); setTested(null) }}>
            {target.phases.map((item) => <option key={item.event}>{item.event}</option>)}
          </select></label>
          <label className="text-sm">Selected record ID<input data-qqq-id="script-hook-record-id" className={INPUT_CLASS} value={recordId} maxLength={1024} disabled={disabled} onChange={(change) => { setRecordId(change.target.value); setTested(null) }} /></label>
        </div>
        {phase.event.startsWith('AFTER_') && <p data-qqq-id="script-hook-delivery-semantics" className="text-sm text-muted-foreground">
          {phase.event === 'AFTER_DELETE'
            ? 'AFTER_DELETE runs from a committed Jobs intent and receives event metadata only, never deleted record values. This dry run reads the selected record for authorization, then sends only metadata; it does not delete or enqueue work.'
            : 'AFTER_INSERT and AFTER_UPDATE run from a committed Jobs intent and read the currently authorized record at delivery time, not its historical values. This dry run reads the selected current record; it does not write, enqueue work, or prove commit.'}
          {' '}AFTER scripts may only return ALLOW. Delivery failures cannot undo the committed write.
        </p>}
        {canChange && <CodeEditor id={`hook-changes-${scriptId}`} ariaLabel="Proposed hook test changes" language="json" rows={4}
          value={changes} readOnly={disabled} onChange={(value) => { setChanges(value); setTested(null) }} />}
        <button data-qqq-id="script-hook-test" type="button" className={BUTTON_CLASS} disabled={disabled || !build?.success || !recordId.trim() || !canTest || !project.workerAvailable}
          onClick={() => run(async (signal) => {
            const answer = await testScriptHook(scriptId, build!.buildId, { tableName: target.tableName, event: phase.event, recordId, changes: canChange ? JSON.parse(changes) as unknown : {} }, signal)
            setTested({ buildId: build!.buildId, result: answer }); onTested(answer)
          })}>Test hook without writes</button>
        {result && <div aria-label="Hook dry-run result"><p role="status">Hook dry run: {result.status}. No record changes were applied.</p>
          {result.message && <p className="text-sm">{result.message}</p>}
          {result.hook && <CodeEditor id={`hook-result-${scriptId}`} ariaLabel="Simulated hook decision" language="json" rows={5} value={JSON.stringify(result.hook, null, 2)} readOnly />}
        </div>}
        <fieldset className="space-y-2 rounded border border-border p-3" disabled={disabled || !canBind}>
          <legend className="px-1 text-sm font-medium">Create an enabled binding</legend>
          <p className="text-sm text-muted-foreground">This activates the chosen immutable publication for the table and event. Read grants use the editor’s capability declarations; the server checks them against that publication.</p>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">Binding name<input data-qqq-id="script-hook-binding-name" className={INPUT_CLASS} value={name} maxLength={200} onChange={(change) => setName(change.target.value)} /></label>
            <label className="text-sm">Published version<select data-qqq-id="script-hook-publication" className={INPUT_CLASS} value={publicationId ?? ''} onChange={(change) => setPublication(Number(change.target.value))}>
              {!publicationId && <option value="">Publish a tested build first</option>}
              {project.publications.map((item) => <option key={item.id} value={item.id}>Version {item.version ?? item.id} · publication {item.id}</option>)}
            </select></label>
          </div>
          {phase.patchableFields.length > 0 ? <div className="flex flex-wrap gap-3" aria-label="Allowed binding patch fields">
            {phase.patchableFields.map((field) => <label className="text-sm" key={field}><input data-qqq-id={`script-hook-patch-${encodeURIComponent(field)}`} type="checkbox" checked={patchFields.includes(field)} onChange={(change) => setPatchFields(change.target.checked ? [...patchFields, field] : patchFields.filter((selected) => selected !== field))} /> {field}</label>)}
          </div> : <p className="text-sm">This phase does not support patches.</p>}
          <button data-qqq-id="script-hook-create-binding" type="button" className={BUTTON_CLASS} disabled={disabled || !canBind || !publicationId || !name.trim() || !project.workerAvailable}
            onClick={() => run(async (signal) => {
              const id = await createScriptBinding(scriptId, { name, tableName: target.tableName, event: phase.event, publicationId: publicationId!, capabilities: capabilities(), patchableFields: patchFields.filter((field) => phase.patchableFields.includes(field)) }, signal)
              setNotice(`Binding ${id} is enabled.`); setCursor(null)
              await queryClient.invalidateQueries({ queryKey: ['scripting', scriptId, 'hooks'] })
            })}>Create enabled binding</button>
        </fieldset>
      </> : <p role="status">No host-installed hook phases are available under your current permissions.</p>}
      <div className="overflow-x-auto"><table className="w-full text-left text-sm" aria-label="Retained hook bindings">
        <thead><tr><th>Name</th><th>Table / event</th><th>Publication</th><th>State</th><th>Action</th></tr></thead>
        <tbody>{catalog.data.bindings.map((item) => <tr key={item.id}>
          <td>{item.name}</td><td>{item.tableName} / {item.event}</td><td>{item.publicationId}</td><td>{item.enabled ? 'Enabled' : 'Disabled'}</td>
          <td><button data-qqq-id={`script-hook-binding-state-${encodeURIComponent(String(item.id))}`} type="button" className={BUTTON_CLASS} disabled={disabled || !canBind || (!item.enabled && !project.workerAvailable)}
            onClick={() => run(async (signal) => { await setScriptBindingEnabled(scriptId, item.id, !item.enabled, signal); setNotice(`Binding ${item.id} ${item.enabled ? 'disabled' : 'enabled'}.`); await catalog.refetch() })}>{item.enabled ? 'Disable' : 'Enable'} {item.name}</button></td>
        </tr>)}</tbody>
      </table></div>
      {catalog.data.bindings.length === 0 && <p className="text-sm">No visible bindings on this page.</p>}
      <div className="flex gap-2">
        {cursor !== null && <button data-qqq-id="script-hook-bindings-first" type="button" className={BUTTON_CLASS} disabled={disabled} onClick={() => setCursor(null)}>First binding page</button>}
        {catalog.data.nextBindingId !== null && <button data-qqq-id="script-hook-bindings-older" type="button" className={BUTTON_CLASS} disabled={disabled} onClick={() => setCursor(catalog.data!.nextBindingId)}>Older bindings</button>}
        <button data-qqq-id="script-hook-bindings-refresh" type="button" className={BUTTON_CLASS} disabled={disabled} onClick={() => { void catalog.refetch() }}>Refresh bindings</button>
      </div>
      {catalog.data.historyLimited && <p className="text-sm">This view is bounded. Use older binding pages to manage retained bindings from earlier publications.</p>}
      {notice && <p role="status">{notice}</p>}
    </div>}
  </details>
}
