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
 * @file Processes API — process lifecycle endpoints: init, step (forward and back),
 * status, records, cancel and file download.
 *
 * These use the registered process routes (`/processes/...` beside `/qqq/v1`), the
 * same contract the Material dashboard uses. They are the only routes that accept
 * uploaded files, step back to a `backStep`, and report `backStep`; the versioned
 * init and step specifications ignore uploads (QRun-IO/qqq#543) and have no back
 * operation. Responses are normalized into {@link ProcessResponse}.
 */

import { AxiosError } from 'axios'

import type { ProcessMetaDataAdjustment, QRecord } from '@/types'
import apiClient from './client'

/** Files to upload with a process request, keyed by the form field name (e.g. `theFile`). */
export type ProcessFiles = Record<string, File | File[]>

/**
 * Request for initialising a process execution via {@link processInit}.
 */
export interface ProcessInitRequest {
  /** Process input values; each one is sent as its own form field. */
  values?: Record<string, unknown>
  /**
   * Indicates how records are supplied to the process.
   * - `"recordIds"` — explicit comma-separated primary-key list.
   * - `"filterJSON"` — serialised `QQueryFilter` JSON string.
   */
  recordsParam?: 'recordIds' | 'filterJSON'
  /** Comma-separated list of primary key values when `recordsParam` is `"recordIds"`. */
  recordIds?: string
  /** Serialised `QQueryFilter` JSON string when `recordsParam` is `"filterJSON"`. */
  filterJSON?: string
  /** Name of the table the process runs against (bulk processes read it in their first step). */
  tableName?: string
  /** Milliseconds the server waits before the request continues as an async job. */
  stepTimeoutMillis?: number
  /** Files to upload with the init request. */
  files?: ProcessFiles
}

/**
 * Request for advancing (or stepping back in) a process via {@link processStep}.
 */
export interface ProcessStepRequest {
  /** Values from the current screen; each one is sent as its own form field. */
  values?: Record<string, unknown>
  /** Files to upload with this step, keyed by field name. */
  files?: ProcessFiles
  /**
   * When `true`, the step named in the URL is the process's `backStep` and the
   * process restarts at it (`isStepBack=true`) instead of continuing after it.
   */
  isStepBack?: boolean
  /** Milliseconds the server waits before the request continues as an async job. */
  stepTimeoutMillis?: number
}

/** A process step finished; the frontend moves to `nextStep` (or completes without one). */
export interface ProcessCompleteResponse {
  type: 'COMPLETE'
  processUUID: string
  values: Record<string, unknown>
  nextStep?: string
  backStep?: string
  processMetaDataAdjustment?: ProcessMetaDataAdjustment
}

/** The request continued as an async job, to be polled via {@link processStatus}. */
export interface ProcessJobStartedResponse {
  type: 'JOB_STARTED'
  processUUID: string
  jobUUID: string
}

/** An async job is still running; `message`, `current` and `total` describe its progress. */
export interface ProcessRunningResponse {
  type: 'RUNNING'
  processUUID: string
  message?: string
  current?: number
  total?: number
}

/** The process failed or was refused. */
export interface ProcessErrorResponse {
  type: 'ERROR'
  processUUID?: string
  /** Technical message (prefixed `Error message:` for unexpected failures). */
  error: string
  /** Message written for the user, when the backend raised a user-facing exception. */
  userFacingError?: string
  /** HTTP status when the backend refused the request (e.g. 403). */
  status?: number
}

/** Normalized result of every process init, step and status request. */
export type ProcessResponse =
  | ProcessCompleteResponse
  | ProcessJobStartedResponse
  | ProcessRunningResponse
  | ProcessErrorResponse

/**
 * Paginated response returned by {@link processRecords}.
 */
export interface ProcessRecordsResponse {
  /** Total number of records associated with the process run (unpaged). */
  totalRecords: number
  /** The current page of records. */
  records: QRecord[]
}

/**
 * Preserve the configured host and deployment prefix for the registered process routes.
 * @returns The configured base URL without the V1 route suffix.
 */
function legacyBaseURL(): string | undefined {
  return apiClient.getInstance().defaults.baseURL?.replace(/\/qqq\/v1\/?$/, '')
}

/**
 * Serialize a process value the way the registered routes read it (one string per field).
 * @param value - A process value.
 * @returns The form-field text.
 */
function formValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

/**
 * Build the multipart body for an init or step request.
 * @param values - Process values; `undefined` entries are omitted and `null` becomes an empty field.
 * @param files - Uploaded files by field name.
 * @param stepTimeoutMillis - Optional async threshold.
 * @returns The form data to post.
 */
function buildFormData(values: Record<string, unknown>, files?: ProcessFiles, stepTimeoutMillis?: number): FormData {
  const formData = new FormData()
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined || value instanceof File) continue
    formData.append(name, value === null ? '' : formValue(value))
  }
  for (const [name, fileOrFiles] of Object.entries(files ?? {})) {
    for (const file of Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles]) {
      formData.append(name, file, file.name)
    }
  }
  if (stepTimeoutMillis !== undefined) formData.append('_qStepTimeoutMillis', String(stepTimeoutMillis))
  return formData
}

/**
 * Read an optional integer from a wire value.
 * @param value - Candidate number.
 * @returns The number, or `undefined` when absent or not numeric.
 */
function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/**
 * Normalize a registered-route (or versioned) process payload.
 *
 * The order of checks follows the backend: a job UUID means the step went async;
 * an error means the step failed; values or a next step mean it completed; a job
 * status means an async job is still running.
 *
 * @param raw - Parsed response body.
 * @returns The normalized response.
 */
export function normalizeProcessResponse(raw: unknown): ProcessResponse {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { type: 'ERROR', error: 'Unexpected server response.' }
  }
  const data = raw as Record<string, unknown>
  const processUUID = typeof data.processUUID === 'string' ? data.processUUID : ''
  const versionedType = typeof data.type === 'string' ? data.type : undefined

  if (typeof data.jobUUID === 'string' && (!versionedType || versionedType === 'JOB_STARTED')) {
    return { type: 'JOB_STARTED', processUUID, jobUUID: data.jobUUID }
  }
  if (typeof data.error === 'string' || typeof data.userFacingError === 'string') {
    const userFacingError = typeof data.userFacingError === 'string' ? data.userFacingError : undefined
    return { type: 'ERROR', processUUID, error: typeof data.error === 'string' ? data.error : userFacingError ?? '', userFacingError }
  }
  if (data.values !== undefined || typeof data.nextStep === 'string' || versionedType === 'COMPLETE') {
    const values = data.values && typeof data.values === 'object' && !Array.isArray(data.values)
      ? data.values as Record<string, unknown> : {}
    const adjustment = data.processMetaDataAdjustment && typeof data.processMetaDataAdjustment === 'object'
      ? data.processMetaDataAdjustment as ProcessMetaDataAdjustment : undefined
    /////////////////////////////////////////////////////////////////////////////
    // older backends send only the deprecated top-level updatedFrontendStepList //
    /////////////////////////////////////////////////////////////////////////////
    const legacySteps = Array.isArray(data.updatedFrontendStepList) ? data.updatedFrontendStepList : undefined
    const processMetaDataAdjustment = adjustment ?? (legacySteps ? { updatedFrontendStepList: legacySteps } : undefined)
    return {
      type: 'COMPLETE',
      processUUID,
      values,
      nextStep: typeof data.nextStep === 'string' ? data.nextStep : undefined,
      backStep: typeof data.backStep === 'string' ? data.backStep : undefined,
      processMetaDataAdjustment,
    }
  }
  const jobStatus = data.jobStatus && typeof data.jobStatus === 'object' ? data.jobStatus as Record<string, unknown> : null
  if (jobStatus || versionedType === 'RUNNING') {
    const source = jobStatus ?? data
    return {
      type: 'RUNNING',
      processUUID,
      message: typeof source.message === 'string' ? source.message : undefined,
      current: optionalNumber(source.current),
      total: optionalNumber(source.total),
    }
  }
  return { type: 'ERROR', processUUID, error: 'Unexpected server response.' }
}

/**
 * Convert a refused request (HTTP 4xx/5xx with a process error body) into an error response.
 * 401 is rethrown so the global session handling can redirect to login.
 * @param error - The thrown request error.
 * @returns The normalized error.
 */
function refusedResponse(error: unknown): ProcessErrorResponse {
  if (error instanceof AxiosError && error.response && error.response.status !== 401) {
    const status = error.response.status
    const body = error.response.data
    const normalized = normalizeProcessResponse(body)
    if (status === 403) {
      return { type: 'ERROR', processUUID: normalized.processUUID, status, error: 'Permission denied.', userFacingError: 'You do not have permission to run this process.' }
    }
    if (normalized.type === 'ERROR' && normalized.error !== 'Unexpected server response.') {
      return { ...normalized, status }
    }
    return { type: 'ERROR', status, error: `The server returned HTTP ${status}.` }
  }
  throw error
}

/**
 * Initialises a new process execution via `POST /processes/{processName}/init`.
 *
 * @param processName - Backend-registered name of the process to start.
 * @param request - Record selection, table name, input values and uploads.
 * @returns The normalized response (next step, async job, or error).
 */
export async function processInit(
  processName: string,
  request: ProcessInitRequest = {}
): Promise<ProcessResponse> {
  const values: Record<string, unknown> = { ...(request.values ?? {}) }
  if (request.recordsParam) {
    values.recordsParam = request.recordsParam
    if (request.recordsParam === 'recordIds') values.recordIds = request.recordIds ?? ''
    if (request.recordsParam === 'filterJSON') values.filterJSON = request.filterJSON ?? '{}'
  }
  if (request.tableName) values.tableName = request.tableName
  try {
    const body = await apiClient.post<unknown>(
      `/processes/${encodeURIComponent(processName)}/init`,
      buildFormData(values, request.files, request.stepTimeoutMillis),
      { baseURL: legacyBaseURL(), headers: { 'Content-Type': 'multipart/form-data' } }
    )
    return normalizeProcessResponse(body)
  } catch (error) {
    return refusedResponse(error)
  }
}

/**
 * Submits a screen and continues the process via
 * `POST /processes/{processName}/{processUUID}/step/{stepName}`, or restarts the
 * process at its back step when `isStepBack` is set.
 *
 * @param processName - Backend-registered name of the process.
 * @param processUUID - UUID identifying this process run instance.
 * @param stepName - The screen being submitted, or the back step to restart at.
 * @param request - Screen values, uploads and the back flag.
 * @returns The normalized response (next step, async job, or error).
 */
export async function processStep(
  processName: string,
  processUUID: string,
  stepName: string,
  request: ProcessStepRequest = {}
): Promise<ProcessResponse> {
  try {
    const body = await apiClient.post<unknown>(
      `/processes/${encodeURIComponent(processName)}/${encodeURIComponent(processUUID)}/step/${encodeURIComponent(stepName)}`,
      buildFormData(request.values ?? {}, request.files, request.stepTimeoutMillis),
      {
        baseURL: legacyBaseURL(),
        headers: { 'Content-Type': 'multipart/form-data' },
        params: request.isStepBack ? { isStepBack: 'true' } : undefined,
      }
    )
    return normalizeProcessResponse(body)
  } catch (error) {
    return refusedResponse(error)
  }
}

/**
 * Polls an asynchronous process job via
 * `GET /processes/{processName}/{processUUID}/status/{jobUUID}`.
 *
 * Network failures and 5xx responses are thrown so the caller can back off and retry.
 *
 * @param processName - Backend-registered name of the process.
 * @param processUUID - UUID identifying this process run instance.
 * @param jobUUID - UUID of the async job to poll.
 * @returns The normalized job state (running with progress, complete, or error).
 */
export async function processStatus(
  processName: string,
  processUUID: string,
  jobUUID: string
): Promise<ProcessResponse> {
  const body = await apiClient.get<unknown>(
    `/processes/${encodeURIComponent(processName)}/${encodeURIComponent(processUUID)}/status/${encodeURIComponent(jobUUID)}`,
    { baseURL: legacyBaseURL() }
  )
  return normalizeProcessResponse(body)
}

/**
 * Retrieves a page of the records held in a process run's state via
 * `GET /processes/{processName}/{processUUID}/records`.
 *
 * @param processName - Backend-registered name of the process.
 * @param processUUID - UUID identifying this process run instance.
 * @param skip - Number of records to skip (zero-based offset for pagination).
 * @param limit - Maximum number of records to return in this page.
 * @returns An object containing the total record count and the current page of records.
 */
export async function processRecords(
  processName: string,
  processUUID: string,
  skip = 0,
  limit = 50
): Promise<ProcessRecordsResponse> {
  const body = await apiClient.get<ProcessRecordsResponse>(
    `/processes/${encodeURIComponent(processName)}/${encodeURIComponent(processUUID)}/records`,
    {
      baseURL: legacyBaseURL(),
      params: { skip, limit },
    }
  )
  if (!body || !Array.isArray(body.records) || typeof body.totalRecords !== 'number') {
    throw new Error('Invalid process records response')
  }
  return body
}

/**
 * Cancels a process run via `GET /processes/{processName}/{processUUID}/cancel`,
 * which runs the process's cancel step (if it declares one).
 *
 * @param processName - Backend-registered name of the process.
 * @param processUUID - UUID identifying this process run instance.
 * @returns `true` once the backend accepted the cancellation.
 */
export async function processCancel(
  processName: string,
  processUUID: string
): Promise<boolean> {
  await apiClient.get<unknown>(
    `/processes/${encodeURIComponent(processName)}/${encodeURIComponent(processUUID)}/cancel`,
    { baseURL: legacyBaseURL() }
  )
  return true
}

/**
 * Build the URL of a file a process step made available for download
 * (`DOWNLOAD_FORM`), from the `downloadFileName` plus either `serverFilePath`
 * or `storageTableName` and `storageReference` process values.
 *
 * @param values - The current process values.
 * @returns The download URL, or `null` when the values do not describe a file.
 */
export function processDownloadUrl(values: Record<string, unknown>): string | null {
  const fileName = typeof values.downloadFileName === 'string' ? values.downloadFileName : null
  if (!fileName) return null
  const params = new URLSearchParams()
  if (typeof values.serverFilePath === 'string' && values.serverFilePath) {
    params.set('filePath', values.serverFilePath)
  } else if (typeof values.storageTableName === 'string' && typeof values.storageReference === 'string') {
    params.set('storageTableName', values.storageTableName)
    params.set('storageReference', values.storageReference)
  } else {
    return null
  }
  return `${legacyBaseURL() ?? ''}/download/${encodeURIComponent(fileName)}?${params.toString()}`
}
