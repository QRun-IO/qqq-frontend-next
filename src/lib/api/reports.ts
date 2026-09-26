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
 * @file Reports API — what running a QQQ report needs besides the process API.
 *
 * A QQQ report runs through its declared process (normally the framework's basic
 * report process), like any process, as Material's ReportRun does: init with
 * `{ reportName, reportFormat }` runs the prepare step, which either lists the
 * report's input fields in the `inputFieldList` value (the `input` screen) or goes
 * straight on; a report process may show other screens; the file is offered by a
 * DOWNLOAD_FORM screen, from `serverFilePath` or `storageTableName` and
 * `storageReference`. The output formats are the backend's `reportFormat` possible
 * values. Reports without a process use the v1 streaming route
 * `GET /reports/{reportName}?format=...`.
 */

import type { QFrontendStepMetaData, QPossibleValue, QProcessMetaData } from '@/types'
import { apiUrl } from './client'
import { processDownloadUrl } from './processes'
import { fetchPossibleValues } from './possible-values'

/** A report output format id (a `reportFormat` possible value, e.g. `CSV`). */
export type ReportFormat = string

/** The process value (and field) that carries the output format. */
export const REPORT_FORMAT_FIELD = 'reportFormat'

/** The backend's possible value source of report output formats. */
export const REPORT_FORMAT_SOURCE = 'reportFormat'

/** Format of a streamed report when the backend lists no formats (the process default). */
export const DEFAULT_REPORT_FORMAT = 'XLSX'

/**
 * URL of the streaming report route, for reports without a process.
 *
 * @param reportName - Report name.
 * @param format - Output format.
 * @param inputs - Report input values sent as query parameters.
 * @returns The report URL.
 */
export function reportFileUrl(reportName: string, format: ReportFormat, inputs: Record<string, string> = {}): string {
  const params = new URLSearchParams({ ...inputs, format: format.toLowerCase() })
  return apiUrl(`/reports/${encodeURIComponent(reportName)}?${params}`)
}

/**
 * Whether a report's process asks for the output format on one of its screens (as the
 * render-report process does); then its screen offers the choice.
 *
 * @param process - The report's process metadata.
 * @returns `true` when a screen has a `reportFormat` form field.
 */
export function processDeclaresReportFormat(process: QProcessMetaData | undefined): boolean {
  return Boolean(process?.frontendSteps?.some((step) => step.formFields?.some((field) => field.name === REPORT_FORMAT_FIELD)))
}

/**
 * Load the backend's report output formats (the `reportFormat` possible values).
 *
 * @returns The formats, in the backend's order.
 */
export function loadReportFormats(): Promise<QPossibleValue[]> {
  return fetchPossibleValues(REPORT_FORMAT_SOURCE)
}

/**
 * Whether a screen only offers the generated file (the report's access step).
 *
 * @param step - A process screen.
 * @returns `true` when every component is a DOWNLOAD_FORM.
 */
export function isDownloadStep(step: QFrontendStepMetaData): boolean {
  const components = step.components ?? []
  return components.length > 0 && components.every((component) => component.type === 'DOWNLOAD_FORM')
}

/** A generated report file. */
export interface ReportFile {
  fileName: string
  url: string
}

/**
 * The file a report process registered, from its process values.
 *
 * @param values - Process values.
 * @returns The file name and download URL, or `null` when no file is described.
 */
export function reportFile(values: Record<string, unknown>): ReportFile | null {
  const url = processDownloadUrl(values)
  return url ? { fileName: String(values.downloadFileName), url } : null
}
