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

/** @file Explicit isolated project creation through the semantic scripting API. */

'use client'

import React, { useId, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { createScriptProject } from '@/lib/api/scripting'
import { useUiApiExtensionInstalled } from '@/lib/api/ui-api-extensions'
import { HANDLES_OWN_ERRORS } from '@/lib/query-client'
import { getErrorMessage } from '@/lib/utils/error-utils'
import { IsolatedScriptEditor } from './IsolatedScriptEditor'
import { ALERT_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from './ScriptPanels'

/**
 * Create a separate source project and immediately open the shared IDE.
 * @returns Extension-gated creation panel or the newly created project editor.
 */
export function CreateIsolatedScript() {
  const installed = useUiApiExtensionInstalled('scripting')
  const inputId = useId()
  const [name, setName] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const create = useMutation({
    mutationFn: () => createScriptProject(name), retry: false, meta: HANDLES_OWN_ERRORS,
    onError: (error) => { if (isAxiosError(error) && !error.response) setUncertain(true) },
  })
  if (!installed) return null
  if (create.data) return <IsolatedScriptEditor scriptId={create.data} label={name.trim()} />
  return <section aria-label="Create TypeScript project" className="space-y-3 rounded-xl border border-border bg-card p-6">
    <h2 className="text-base font-semibold">New TypeScript project</h2>
    <p className="text-sm text-muted-foreground">Create a source project, then save, build, test and publish each revision explicitly.</p>
    <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); if (!uncertain && !create.isPending && name.trim()) create.mutate() }}>
      <div><label htmlFor={inputId} className="block text-sm">Project name</label><input id={inputId} className={INPUT_CLASS} required maxLength={200} value={name} disabled={uncertain || create.isPending} onChange={(event) => setName(event.target.value)} /></div>
      <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={!name.trim() || uncertain || create.isPending}>{create.isPending ? 'Creating…' : 'Create TypeScript project'}</button>
    </form>
    {uncertain ? <p role="status">The server may have created this project. Check the Scripts table before trying again.</p> : create.error && <p role="alert" className={ALERT_CLASS}>{getErrorMessage(create.error)}</p>}
  </section>
}
