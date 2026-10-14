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
 * @file RecordApiAccess — the record developer view's "API Access": the requests a developer can
 * make for this record through the v1 data API (the UI's own routes, session cookie) and through
 * each application API that exposes the table (from its OpenAPI spec, token auth), limited to
 * what the current user may do, with copyable curl, fetch and Java examples built from the
 * record's values and links to the API's docs and specs. Credentials are placeholders only.
 */

'use client'

import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import type { QProcessMetaData, QRecord, QTableMetaData } from '@/types'
import apiClient from '@/lib/api/client'
import { apiMiddlewareBaseURL, apiTableSpecUrl, getApiTableSpec, getApiVersions, getTableApis, type ApiInstance } from '@/lib/api/developer'
import { HANDLES_OWN_ERRORS, queryKeys } from '@/lib/query-client'
import { API_KEY_ENV, SESSION_PLACEHOLDER, TOKEN_ENV, buildSnippet, specOperations, v1Operations, type ApiAuth, type ApiOperation, type SnippetLanguage } from '@/lib/utils/api-examples'
import { cn } from '@/lib/utils/cn'
import { getErrorMessage } from '@/lib/utils/error-utils'
import { CodeBlock } from '@/components/scripts/HighlightedCode'
import { CopyButton } from './DeveloperSection'
import { PanelLink } from './DeveloperPanelView'

const LANGUAGE_KEY = 'qqq.recordDeveloperView.snippetLanguage'
const LANGUAGES: Array<{ id: SnippetLanguage; label: string }> = [
  { id: 'curl', label: 'curl' },
  { id: 'fetch', label: 'JavaScript (fetch)' },
  { id: 'java', label: 'Java' },
]

/**
 * Reads the remembered snippet language.
 * @returns The language, curl by default.
 */
function storedLanguage(): SnippetLanguage {
  try {
    const value = window.localStorage.getItem(LANGUAGE_KEY)
    return value === 'fetch' || value === 'java' ? value : 'curl'
  } catch {
    return 'curl'
  }
}

/**
 * Absolute URL of the v1 data API the UI uses.
 * @returns e.g. `https://admin.example.com/qqq/v1`.
 */
function v1BaseUrl(): string {
  const configured = apiClient.getInstance().defaults.baseURL ?? '/qqq/v1'
  const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin
  return new URL(configured, origin).toString().replace(/\/$/, '')
}

/**
 * Absolute URL of an application API path.
 * @param path - Root-relative path.
 * @returns The absolute URL.
 */
function middlewareUrl(path: string): string {
  const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin
  return new URL(`${apiMiddlewareBaseURL() ?? ''}${path}`, origin).toString()
}

/** Props for {@link RecordApiAccess}. */
export interface RecordApiAccessProps {
  table: QTableMetaData
  record: QRecord
  /** Processes the record view offers (permission-filtered). */
  processes: QProcessMetaData[]
}

/**
 * The API Access section body.
 *
 * @param props - See {@link RecordApiAccessProps}.
 * @returns Source tabs, the language picker and the operations.
 */
export function RecordApiAccess({ table, record, processes }: RecordApiAccessProps) {
  const [language, setLanguageState] = useState<SnippetLanguage>(() => (typeof window === 'undefined' ? 'curl' : storedLanguage()))
  const [source, setSource] = useState<string>('v1')

  const setLanguage = (value: SnippetLanguage) => {
    setLanguageState(value)
    try {
      window.localStorage.setItem(LANGUAGE_KEY, value)
    } catch {
      // storage unavailable: the choice is simply not remembered
    }
  }

  const apisQuery = useQuery({
    queryKey: queryKeys.tableApis(table.name),
    queryFn: () => getTableApis(table.name),
    meta: HANDLES_OWN_ERRORS,
    retry: false,
  })
  const apis = apisQuery.data ?? []
  const selectedApi = apis.find((api) => api.name === source)

  const v1 = useMemo(() => v1Operations({ baseUrl: v1BaseUrl(), table, record, processes }), [table, record, processes])

  return (
    <div className="space-y-4" data-qqq-id="dev-api-access">
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="API">
        <SourceTab id="v1" label="QQQ data API (v1)" selected={source === 'v1'} onSelect={setSource} />
        {apis.map((api) => <SourceTab key={api.name} id={api.name} label={api.label} selected={source === api.name} onSelect={setSource} />)}
        {apisQuery.isLoading && <span role="status" className="text-xs text-muted-foreground">Looking for application APIs…</span>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span id="dev-snippet-language" className="text-xs font-medium text-muted-foreground">Examples in</span>
        <div className="flex rounded-lg border border-border bg-muted/50 p-0.5" role="radiogroup" aria-labelledby="dev-snippet-language">
          {LANGUAGES.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={language === option.id}
              onClick={() => setLanguage(option.id)}
              className={cn('rounded-md px-2.5 py-1 text-xs font-medium', language === option.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              data-qqq-id={`dev-snippet-language-${option.id}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {selectedApi
        ? <ApplicationApiOperations api={selectedApi} table={table} record={record} language={language} />
        : (
          <div role="tabpanel" className="space-y-3">
            <AuthNote auth="session" />
            <OperationList operations={v1} auth="session" language={language} empty="You have no permission to read or change records in this table." />
          </div>
        )}
    </div>
  )
}

/**
 * One API source tab.
 * @param props - Tab state.
 * @returns The tab button.
 */
function SourceTab({ id, label, selected, onSelect }: { id: string; label: string; selected: boolean; onSelect: (id: string) => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={() => onSelect(id)}
      className={cn('rounded-md border px-3 py-1.5 text-sm font-medium', selected ? 'border-primary bg-primary/10 text-primary' : 'border-input bg-card text-foreground hover:bg-accent')}
      data-qqq-id={`dev-api-source-${id}`}
    >
      {label}
    </button>
  )
}

/**
 * Explains the placeholder credentials of a source.
 * @param props - The auth kind.
 * @param props.auth - How requests authenticate.
 * @returns The note.
 */
function AuthNote({ auth }: { auth: ApiAuth }) {
  const text = auth === 'session'
    ? <>These are the routes this screen uses. From a browser on this site they use your session cookie; elsewhere, send the <code className="font-mono">sessionUUID</code> cookie (shown as <code className="font-mono">{SESSION_PLACEHOLDER}</code>).</>
    : auth === 'apiKey'
      ? <>Authenticate with an API key in the <code className="font-mono">x-api-key</code> header (shown as <code className="font-mono">${API_KEY_ENV}</code>).</>
      : <>Authenticate with a bearer token (shown as <code className="font-mono">${TOKEN_ENV}</code>).</>
  return <p className="text-xs text-muted-foreground">{text} Only the operations you are allowed to perform are listed.</p>
}

/**
 * Operations of an application API version that exposes the table, read from its OpenAPI spec.
 * @param props - The API, record and snippet language.
 * @returns Version picker, doc links and operations.
 */
function ApplicationApiOperations({ api, table, record, language }: { api: ApiInstance; table: QTableMetaData; record: QRecord; language: SnippetLanguage }) {
  const [versionChoice, setVersionChoice] = useState<string | null>(null)
  const versionsQuery = useQuery({
    queryKey: [...queryKeys.tableApis(table.name), api],
    queryFn: () => getApiVersions(api),
    meta: HANDLES_OWN_ERRORS,
    retry: false,
  })
  const versions = versionsQuery.data?.supportedVersions ?? []
  const version = versionChoice && versions.includes(versionChoice) ? versionChoice : versionsQuery.data?.currentVersion ?? versions[0]

  const specQuery = useQuery({
    queryKey: queryKeys.apiTableSpec(api.path, version ?? '', table.name),
    queryFn: () => getApiTableSpec(api, version!, table.name),
    enabled: Boolean(version),
    meta: HANDLES_OWN_ERRORS,
    retry: false,
  })
  const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin
  const parsed = useMemo(() => specQuery.data ? specOperations({ spec: specQuery.data, origin, table, record }) : null, [specQuery.data, origin, table, record])

  return (
    <div role="tabpanel" className="space-y-3" data-qqq-id={`dev-api-${api.name}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {versions.length > 0 && (
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            Version
            <select
              value={version}
              onChange={(event) => setVersionChoice(event.target.value)}
              className="rounded border border-input bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              data-qqq-id="dev-api-version"
            >
              {versions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        )}
        {version && (
          <>
            <PanelLink href={middlewareUrl(`${api.path}${version}/`)} external>API docs</PanelLink>
            <PanelLink href={middlewareUrl(`${api.path}${version}/openapi.json`)} external>OpenAPI spec</PanelLink>
            <PanelLink href={new URL(apiTableSpecUrl(api, version, table.name), origin).toString()} external>{table.label} spec</PanelLink>
          </>
        )}
      </div>
      {(versionsQuery.isLoading || specQuery.isLoading) && <p role="status" className="text-sm text-muted-foreground">Loading the API specification…</p>}
      {(versionsQuery.isError || specQuery.isError) && (
        <p role="alert" className="text-sm text-destructive">The API specification could not be loaded: {getErrorMessage(versionsQuery.error ?? specQuery.error)}</p>
      )}
      {parsed && (
        <>
          <p className="text-xs text-muted-foreground">Base URL <code className="break-all font-mono">{parsed.serverUrl}</code></p>
          <AuthNote auth={parsed.auth} />
          <OperationList operations={parsed.operations} auth={parsed.auth} language={language} empty="This API version offers no operations on this table that you may perform." />
        </>
      )}
    </div>
  )
}

const METHOD_CLASSES: Record<ApiOperation['method'], string> = {
  GET: 'bg-sky-600/10 text-sky-700 dark:text-sky-400',
  POST: 'bg-green-600/10 text-green-700 dark:text-green-400',
  PUT: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  PATCH: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  DELETE: 'bg-destructive/10 text-destructive',
}

/**
 * The operations, each expandable to its snippet.
 * @param props - Operations, auth, language and empty text.
 * @returns The list.
 */
function OperationList({ operations, auth, language, empty }: { operations: ApiOperation[]; auth: ApiAuth; language: SnippetLanguage; empty: string }) {
  if (operations.length === 0) return <p className="text-sm italic text-muted-foreground">{empty}</p>
  return (
    <ul className="m-0 list-none space-y-2 p-0">
      {operations.map((operation, index) => {
        const snippet = buildSnippet(operation, auth, language)
        return (
          <li key={operation.id} className="rounded-lg border border-border">
            <details open={index === 0} className="group">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-3 py-2 marker:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-qqq-id={`dev-api-op-${operation.id}`}>
                <span className={cn('rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold', METHOD_CLASSES[operation.method])}>{operation.method}</span>
                <span className="text-sm font-medium text-foreground">{operation.label}</span>
                <code className="min-w-0 basis-full break-all font-mono text-xs text-muted-foreground sm:basis-auto">{operation.url}</code>
              </summary>
              <div className="space-y-2 border-t border-border px-3 py-3">
                {operation.description && <p className="text-xs text-muted-foreground">{operation.description}</p>}
                <div className="flex justify-end gap-2">
                  <CopyButton text={operation.url} label="Copy URL" caption="Copy URL" />
                  <CopyButton text={snippet} label={`Copy ${language} example`} caption="Copy example" />
                </div>
                <CodeBlock code={snippet} language={language === 'java' ? 'java' : language === 'fetch' ? 'javascript' : 'text'} className="max-h-96" dataQqqId={`dev-api-snippet-${operation.id}`} />
              </div>
            </details>
          </li>
        )
      })}
    </ul>
  )
}
