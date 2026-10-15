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
 * @file "Report a bug": creates a QA report for the current page, then opens the Jam recorder on
 * the report's Recording Link with its title and reference, so the capture is matched back to
 * the report by the qbit's `jam.created` webhook.
 */

import type { QaCaptureCapabilityV1, QaCaptureReportV1 } from '@/types/qa-capture'
import { createQaCaptureReport } from '@/lib/api/qa-capture'
import { openJamRecorder } from './jam-loader'
import { recentRequestIds } from './request-ids'
import { resolveRouteContext, type RouteMetaData } from './route-context'
import { filterPageUrl } from './page-url'

/** How a report attempt ended. */
export type BugReportOutcome =
  | { kind: 'opened'; report: QaCaptureReportV1 }
  /** The report was created, but no Recording Link is configured, so no recorder opened. */
  | { kind: 'no-recording-link'; report: QaCaptureReportV1 }

let lastReportReference: string | null = null

/**
 * The reference of the last report started on this page, for the Jam metadata.
 *
 * @returns The reference, or null.
 */
export function currentReportReference(): string | null {
  return lastReportReference
}

/**
 * The default report title.
 *
 * @param pageTitle - The document title.
 * @returns `Bug: <page title>`.
 */
export function defaultReportTitle(pageTitle: string): string {
  const title = pageTitle.trim()
  return (title ? `Bug: ${title}` : 'Bug report').slice(0, 200)
}

/**
 * Creates the report and opens the recorder.
 *
 * @param input - The inputs.
 * @param input.capability - The enabled capability.
 * @param input.metaData - Instance metadata, to name the page's app, table and process.
 * @param input.location - The page location (defaults to `window.location`).
 * @param input.pageTitle - The page title (defaults to `document.title`).
 * @returns The outcome.
 * @throws When the report cannot be created or the recorder cannot open.
 */
export async function startBugReport(input: {
  capability: QaCaptureCapabilityV1
  metaData?: RouteMetaData | null
  location?: Pick<Location, 'href' | 'pathname'>
  pageTitle?: string
}): Promise<BugReportOutcome> {
  const { capability } = input
  const location = input.location ?? window.location
  const route = resolveRouteContext(location.pathname, input.metaData)
  const report = await createQaCaptureReport({
    pageUrl: filterPageUrl(location.href, capability.sanitizer?.queryParamNames ?? []),
    title: defaultReportTitle(input.pageTitle ?? document.title),
    appName: route.appName,
    tableName: route.tableName,
    recordId: route.recordId,
    processName: route.processName,
    requestIds: recentRequestIds().map((entry) => entry.id),
    frontendVersion: process.env.NEXT_PUBLIC_APP_VERSION || null,
    userAgent: typeof navigator === 'undefined' ? null : navigator.userAgent,
    viewport: typeof window === 'undefined' ? null : `${window.innerWidth}x${window.innerHeight}`,
  })
  if (report.reference) lastReportReference = report.reference
  if (!report.recordingParams) return { kind: 'no-recording-link', report }
  await openJamRecorder(capability, report.recordingParams)
  return { kind: 'opened', report }
}

/** Forgets the last report reference (tests). */
export function resetBugReportForTesting(): void {
  lastReportReference = null
}
