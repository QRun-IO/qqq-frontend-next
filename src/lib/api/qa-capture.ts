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
 * @file Typed operations of the qbit-qa-capture `qa-capture` 1.0.0 UI API extension. Callers
 * only request these when `GET /version` lists the extension. The capability is normalized so
 * that anything malformed reads as disabled (no capture).
 */

import type {
  QaCaptureCapabilityV1,
  QaCaptureReportRequestV1,
  QaCaptureReportV1,
  QaCaptureSanitizerV1,
} from '@/types/qa-capture'
import apiClient from './client'

/** Registered extension name. */
export const QA_CAPTURE_EXTENSION = 'qa-capture'

const ROOT = '/qbit/qa-capture'

/** The request id header used when the capability does not name one. */
export const DEFAULT_REQUEST_ID_HEADER = 'X-Request-Id'

/**
 * A string list from any value.
 *
 * @param value - Any value.
 * @returns The string items.
 */
function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

/**
 * A non-empty string, or null.
 *
 * @param value - Any value.
 * @returns The string or null.
 */
function str(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

/**
 * Normalizes the sanitizer rules, or null when absent.
 *
 * @param value - The rules as sent.
 * @returns The rules.
 */
function normalizeSanitizer(value: unknown): QaCaptureSanitizerV1 | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  return {
    redaction: str(raw.redaction) ?? '[redacted]',
    headerNames: strings(raw.headerNames).map((name) => name.toLowerCase()),
    bodyFieldNames: strings(raw.bodyFieldNames),
    queryParamNames: strings(raw.queryParamNames),
    valuePatterns: strings(raw.valuePatterns),
    dropPathPrefixes: strings(raw.dropPathPrefixes),
  }
}

/**
 * Normalizes a capability response. Capture is enabled only when the server says so and sends
 * a Jam team id and sanitizer rules; anything else reads as disabled.
 *
 * @param data - The response body.
 * @returns The capability.
 */
export function normalizeQaCaptureCapability(data: unknown): QaCaptureCapabilityV1 {
  const raw = data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {}
  const config = raw.providerConfig && typeof raw.providerConfig === 'object' ? (raw.providerConfig as Record<string, unknown>) : null
  const teamId = str(config?.teamId)
  const sanitizer = normalizeSanitizer(raw.sanitizer)
  const enabled = raw.enabled === true && raw.provider === 'jam' && teamId !== null && sanitizer !== null
  const qaMode = raw.qaMode && typeof raw.qaMode === 'object' ? (raw.qaMode as Record<string, unknown>) : {}
  const csp = raw.cspOrigins && typeof raw.cspOrigins === 'object' ? (raw.cspOrigins as Record<string, unknown>) : {}
  const context = raw.context && typeof raw.context === 'object' ? (raw.context as Record<string, unknown>) : {}
  const reportsHref = str(raw.reportsHref)
  return {
    enabled,
    reason: str(raw.reason) ?? 'OFF',
    provider: enabled ? 'jam' : null,
    providerConfig: enabled && teamId ? { teamId, recordingLinkId: str(config?.recordingLinkId), scriptUrls: strings(config?.scriptUrls) } : null,
    qaMode: {
      available: qaMode.available === true,
      active: qaMode.active === true,
      preferenceSection: str(qaMode.preferenceSection),
    },
    canReport: enabled && raw.canReport === true,
    // only an in-app path is followed
    reportsHref: reportsHref && reportsHref.startsWith('/') && !reportsHref.startsWith('//') && !reportsHref.startsWith('/\\') ? reportsHref : null,
    sanitizer: enabled ? sanitizer : null,
    blurSelectors: enabled ? strings(raw.blurSelectors) : [],
    cspOrigins: { scriptSrc: strings(csp.scriptSrc), frameSrc: strings(csp.frameSrc), connectSrc: strings(csp.connectSrc) },
    context: { environment: str(context.environment), backendVersion: str(context.backendVersion), node: str(context.node) },
    requestIdHeader: str(raw.requestIdHeader) ?? DEFAULT_REQUEST_ID_HEADER,
  }
}

/**
 * Loads whether QA capture is enabled for the signed-in user (`qaCaptureCapability`).
 *
 * @returns The normalized capability.
 */
export async function getQaCaptureCapability(): Promise<QaCaptureCapabilityV1> {
  return normalizeQaCaptureCapability(await apiClient.get<unknown>(`${ROOT}/capability`))
}

/**
 * Creates a QA report for the current page (`qaCaptureReportCreate`).
 *
 * @param request - The report.
 * @returns The created report with the Recording Link parameters, if configured.
 */
export async function createQaCaptureReport(request: QaCaptureReportRequestV1): Promise<QaCaptureReportV1> {
  const data = await apiClient.post<unknown>(`${ROOT}/report`, request)
  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  const params = raw.recordingParams && typeof raw.recordingParams === 'object' ? (raw.recordingParams as Record<string, unknown>) : null
  const recordingParams = params
    ? Object.fromEntries(Object.entries(params).filter((entry): entry is [string, string] => entry[0].startsWith('jam-') && typeof entry[1] === 'string'))
    : null
  return {
    id: typeof raw.id === 'number' ? raw.id : 0,
    reference: str(raw.reference) ?? '',
    title: str(raw.title),
    recordingParams: recordingParams && recordingParams['jam-recording'] ? recordingParams : null,
  }
}
