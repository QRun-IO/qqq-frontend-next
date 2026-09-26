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
 * @file TableApiDocs — the table developer view's "API Docs & Playground": pick one of
 * the application APIs (and versions) that expose the table and browse or try its
 * OpenAPI spec in an embedded RapiDoc.
 */

'use client'

import React, { useContext, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { apiTableSpecUrl, getApiVersions, getTableApis } from '@/lib/api/developer'
import { HANDLES_OWN_ERRORS, queryKeys } from '@/lib/query-client'
import { ThemeContext } from '@/lib/theme/theme-provider'
import { getErrorMessage } from '@/lib/utils/error-utils'

/** localStorage keys shared with the Material dashboard. */
const LAST_API_NAME_KEY = 'qqq.tableDeveloperView.lastApiName'
const LAST_API_VERSION_KEY = 'qqq.tableDeveloperView.lastApiVersion'

const SELECT_CLASS =
  'rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring'

/**
 * Reads a remembered selection.
 * @param key - localStorage key.
 * @returns The stored text, or null when absent or storage is unavailable.
 */
function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

/**
 * Remembers a selection; storage failures are ignored.
 * @param key - localStorage key.
 * @param value - Text to store.
 */
function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // private mode or blocked storage: the selection is simply not remembered
  }
}

/** Props for {@link TableApiDocs}. */
export interface TableApiDocsProps {
  /** Exact backend table identifier. */
  tableName: string
  /** Branding accent color for RapiDoc's primary color. */
  primaryColor?: string
}

/**
 * Renders the API selectors and the embedded RapiDoc reference for a table.
 *
 * @param props - {@link TableApiDocsProps}
 * @returns The "API Docs & Playground" section.
 */
export function TableApiDocs({ tableName, primaryColor }: TableApiDocsProps) {
  const [apiChoice, setApiChoice] = useState<string | null>(null)
  const [versionChoice, setVersionChoice] = useState<string | null>(null)

  const apisQuery = useQuery({
    queryKey: queryKeys.tableApis(tableName),
    queryFn: () => getTableApis(tableName),
    meta: HANDLES_OWN_ERRORS,
    retry: false,
  })
  const apis = apisQuery.data ?? []
  const storedApiName = readStored(LAST_API_NAME_KEY)
  const selectedApi = apis.find((api) => api.name === apiChoice)
    ?? apis.find((api) => api.name === storedApiName)
    ?? apis[0]

  const versionsQuery = useQuery({
    queryKey: queryKeys.apiVersions(selectedApi?.path ?? ''),
    queryFn: () => getApiVersions(selectedApi!.path),
    enabled: Boolean(selectedApi),
    meta: HANDLES_OWN_ERRORS,
    retry: false,
  })
  const supportedVersions = selectedApi ? versionsQuery.data?.supportedVersions ?? [] : []
  const storedVersion = readStored(LAST_API_VERSION_KEY)
  let selectedVersion: string | undefined
  if (selectedApi && versionsQuery.data) {
    if (versionChoice && supportedVersions.includes(versionChoice)) selectedVersion = versionChoice
    else if (storedVersion && supportedVersions.includes(storedVersion)) selectedVersion = storedVersion
    else selectedVersion = versionsQuery.data.currentVersion ?? supportedVersions[0]
  }

  const selectedApiName = selectedApi?.name
  useEffect(() => {
    if (selectedApiName) writeStored(LAST_API_NAME_KEY, selectedApiName)
  }, [selectedApiName])
  useEffect(() => {
    if (selectedVersion) writeStored(LAST_API_VERSION_KEY, selectedVersion)
  }, [selectedVersion])

  const noApis = apisQuery.isSuccess && apis.length === 0

  return (
    <section
      className="overflow-hidden rounded-xl border border-border bg-card"
      aria-labelledby="table-dev-api-docs-heading"
      data-qqq-id="table-dev-api-docs"
    >
      <div className="flex flex-wrap items-center gap-4 p-4">
        <h3 id="table-dev-api-docs-heading" className="text-lg font-semibold text-foreground">
          API Docs & Playground
        </h3>
        {selectedApi && (
          <div className="flex items-center gap-2">
            <label htmlFor="table-dev-api-select" className="text-sm text-foreground">API</label>
            <select
              id="table-dev-api-select"
              data-qqq-id="select-api"
              className={SELECT_CLASS}
              value={selectedApi.name}
              onChange={(event) => {
                setApiChoice(event.target.value)
                setVersionChoice(null)
              }}
            >
              {apis.map((api) => (
                <option key={api.name} value={api.name}>{api.label}</option>
              ))}
            </select>
          </div>
        )}
        {selectedVersion && supportedVersions.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="table-dev-version-select" className="text-sm text-foreground">Version</label>
            <select
              id="table-dev-version-select"
              data-qqq-id="select-api-version"
              className={SELECT_CLASS}
              value={selectedVersion}
              onChange={(event) => setVersionChoice(event.target.value)}
            >
              {supportedVersions.map((version) => (
                <option key={version} value={version}>{version}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {(apisQuery.isPending || (selectedApi && versionsQuery.isPending)) && (
        <p className="px-4 pb-4 text-sm text-muted-foreground" role="status" aria-busy="true">Loading APIs…</p>
      )}
      {apisQuery.isError && (
        <p className="px-4 pb-4 text-sm text-destructive" role="alert">
          Failed to load APIs: {getErrorMessage(apisQuery.error)}
        </p>
      )}
      {versionsQuery.isError && selectedApi && (
        <p className="px-4 pb-4 text-sm text-destructive" role="alert">
          Failed to load API versions: {getErrorMessage(versionsQuery.error)}
        </p>
      )}
      {noApis && (
        <p className="px-4 pb-4 text-sm text-foreground" data-qqq-id="table-dev-no-apis">
          This table is not available in any APIs.
        </p>
      )}
      {selectedApi && selectedVersion && (
        <div className="border-t border-border" data-qqq-id="table-dev-api-reference">
          <RapiDocViewer specUrl={apiTableSpecUrl(selectedApi, selectedVersion, tableName)} primaryColor={primaryColor} />
        </div>
      )}
    </section>
  )
}

/**
 * Loads the RapiDoc web component on the client and renders it for one spec.
 *
 * The bundle touches `window` and `customElements` when evaluated, so it is imported
 * inside an effect and never during static rendering.
 *
 * @param props - Component props.
 * @param props.specUrl - OpenAPI spec URL.
 * @param props.primaryColor - Accent color for RapiDoc.
 * @returns The `<rapi-doc>` element once the component is registered.
 */
function RapiDocViewer({ specUrl, primaryColor }: { specUrl: string; primaryColor?: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const isDarkMode = useContext(ThemeContext)?.isDarkMode ?? false

  useEffect(() => {
    let cancelled = false
    import('rapidoc')
      .then(() => { if (!cancelled) setState('ready') })
      .catch(() => { if (!cancelled) setState('failed') })
    return () => { cancelled = true }
  }, [])

  if (state === 'failed') {
    return <p className="p-4 text-sm text-destructive" role="alert">The API reference could not be loaded.</p>
  }
  if (state === 'loading') {
    return <p className="p-4 text-sm text-muted-foreground" role="status" aria-busy="true">Loading API reference…</p>
  }
  // Every attribute is a string: RapiDoc reads "false" from the attribute, and React
  // drops custom-element attributes whose value is boolean false.
  return React.createElement('rapi-doc', {
    'spec-url': specUrl,
    'render-style': 'view',
    'show-header': 'false',
    'allow-authentication': 'true',
    'persist-auth': 'true',
    'allow-server-selection': 'false',
    'allow-spec-file-download': 'true',
    'sort-endpoints-by': 'none',
    'schema-description-expanded': 'true',
    'show-curl-before-try': 'true',
    'primary-color': primaryColor || 'blue',
    theme: isDarkMode ? 'dark' : 'light',
    'load-fonts': 'false',
    'regular-font': "var(--font-inter, 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
    'mono-font': 'Monaco, Menlo, Consolas, source-code-pro, monospace',
    style: { display: 'block', height: '75vh', width: '100%' },
  })
}
