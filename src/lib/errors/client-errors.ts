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
 * @file Client error reports: one place every error boundary and stream failure reports to.
 *
 * A report is logged to the console with its correlation (request) id and, when a sink is
 * registered (the assistant registers its `POST /assistant/client-errors` operation), sent to
 * the backend so failures show up in Admin. Reports are PII/PHI-safe: messages and stacks are
 * redacted and bounded, the route is a path without its query string, and no record data,
 * prompts or answers are ever included.
 */

import { AxiosError } from 'axios'

import { recentRequestIds } from '@/lib/qa-capture/request-ids'

/** Where in the UI a failure happened. */
export type ClientErrorScope =
  | 'page'
  | 'widget'
  | 'record-section'
  | 'assistant-panel'
  | 'assistant-message'
  | 'assistant-part'
  | 'assistant-render'
  | 'assistant-stream'
  | (string & {})

/** Context a caller adds to a report (ids only, never content). */
export interface ClientErrorContext {
  scope: ClientErrorScope
  componentStack?: string | null
  conversationId?: number | null
  messageId?: number | null
  turnId?: number | null
  partType?: string | null
  renderType?: string | null
  requestId?: string | null
}

/** The report body, as `POST /assistant/client-errors` takes it. */
export interface ClientErrorReport {
  scope: string
  message: string
  errorName?: string
  stack?: string
  componentStack?: string
  requestId?: string
  route?: string
  conversationId?: number
  messageId?: number
  turnId?: number
  partType?: string
  renderType?: string
  appVersion?: string
  occurredAt: string
}

/** Sends a report; a rejection is swallowed (reporting must never fail the page). */
export type ClientErrorSink = (report: ClientErrorReport) => Promise<unknown>

const LIMITS = { scope: 64, message: 500, errorName: 100, stack: 4000, componentStack: 4000, requestId: 128, route: 300, type: 64, appVersion: 64 }
/** Reports sent per page load; the rest are only logged. */
export const MAX_REPORTS_PER_SESSION = 25
/** The same failure (scope + message) is reported once per window. */
export const DUPLICATE_WINDOW_MS = 30_000

let sink: ClientErrorSink | null = null
let sent = 0
const recent = new Map<string, number>()

/**
 * Registers (or clears, with null) where reports are sent.
 *
 * @param next - The sink, or null to only log.
 */
export function setClientErrorSink(next: ClientErrorSink | null): void {
  sink = next
}

const REDACTIONS: Array<[RegExp, string]> = [
  [/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[token]'],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]'],
  [/\b\d{3}-\d{2}-\d{4}\b/g, '[number]'],
  [/\+?\d[\d ().-]{6,}\d/g, '[number]'],
  [/([?&][^=\s&#]+=)[^&\s#]+/g, '$1[value]'],
]

/**
 * Removes values that may identify a person (emails, long numbers, tokens, query values).
 *
 * @param text - Free text from an error.
 * @returns The text with such values replaced.
 */
export function redactClientErrorText(text: string): string {
  let result = text
  for (const [pattern, replacement] of REDACTIONS) result = result.replace(pattern, replacement)
  return result
}

/**
 * Bounds a string and drops it when empty.
 *
 * @param value - Any value.
 * @param max - The maximum length.
 * @param redact - Whether to redact the text first.
 * @returns The bounded string, or undefined.
 */
function bounded(value: unknown, max: number, redact = false): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = (redact ? redactClientErrorText(value) : value).trim()
  if (!text) return undefined
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/**
 * A positive integer id, or undefined.
 *
 * @param value - Any value.
 * @returns The id.
 */
function idOf(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined
}

/**
 * The server's correlation id for a failed request: the error's own (assistant stream errors
 * carry it), the `X-Request-Id` response header of an HTTP error, or the newest one collected.
 *
 * @param error - Any thrown value.
 * @returns The request id, when one is known.
 */
export function requestIdOf(error: unknown): string | undefined {
  if (error && typeof error === 'object') {
    const own = (error as { requestId?: unknown }).requestId
    if (typeof own === 'string' && own) return own
    if (error instanceof AxiosError) {
      const headers = error.response?.headers as Record<string, unknown> | undefined
      const header = headers?.['x-request-id'] ?? headers?.['X-Request-Id']
      if (typeof header === 'string' && header) return header
    }
  }
  return recentRequestIds().at(-1)?.id
}

/**
 * Builds the PII-safe report for an error.
 *
 * @param error - Any thrown value.
 * @param context - Where it happened.
 * @param now - The time (tests).
 * @returns The report.
 */
export function buildClientErrorReport(error: unknown, context: ClientErrorContext, now = new Date()): ClientErrorReport {
  const err = error instanceof Error ? error : null
  const rawMessage = err?.message || (typeof error === 'string' ? error : 'Unknown error')
  const report: ClientErrorReport = {
    scope: bounded(context.scope, LIMITS.scope) ?? 'unknown',
    message: bounded(rawMessage, LIMITS.message, true) ?? 'Unknown error',
    occurredAt: now.toISOString(),
  }
  const optional: Partial<ClientErrorReport> = {
    errorName: bounded(err?.name, LIMITS.errorName),
    stack: bounded(err?.stack, LIMITS.stack, true),
    componentStack: bounded(context.componentStack ?? undefined, LIMITS.componentStack, true),
    requestId: bounded(context.requestId ?? requestIdOf(error), LIMITS.requestId),
    route: typeof window === 'undefined' ? undefined : bounded(window.location.pathname, LIMITS.route, true),
    conversationId: idOf(context.conversationId),
    messageId: idOf(context.messageId),
    turnId: idOf(context.turnId),
    partType: bounded(context.partType ?? undefined, LIMITS.type),
    renderType: bounded(context.renderType ?? undefined, LIMITS.type),
    appVersion: bounded(process.env.NEXT_PUBLIC_APP_VERSION, LIMITS.appVersion),
  }
  for (const [key, value] of Object.entries(optional)) {
    if (value !== undefined) (report as unknown as Record<string, unknown>)[key] = value
  }
  return report
}

/**
 * Reports a client failure: logs it (with its request id) and sends it to the registered sink,
 * at most {@link MAX_REPORTS_PER_SESSION} times per page load and once per duplicate window.
 * Never throws.
 *
 * @param error - Any thrown value.
 * @param context - Where it happened.
 * @returns The report that was built.
 */
export function reportClientError(error: unknown, context: ClientErrorContext): ClientErrorReport {
  const report = buildClientErrorReport(error, context)
  try {
    console.error(`[qqq] ${report.scope} failed${report.requestId ? ` (request ${report.requestId})` : ''}: ${report.message}`, error)
    const key = `${report.scope}|${report.message}`
    const now = Date.now()
    const last = recent.get(key)
    if (last !== undefined && now - last < DUPLICATE_WINDOW_MS) return report
    recent.set(key, now)
    if (!sink || sent >= MAX_REPORTS_PER_SESSION) return report
    sent++
    void sink(report).catch(() => undefined)
  } catch {
    // reporting is best effort
  }
  return report
}

/**
 * The plain-text details a user can copy into a bug report (no record data).
 *
 * @param report - The report.
 * @returns Readable lines.
 */
export function clientErrorDetails(report: ClientErrorReport): string {
  return [
    `What: ${report.scope}`,
    `Error: ${report.errorName ? `${report.errorName}: ` : ''}${report.message}`,
    report.requestId && `Request id: ${report.requestId}`,
    report.route && `Page: ${report.route}`,
    report.conversationId && `Conversation: ${report.conversationId}`,
    report.messageId && `Message: ${report.messageId}`,
    report.partType && `Part: ${report.partType}`,
    report.renderType && `Result type: ${report.renderType}`,
    report.appVersion && `Version: ${report.appVersion}`,
    `Time: ${report.occurredAt}`,
  ].filter(Boolean).join('\n')
}

/** Clears the counters and the sink (tests). */
export function resetClientErrorsForTesting(): void {
  sink = null
  sent = 0
  recent.clear()
}
