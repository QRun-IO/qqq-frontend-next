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
 * @file Developer page — shows debug information including session info, metadata stats, and API health.
 */

'use client'

/**
 * Developer page — shows debug information useful during development and support.
 *
 * Fixed route at `/app/developer` — takes priority over the dynamic `[slug]` route.
 *
 * Displays:
 * - Session info (auth type, user ID)
 * - Environment values from backend metadata
 * - Metadata stats (table / process / report / widget / app counts)
 * - API health check with response time
 * - Build info placeholder
 */

import React, { useState, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Copy, Check, Activity } from 'lucide-react'

import { useQContext } from '@/lib/context/q-context'
import { useAuth } from '@/lib/auth/use-auth'
import { loadMetaData } from '@/lib/api/metadata'
import apiClient from '@/lib/api/client'
import { queryKeys } from '@/lib/query-client'
import { cn } from '@/lib/utils/cn'

/** Duration in milliseconds before the "copied!" feedback resets to the copy icon. */
const COPY_RESET_MS = 2000

/**
 * A section card with a heading, optional copy button, and arbitrary content.
 */
interface SectionCardProps {
  /** Section heading text. */
  title: string
  /** Content to render inside the card. */
  children: React.ReactNode
  /** When provided, the "Copy JSON" button copies this value to the clipboard. */
  copyData?: unknown
  /** data-qqq-id value for the card wrapper. */
  dataQqqId?: string
}

/**
 * Renders a card section with a header and optional "Copy JSON" button.
 *
 * @param props - {@link SectionCardProps}
 * @returns A bordered card containing the section heading and children.
 */
function SectionCard({ title, children, copyData, dataQqqId }: SectionCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    if (copyData === undefined) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(copyData, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), COPY_RESET_MS)
    } catch {
      // Clipboard API unavailable — silent fail
    }
  }, [copyData])

  return (
    <div
      className="rounded-xl border border-border bg-card p-6 space-y-4"
      data-qqq-id={dataQqqId}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {copyData !== undefined && (
          <button
            type="button"
            onClick={handleCopy}
            aria-label={`Copy ${title} as JSON`}
            data-qqq-id={`button-copy-${title.toLowerCase().replace(/\s+/g, '-')}`}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1 text-xs font-medium',
              'text-muted-foreground bg-background hover:bg-accent',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'transition-colors duration-150'
            )}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-green-600" aria-hidden="true" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                Copy JSON
              </>
            )}
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

/**
 * Renders a simple key/value table.
 *
 * @param props - Component props.
 * @param props.rows - Array of `[key, value]` tuples to display.
 * @returns A definition list styled as a bordered table, or a "No data" message when empty.
 */
function KeyValueTable({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No data available.</p>
    )
  }
  return (
    <dl className="divide-y divide-border rounded-lg border border-border text-sm">
      {rows.map(([key, val]) => (
        <div
          key={key}
          className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-baseline sm:gap-4"
        >
          <dt className="font-medium text-muted-foreground sm:w-1/3 sm:flex-shrink-0 font-mono">
            {key}
          </dt>
          <dd className="text-foreground sm:flex-1 break-all">{val}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Developer debug page rendered at the fixed route `/app/developer`.
 *
 * Uses `useQContext()` for auth-related state and `useQuery` for metadata.
 * Provides an API health check that measures round-trip time to the metadata endpoint.
 *
 * @returns The developer page content wrapped in a container.
 */
export default function DeveloperPage() {
  const { userId, setPageHeader } = useQContext()

  useEffect(() => {
    setPageHeader('Developer')
  }, [setPageHeader])
  const { authMetadata } = useAuth()

  const { data: metaData } = useQuery({
    queryKey: queryKeys.metadataAll(),
    queryFn: loadMetaData,
    staleTime: 1000 * 60 * 30,
  })

  // API health check state
  const [healthStatus, setHealthStatus] = useState<
    'idle' | 'loading' | 'ok' | 'error'
  >('idle')
  const [healthMs, setHealthMs] = useState<number | null>(null)
  const [healthError, setHealthError] = useState<string | null>(null)

  /**
   * Fires a GET request to `/metaData` and measures the round-trip time.
   * Updates `healthStatus`, `healthMs`, and `healthError` accordingly.
   */
  const handleHealthCheck = useCallback(async () => {
    setHealthStatus('loading')
    setHealthMs(null)
    setHealthError(null)
    const start = performance.now()
    try {
      await apiClient.get('/metaData')
      const elapsed = Math.round(performance.now() - start)
      setHealthMs(elapsed)
      setHealthStatus('ok')
    } catch (err) {
      const elapsed = Math.round(performance.now() - start)
      setHealthMs(elapsed)
      setHealthStatus('error')
      setHealthError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  // Versions reported by the running bundle (Next.js publishes its version on window.next)
  const [nextVersion, setNextVersion] = useState<string | undefined>(undefined)
  useEffect(() => {
    setNextVersion((window as Window & { next?: { version?: string } }).next?.version)
  }, [])

  // Counts derived from metadata
  const tableCount = Object.keys(metaData?.tables ?? {}).length
  const processCount = Object.keys(metaData?.processes ?? {}).length
  const reportCount = Object.keys(metaData?.reports ?? {}).length
  const widgetCount = Object.keys(metaData?.widgets ?? {}).length
  const appCount = Object.keys(metaData?.apps ?? {}).length

  const metaStatsRows: Array<[string, React.ReactNode]> = [
    ['apps', appCount],
    ['tables', tableCount],
    ['processes', processCount],
    ['reports', reportCount],
    ['widgets', widgetCount],
  ]

  const sessionRows: Array<[string, React.ReactNode]> = [
    ['userId', userId ?? '(not set)'],
    ['authType', authMetadata?.type ?? '(unknown)'],
    ['authName', authMetadata?.name ?? '(unknown)'],
  ]

  const envRows: Array<[string, React.ReactNode]> = Object.entries(
    metaData?.environmentValues ?? {}
  )

  const buildRows: Array<[string, React.ReactNode]> = [
    ['framework', nextVersion ? `Next.js ${nextVersion}` : 'Next.js'],
    ['react', React.version],
    ['appVersion', process.env.NEXT_PUBLIC_APP_VERSION ?? 'unknown'],
    ['apiBaseUrl', process.env.NEXT_PUBLIC_API_BASE_URL ?? '/qqq/v1'],
  ]

  return (
    <div
      className="space-y-6"
      data-qqq-id="developer-page"
    >
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Developer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Debug information for developers and support staff.
        </p>
      </div>

      {/* Session Info */}
      <SectionCard
        title="Session Info"
        copyData={{ userId, authType: authMetadata?.type, authName: authMetadata?.name }}
        dataQqqId="developer-section-session"
      >
        <KeyValueTable rows={sessionRows} />
      </SectionCard>

      {/* Environment Values */}
      <SectionCard
        title="Environment Values"
        copyData={metaData?.environmentValues}
        dataQqqId="developer-section-environment"
      >
        {envRows.length > 0 ? (
          <KeyValueTable rows={envRows} />
        ) : (
          <p className="text-sm text-muted-foreground">
            No environment values returned by the backend.
          </p>
        )}
      </SectionCard>

      {/* Metadata Stats */}
      <SectionCard
        title="Metadata Stats"
        copyData={{ apps: appCount, tables: tableCount, processes: processCount, reports: reportCount, widgets: widgetCount }}
        dataQqqId="developer-section-metadata"
      >
        <KeyValueTable rows={metaStatsRows} />
      </SectionCard>

      {/* API Health */}
      <SectionCard
        title="API Health"
        dataQqqId="developer-section-health"
      >
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleHealthCheck}
            disabled={healthStatus === 'loading'}
            aria-label="Run API health check"
            data-qqq-id="button-api-health-check"
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
              'text-primary-foreground bg-primary hover:bg-primary/90',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'transition-colors duration-150'
            )}
          >
            {healthStatus === 'loading' ? (
              <>
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"
                  aria-hidden="true"
                />
                Checking&hellip;
              </>
            ) : (
              <>
                <Activity className="h-4 w-4" aria-hidden="true" />
                Check API Health
              </>
            )}
          </button>

          {healthStatus === 'ok' && healthMs !== null && (
            <p
              className="text-sm text-green-700 dark:text-green-400"
              aria-live="polite"
              data-qqq-id="developer-health-ok"
            >
              API responded in <strong>{healthMs} ms</strong>
            </p>
          )}

          {healthStatus === 'error' && (
            <div
              className="text-sm text-destructive"
              aria-live="assertive"
              data-qqq-id="developer-health-error"
            >
              <p>
                Health check failed
                {healthMs !== null ? ` after ${healthMs} ms` : ''}.
              </p>
              {healthError && (
                <p className="mt-1 font-mono text-xs">{healthError}</p>
              )}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Build Info */}
      <SectionCard
        title="Build Info"
        copyData={Object.fromEntries(buildRows.map(([k, v]) => [k, v]))}
        dataQqqId="developer-section-build"
      >
        <KeyValueTable rows={buildRows} />
      </SectionCard>

      {/* Raw metadata JSON */}
      {metaData && (
        <SectionCard
          title="Raw Metadata (JSON)"
          copyData={metaData}
          dataQqqId="developer-section-raw-metadata"
        >
          <pre
            className="overflow-auto rounded-lg bg-muted p-4 text-xs text-muted-foreground max-h-64"
            aria-label="Raw metadata JSON"
          >
            {JSON.stringify(
              {
                apps: Object.keys(metaData.apps ?? {}),
                tables: Object.keys(metaData.tables ?? {}),
                processes: Object.keys(metaData.processes ?? {}),
                reports: Object.keys(metaData.reports ?? {}),
                widgets: Object.keys(metaData.widgets ?? {}),
              },
              null,
              2
            )}
          </pre>
        </SectionCard>
      )}
    </div>
  )
}
