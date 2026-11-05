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

/** @file Companion tools with a compact chooser and focused setup workspace. */
'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  Info,
  Monitor,
  Printer,
  Smartphone,
  Terminal,
  Wrench,
} from 'lucide-react'
import { apiUrl } from '@/lib/api/client'
import { useMetaData } from '@/lib/hooks/use-metadata'
import { useAppTreeRoutes } from '@/lib/hooks/use-routes'
import { connectionUrl, downloadLink, toolsCatalogSchema, type Tool } from './tools-catalog'

const actionClass =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

/** Copy without breaking commands across lines.
 * @param props - Text, accessible label and optional terminal treatment.
 * @returns Scrollable text and clipboard feedback.
 */
function CopyValue({
  value,
  label,
  terminal = false,
}: {
  value: string
  label: string
  terminal?: boolean
}) {
  const [status, setStatus] = useState('')
  const multiline = value.includes('\n')
  return (
    <div className="min-w-0">
      <div
        className={`flex min-w-0 gap-2 ${multiline ? 'flex-col items-stretch' : 'items-center'} ${terminal ? 'py-2' : 'rounded-lg border border-border bg-background px-3 py-2'}`}
      >
        <code
          className={`min-w-0 flex-1 max-h-64 overflow-auto whitespace-pre py-1 text-xs leading-6 ${terminal ? 'text-slate-100' : 'text-foreground'}`}
          tabIndex={0}
          aria-label={label}
        >
          {value}
        </code>
        <button
          type="button"
          aria-label={multiline ? 'Copy install script' : `Copy ${label}`}
          title={`Copy ${label}`}
          className={`flex h-9 shrink-0 items-center justify-center gap-2 rounded-md ${multiline ? 'w-full border border-slate-600 px-3 text-xs' : 'w-9'} transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${terminal ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          data-qqq-id={`tools-copy-${label.replace(/ /g, '-')}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value)
              setStatus('Copied')
            } catch {
              setStatus('Could not copy. Select and copy the text above.')
            }
          }}
        >
          {status === 'Copied' ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )}
          {multiline &&
            (status === 'Copied' ? 'Copied � paste into your terminal' : 'Copy install script')}
        </button>
      </div>
      <span
        role="status"
        className={
          status && status !== 'Copied'
            ? `block py-1 text-xs ${terminal ? 'text-slate-200' : 'text-muted-foreground'}`
            : 'sr-only'
        }
      >
        {status}
      </span>
    </div>
  )
}

/** Stable product icon with a fallback for future catalog entries.
 * @param props - Tool identifier and icon classes.
 * @returns Product icon.
 */
function ToolIcon({ id, className }: { id: string; className?: string }) {
  const Icon =
    (
      { terminal: Terminal, scanner: Smartphone, printing: Printer } as Record<
        string,
        typeof Wrench
      >
    )[id] ?? Wrench
  return <Icon className={className} aria-hidden="true" />
}

/** Platform and package-manager choices supplied by the catalog.
 * @param props - Selected tool with supported install methods.
 * @returns In-app installation instructions and copyable commands.
 */
function InstallInstructions({ tool }: { tool: Tool }) {
  const [platform, setPlatform] = useState(() => {
    const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent.toLowerCase()
    return ua.includes('win')
      ? 'windows'
      : ua.includes('mac')
        ? 'macos'
        : ua.includes('android')
          ? 'android'
          : 'linux'
  })
  const [method, setMethod] = useState('')
  const options = tool.installOptions
  if (options.length === 0) return null
  const platforms = options.filter(
    (option, index) => options.findIndex((other) => other.platform === option.platform) === index
  )
  const selectedPlatform = platforms.some((option) => option.platform === platform)
    ? platform
    : platforms[0].platform
  const methods = options.filter((option) => option.platform === selectedPlatform)
  const selected = methods.find((option) => option.method === method) ?? methods[0]
  return (
    <div className="mb-6 border-b border-border pb-6" data-qqq-id="tools-install-instructions">
      <h3 className="mb-3 text-sm font-semibold">Install {tool.label}</h3>
      <div className="mb-3 flex flex-wrap gap-3">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground">
          Platform
          <select
            aria-label="Install platform"
            value={selectedPlatform}
            onChange={(event) => {
              setPlatform(event.target.value)
              setMethod('')
            }}
            data-qqq-id="tools-install-platform"
            className="min-h-10 min-w-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-ring"
          >
            {platforms.map((option) => (
              <option key={option.platform} value={option.platform}>
                {option.platformLabel}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground">
          Install with
          <select
            aria-label="Install method"
            value={selected.method}
            onChange={(event) => setMethod(event.target.value)}
            data-qqq-id="tools-install-method"
            className="min-h-10 min-w-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-ring"
          >
            {methods.map((option) => (
              <option key={option.method}>{option.method}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{selected.instructions}</p>
      {selected.commands.length > 0 && (
        <div className="min-w-0 overflow-hidden rounded-xl bg-slate-950 p-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {selected.shell}
          </p>
          {selected.commands.map((command, index) => (
            <CopyValue
              key={command}
              terminal
              value={command}
              label={`${selected.method} install command ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** Render an available tool's setup in one consistently sized workspace.
 * @param props - Selected tool, public server and visible management destination.
 * @returns Setup panel.
 */
function SetupPanel({
  tool,
  server,
  management,
}: {
  tool: Tool
  server?: string
  management?: { path: string; label: string }
}) {
  const download = downloadLink(tool.downloadUrl)
  const guide = downloadLink(tool.guideUrl)
  return (
    <section
      id="tools-setup-panel"
      aria-labelledby="tools-setup-heading"
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
      data-qqq-id={`tools-setup-${tool.id}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-5 border-b border-border px-5 py-5 sm:px-6">
        <div className="min-w-0 flex-1 basis-64">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Setup guide
          </p>
          <h2 id="tools-setup-heading" className="text-xl font-semibold tracking-tight">
            {tool.label}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {tool.summary}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {download && (
            <a
              className={`${actionClass} bg-primary text-primary-foreground shadow-sm hover:bg-primary/90`}
              href={download}
              target="_blank"
              rel="noopener noreferrer"
              data-qqq-id={`tools-download-${tool.id}`}
            >
              <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
              {tool.downloadLabel}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
          {guide && (
            <a
              className={`${actionClass} border border-border hover:bg-muted`}
              href={guide}
              target="_blank"
              rel="noopener noreferrer"
              data-qqq-id={`tools-guide-${tool.id}`}
            >
              Installation guide
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
        </div>
      </header>
      <div className="grid min-w-0 xl:grid-cols-2">
        <div className="min-w-0 px-5 py-6 sm:px-6">
          <InstallInstructions tool={tool} />
          <h3 className="mb-5 text-sm font-semibold">Connect and start using it</h3>
          <ol className="space-y-6">
            {tool.steps.map((step, index) => (
              <li key={index} className="flex gap-3">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <span className="pt-0.5 text-sm leading-relaxed">
                  <span className="sr-only">Step {index + 1}. </span>
                  {step}
                </span>
              </li>
            ))}
          </ol>
          {management && (
            <Link
              href={management.path}
              className={`${actionClass} mt-5 border border-border hover:bg-muted`}
              data-qqq-id={`tools-manage-${tool.id}`}
            >
              Open {management.label}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </div>
        <div
          role="group"
          className="min-w-0 space-y-5 border-t border-border bg-muted/25 px-5 py-6 sm:px-6 xl:border-l xl:border-t-0"
          aria-label="Connection details"
        >
          <div>
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
              <Monitor className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Connect to this instance
            </h3>
            <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
              Use this server address and sign in with your QQQ account.
            </p>
            {server ? (
              <CopyValue key={server} value={server} label="server address" />
            ) : (
              <p className="text-sm text-muted-foreground">
                Ask your administrator for the public HTTPS server address before connecting a
                client.
              </p>
            )}
            {server && /^http:\/\//.test(server) && (
              <p className="mt-2 text-xs text-muted-foreground">
                Local development only. Other devices need a reachable HTTPS address.
              </p>
            )}
          </div>
          {tool.commands.length > 0 && (
            <div className="min-w-0 overflow-hidden rounded-xl bg-slate-950 p-4 text-slate-100">
              <div className="mb-2 flex items-center gap-2 border-b border-slate-700 pb-3 text-xs font-medium text-slate-300">
                <Terminal className="h-4 w-4" aria-hidden="true" />
                Terminal commands
              </div>
              {tool.commands.map((command, index) =>
                command.includes('{server}') && !server ? null : (
                  <CopyValue
                    key={`${command}-${server}`}
                    terminal
                    label={`${tool.label} command ${index + 1}`}
                    value={command.replace(/\{server\}/g, `"${server}"`)}
                  />
                )
              )}
            </div>
          )}
          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Your existing permissions apply. Each device signs in separately.
          </p>
        </div>
      </div>
      <footer className="flex items-start gap-2 border-t border-border px-5 py-4 text-xs leading-relaxed text-muted-foreground sm:px-6">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {tool.note}
      </footer>
    </section>
  )
}

/** Render the catalog with one selected tool, keeping every available tool visible.
 * @param props - Standard widget payload.
 * @returns Tool chooser and setup panel, or a recoverable error.
 */
export default function ToolsWidget({ data }: { data: unknown }) {
  const metadata = useMetaData()
  const { navTargets } = useAppTreeRoutes(metadata.data)
  const [selectedId, setSelectedId] = useState<string>()
  const parsed = toolsCatalogSchema.safeParse(data)
  if (!parsed.success)
    return (
      <p role="alert">
        Tools information could not be loaded. Refresh the page or contact your administrator.
      </p>
    )
  const catalog = parsed.data
  const server =
    typeof window === 'undefined'
      ? undefined
      : connectionUrl(catalog.serverUrl, apiUrl(''), window.location.origin)
  const available = catalog.tools.filter((tool) => tool.available)
  const unavailable = catalog.tools.filter((tool) => !tool.available)
  const selected = available.find((tool) => tool.id === selectedId) ?? available[0]
  return (
    <div className="space-y-5" data-qqq-id="tools-catalog">
      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Your workspace, beyond the browser. Choose a tool to download it and connect to this
        instance.
      </p>
      <div className="grid gap-3 md:grid-cols-3" aria-label="Choose a tool">
        {available.map((tool) => (
          <button
            key={tool.id}
            type="button"
            aria-pressed={selected?.id === tool.id}
            aria-controls="tools-setup-panel"
            aria-label={`Set up ${tool.label}`}
            data-qqq-id={`tools-card-${tool.id}`}
            onClick={() => setSelectedId(tool.id)}
            className={`group flex min-w-0 items-center gap-3 rounded-xl border p-4 text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:items-start ${selected?.id === tool.id ? 'border-primary bg-primary/5 shadow-[inset_0_0_0_1px_var(--primary)]' : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30'}`}
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${selected?.id === tool.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            >
              <ToolIcon id={tool.id} className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{tool.label}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                {tool.platforms}
              </span>
            </span>
            {selected?.id === tool.id && (
              <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            )}
          </button>
        ))}
      </div>
      {selected && (
        <SetupPanel
          key={selected.id}
          tool={selected}
          server={server}
          management={navTargets.find(
            (target) => target.nodeType === 'APP' && target.key === selected.manageApp
          )}
        />
      )}
      {unavailable.length > 0 && (
        <details
          className="rounded-xl border border-dashed border-border px-4 py-3"
          data-qqq-id="tools-unavailable"
        >
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            More tools � {unavailable.length} not enabled
          </summary>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {unavailable.map((tool) => (
              <div
                key={tool.id}
                className="rounded-lg bg-muted/40 p-3"
                data-qqq-id={`tools-card-${tool.id}`}
              >
                <h2 className="text-sm font-medium">{tool.label}</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Not enabled on this instance. Ask your administrator about enabling this tool.
                </p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
