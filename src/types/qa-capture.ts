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
 * @file Types of the qbit-qa-capture `qa-capture` 1.0.0 UI API extension
 * (`src/lib/api/openapi/extensions/qa-capture.json`).
 */

/** Why capture is (or is not) enabled for the signed-in user. */
export type QaCaptureReason = 'AUDIENCE' | 'QA_MODE' | 'OFF' | 'NOT_CONFIGURED' | 'NO_ACCESS' | 'QA_MODE_OFF'

/** Provider settings the browser needs (Jam: team id, optional Recording Link id, script URLs). */
export interface QaCaptureProviderConfigV1 {
  /** Jam team id (the `jam:team` meta). */
  teamId: string
  /** Reusable Recording Link id for in-app "Report a bug", or null. */
  recordingLinkId: string | null
  /** Provider script URLs (informational; the SDK loads them itself). */
  scriptUrls: string[]
}

/** Self-serve QA mode. */
export interface QaCaptureQaModeV1 {
  /** Whether the user may toggle QA mode. */
  available: boolean
  /** Whether QA mode is on. */
  active: boolean
  /** Preference section that toggles QA mode, or null. */
  preferenceSection: string | null
}

/** Rules for the client-side capture sanitizers. */
export interface QaCaptureSanitizerV1 {
  /** Replacement text for redacted values. */
  redaction: string
  /** Lowercase header names removed from request and response headers. */
  headerNames: string[]
  /** JSON keys (any depth, case-insensitive) and form fields whose values are redacted. */
  bodyFieldNames: string[]
  /** Query parameters redacted in request URLs and removed from the page URL. */
  queryParamNames: string[]
  /** JavaScript RegExp sources, applied with flag `g`. */
  valuePatterns: string[]
  /** Same-origin path prefixes whose request and response bodies are dropped. */
  dropPathPrefixes: string[]
}

/** Origins the provider needs in the page Content-Security-Policy. */
export interface QaCaptureCspOriginsV1 {
  scriptSrc: string[]
  frameSrc: string[]
  connectSrc: string[]
}

/** Backend context attached to captures. */
export interface QaCaptureContextV1 {
  environment: string | null
  backendVersion: string | null
  node: string | null
}

/** `GET /qbit/qa-capture/capability`. */
export interface QaCaptureCapabilityV1 {
  enabled: boolean
  reason: QaCaptureReason | string
  provider: string | null
  providerConfig: QaCaptureProviderConfigV1 | null
  qaMode: QaCaptureQaModeV1
  canReport: boolean
  /** Reports link, followed as given and never built by the client. */
  reportsHref: string | null
  sanitizer: QaCaptureSanitizerV1 | null
  blurSelectors: string[]
  cspOrigins: QaCaptureCspOriginsV1
  context: QaCaptureContextV1
  /** Response header carrying the request id (default `X-Request-Id`). */
  requestIdHeader: string
}

/** `POST /qbit/qa-capture/report` body. Only `pageUrl` is required. */
export interface QaCaptureReportRequestV1 {
  pageUrl: string
  title?: string | null
  appName?: string | null
  tableName?: string | null
  recordId?: string | null
  processName?: string | null
  requestIds?: string[]
  frontendVersion?: string | null
  userAgent?: string | null
  viewport?: string | null
}

/** `jam-*` query parameters that open the Recording Link for a report. */
export type QaCaptureRecordingParamsV1 = Record<string, string>

/** `POST /qbit/qa-capture/report` response. */
export interface QaCaptureReportV1 {
  id: number
  reference: string
  title: string | null
  /** Null when no Recording Link is configured. */
  recordingParams: QaCaptureRecordingParamsV1 | null
}
