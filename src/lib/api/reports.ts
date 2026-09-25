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
 * @file Reports API — runs QQQ reports and resolves their download links.
 *
 * A QQQ report runs through its declared process (normally the framework's basic
 * report process): init with `{ reportName, reportFormat }` runs the prepare step,
 * which either returns the report's input fields (next step `input`) or, with no
 * inputs, generates the file straight away (next step `accessReport`). Submitting
 * the input step generates the file. The generated file is served by the
 * `/download/{fileName}?filePath=...` route. Reports without a process use the
 * streaming route `GET /reports/{reportName}?format=...`.
 */

import { AxiosError } from 'axios'

import type { QFieldMetaData, QJobResponse } from '@/types'
import apiClient from './client'
import { processInit, processStatus, processStep } from './processes'

/** Output formats a QQQ report can be generated in. */
export type ReportFormat = 'CSV' | 'XLSX' | 'JSON'

/** Where a report run stands after a process call. */
export type ReportRunState =
  | { kind: 'input'; processUUID: string; inputFields: QFieldMetaData[] }
  | { kind: 'done'; processUUID: string; fileName: string; downloadUrl: string }
  | { kind: 'running'; processUUID: string; jobUUID: string; message?: string }
  | { kind: 'error'; message: string }

/**
 * Root URL of the non-versioned routes (`/download`, `/reports`).
 *
 * @returns Base URL without a trailing slash.
 */
function rootUrl(): string {
  return (apiClient.getInstance().defaults.baseURL ?? '').replace(/\/qqq\/v1\/?$/, '').replace(/\/$/, '')
}

/**
 * Download URL for a file the report process registered.
 *
 * @param fileName - Suggested file name (`downloadFileName`).
 * @param serverFilePath - Registered server path (`serverFilePath`).
 * @returns The download URL.
 */
export function reportDownloadUrl(fileName: string, serverFilePath: string): string {
  return `${rootUrl()}/download/${encodeURIComponent(fileName)}?${new URLSearchParams({ filePath: serverFilePath })}`
}

/**
 * URL of the streaming report route, for reports without a process.
 *
 * @param reportName - Report name.
 * @param format - Output format.
 * @param inputs - Report input values sent as query parameters.
 * @returns The report URL.
 */
export function legacyReportUrl(reportName: string, format: ReportFormat, inputs: Record<string, string> = {}): string {
  const params = new URLSearchParams({ ...inputs, format: format.toLowerCase() })
  return `${rootUrl()}/reports/${encodeURIComponent(reportName)}?${params}`
}

/**
 * Interprets a process response for a report run.
 *
 * @param response - The process API response.
 * @returns The run state.
 */
export function reportStateFromResponse(response: QJobResponse): ReportRunState {
  const record = response as unknown as Record<string, unknown>
  if (typeof record.error === 'string') {
    return { kind: 'error', message: typeof record.userFacingError === 'string' && record.userFacingError ? record.userFacingError : record.error }
  }
  if (typeof record.jobUUID === 'string') {
    return { kind: 'running', processUUID: String(record.processUUID), jobUUID: record.jobUUID }
  }
  if (record.type === 'RUNNING' || (typeof record.message === 'string' && !record.values)) {
    // Status of a still-running job; the caller keeps its job UUID and polls again.
    return { kind: 'running', processUUID: String(record.processUUID), jobUUID: '', message: typeof record.message === 'string' ? record.message : undefined }
  }
  const values = (record.values ?? {}) as Record<string, unknown>
  if (record.nextStep === 'input' && Array.isArray(values.inputFieldList)) {
    return { kind: 'input', processUUID: String(record.processUUID), inputFields: values.inputFieldList as QFieldMetaData[] }
  }
  if (typeof values.serverFilePath === 'string' && typeof values.downloadFileName === 'string') {
    return {
      kind: 'done',
      processUUID: String(record.processUUID),
      fileName: values.downloadFileName,
      downloadUrl: reportDownloadUrl(values.downloadFileName, values.serverFilePath),
    }
  }
  return { kind: 'error', message: 'The report did not produce a file.' }
}

/**
 * Converts a failed request into a report error state.
 *
 * @param error - The thrown error.
 * @returns An error state carrying the backend message.
 */
export function reportErrorState(error: unknown): ReportRunState {
  if (error instanceof AxiosError) {
    const body = error.response?.data as { error?: unknown; userFacingError?: unknown } | undefined
    const message = typeof body?.userFacingError === 'string' && body.userFacingError ? body.userFacingError
      : typeof body?.error === 'string' && body.error ? body.error : error.message
    return { kind: 'error', message }
  }
  return { kind: 'error', message: error instanceof Error ? error.message : 'The report could not be run.' }
}

/**
 * Starts a report through its process.
 *
 * @param processName - The report's process (e.g. the basic report process).
 * @param reportName - Report name.
 * @param format - Output format.
 * @returns The run state.
 */
export async function startReport(processName: string, reportName: string, format: ReportFormat): Promise<ReportRunState> {
  try {
    return reportStateFromResponse(await processInit(processName, { values: { reportName, reportFormat: format } }))
  } catch (error) {
    return reportErrorState(error)
  }
}

/**
 * Submits a report's input values.
 *
 * @param processName - The report's process.
 * @param processUUID - The run's process UUID.
 * @param values - Input values, plus the report name and format.
 * @returns The run state.
 */
export async function submitReportInputs(processName: string, processUUID: string, values: Record<string, unknown>): Promise<ReportRunState> {
  try {
    return reportStateFromResponse(await processStep(processName, processUUID, 'input', { values }))
  } catch (error) {
    return reportErrorState(error)
  }
}

/**
 * Polls an asynchronous report job.
 *
 * @param processName - The report's process.
 * @param processUUID - The run's process UUID.
 * @param jobUUID - The job UUID.
 * @returns The run state.
 */
export async function pollReport(processName: string, processUUID: string, jobUUID: string): Promise<ReportRunState> {
  try {
    const state = reportStateFromResponse(await processStatus(processName, processUUID, jobUUID))
    return state.kind === 'running' ? { ...state, jobUUID } : state
  } catch (error) {
    return reportErrorState(error)
  }
}
