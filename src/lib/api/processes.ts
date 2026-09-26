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
 * These use the v1 process routes (`/qqq/v1/processes/...`): init and step take a
 * multipart body with the process values as one `values` JSON field (each value as the
 * text the legacy form fields carried), uploaded files as file fields (QRun-IO/qqq#543)
 * and `stepTimeoutMillis`; a step with `isStepBack=true` restarts at the process's
 * `backStep`, which completed responses report. Responses are normalized into
 * {@link ProcessResponse}.
 */

import { AxiosError } from 'axios'

import type { ProcessMetaDataAdjustment, QRecord } from '@/types'
import apiClient, { apiUrl } from './client'

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
  /** JSON of the table's selected backend variant (`{type, id}`), sent on init and every step as Material does. */
  tableVariant?: string
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
  /** JSON of the table's selected backend variant, as on init. */
  tableVariant?: string
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
 * Serialize a process value as the text a legacy form field carried (one string per value).
 * @param value - A process value.
 * @returns The form-field text.
 */
function formValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

/**
 * Build the v1 multipart body for an init or step request.
 * @param values - Process values; `undefined` entries are omitted and `null` becomes an empty value.
 * @param files - Uploaded files by field name.
 * @param stepTimeoutMillis - Optional async threshold.
 * @param fields - Other v1 form fields (e.g. `recordsParam`, `recordIds`, `filterJSON`).
 * @returns The form data to post.
 */
function buildFormData(values: Record<string, unknown>, files?: ProcessFiles, stepTimeoutMillis?: number, fields: Record<string, string> = {}): FormData {
  const formData = new FormData()
  const text: Record<string, string> = {}
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined || value instanceof File) continue
    text[name] = value === null ? '' : formValue(value)
  }
  formData.append('values', JSON.stringify(text))
  for (const [name, value] of Object.entries(fields)) formData.append(name, value)
  for (const [name, fileOrFiles] of Object.entries(files ?? {})) {
    for (const file of Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles]) {
      formData.append(name, file, file.name)
    }
  }
  if (stepTimeoutMillis !== undefined) formData.append('stepTimeoutMillis', String(stepTimeoutMillis))
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
 * The v1 routes send widget-block process values (e.g. a composite widget's data) as v1
 * WidgetBlock objects (`blockType`, `subBlocks`); give them the block-data shape the block
 * renderers read (`blockTypeName`, `blocks`, `type`), as the legacy routes sent them.
 * @param value - A process value.
 * @returns The value, with any widget block in block-data shape.
 */
export function blockDataFromV1(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const block = value as Record<string, unknown>
  if ('tableName' in block || !('blockType' in block || 'blockTypeName' in block) || !('subBlocks' in block || 'values' in block || 'blockId' in block)) return value
  const blockTypeName = String(block.blockTypeName ?? block.blockType ?? '')
  const { subBlocks, ...rest } = block
  return {
    ...rest,
    blockTypeName,
    type: block.type ?? (blockTypeName === 'COMPOSITE' ? 'composite' : 'block'),
    ...(Array.isArray(subBlocks) ? { blocks: subBlocks.map(blockDataFromV1) } : {}),
  }
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
      ? Object.fromEntries(Object.entries(data.values as Record<string, unknown>).map(([name, value]) => [name, blockDataFromV1(value)])) : {}
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
 * Initialises a new process execution via the v1 `POST /processes/{processName}/init`.
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
  const fields: Record<string, string> = {}
  if (request.recordsParam) {
    // v1 builds the initial-records filter from these fields; processes also see them as values, as before.
    fields.recordsParam = values.recordsParam = request.recordsParam
    if (request.recordsParam === 'recordIds') fields.recordIds = String(values.recordIds = request.recordIds ?? '')
    if (request.recordsParam === 'filterJSON') fields.filterJSON = String(values.filterJSON = request.filterJSON ?? '{}')
  }
  if (request.tableName) values.tableName = request.tableName
  // v1 scopes the run's backend to this variant from the field; processes also see it as a value, as before.
  if (request.tableVariant) fields.tableVariant = values.tableVariant = request.tableVariant
  try {
    const body = await apiClient.post<unknown>(
      `/processes/${encodeURIComponent(processName)}/init`,
      buildFormData(values, request.files, request.stepTimeoutMillis, fields),
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    return normalizeProcessResponse(body)
  } catch (error) {
    return refusedResponse(error)
  }
}

/**
 * Submits a screen and continues the process via the v1
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
      buildFormData(
        { ...(request.values ?? {}), ...(request.tableVariant ? { tableVariant: request.tableVariant } : {}) },
        request.files,
        request.stepTimeoutMillis,
        request.tableVariant ? { tableVariant: request.tableVariant } : {}
      ),
      {
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
 * Polls an asynchronous process job via the v1
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
    `/processes/${encodeURIComponent(processName)}/${encodeURIComponent(processUUID)}/status/${encodeURIComponent(jobUUID)}`
  )
  return normalizeProcessResponse(body)
}

/**
 * Retrieves a page of the records held in a process run's state via the v1
 * `GET /processes/{processName}/{processUUID}/records` (only the session that ran it may).
 *
 * @param processName - Backend-registered name of the process.
 * @param processUUID - UUID identifying this process run instance.
 * @param skip - Number of records to skip (zero-based offset for pagination).
 * @param limit - Maximum number of records to return in this page.
 * @param tableVariant - JSON of the table variant the run uses, when its table has variants.
 * @returns An object containing the total record count and the current page of records.
 */
export async function processRecords(
  processName: string,
  processUUID: string,
  skip = 0,
  limit = 50,
  tableVariant?: string
): Promise<ProcessRecordsResponse> {
  const body = await apiClient.get<Partial<ProcessRecordsResponse>>(
    `/processes/${encodeURIComponent(processName)}/${encodeURIComponent(processUUID)}/records`,
    { params: { skip, limit, ...(tableVariant ? { tableVariant } : {}) } }
  )
  // v1 sends an empty list for a run with no records; an omitted list reads the same way
  const records = body && typeof body === 'object' && body.records === undefined ? [] : body?.records
  if (!body || typeof body !== 'object' || !Array.isArray(records) || typeof body.totalRecords !== 'number') {
    throw new Error('Invalid process records response')
  }
  return { totalRecords: body.totalRecords, records }
}

/**
 * Cancels a process run via the v1 `POST /processes/{processName}/{processUUID}/cancel`,
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
  await apiClient.post<unknown>(
    `/processes/${encodeURIComponent(processName)}/${encodeURIComponent(processUUID)}/cancel`
  )
  return true
}

/** A saved bulk load profile (the `savedBulkLoadProfile` table). */
export interface SavedBulkLoadProfileRecord {
  id: number
  label: string
  tableName: string
  userId?: string
  /** The v1 bulk load profile as JSON. */
  mappingJson: string
  isBulkEdit?: boolean
}

/**
 * Run one of the saved bulk load profile processes and read its `savedBulkLoadProfileList`.
 * @param processName - `querySavedBulkLoadProfile`, `storeSavedBulkLoadProfile` or `deleteSavedBulkLoadProfile`.
 * @param values - Process inputs.
 * @returns The records the process returned.
 */
async function runSavedBulkLoadProfileProcess(processName: string, values: Record<string, unknown>): Promise<SavedBulkLoadProfileRecord[]> {
  const response = await processInit(processName, { values, stepTimeoutMillis: 60_000 })
  if (response.type === 'ERROR') throw new Error(response.userFacingError ?? response.error)
  if (response.type !== 'COMPLETE') throw new Error('Unexpected server response.')
  const list = response.values.savedBulkLoadProfileList
  return Array.isArray(list)
    ? list.map((record) => (record && typeof record === 'object' ? (record as { values?: SavedBulkLoadProfileRecord }).values : undefined))
      .filter((record): record is SavedBulkLoadProfileRecord => Boolean(record) && typeof record!.id === 'number')
    : []
}

/**
 * List the saved bulk load profiles for a table (insert or edit profiles).
 * @param tableName - Table the profiles load into.
 * @param isBulkEdit - `true` for bulk-edit-with-file profiles.
 * @returns The profiles, ordered by label.
 */
export function querySavedBulkLoadProfiles(tableName: string, isBulkEdit: boolean): Promise<SavedBulkLoadProfileRecord[]> {
  return runSavedBulkLoadProfileProcess('querySavedBulkLoadProfile', { tableName, isBulkEdit })
}

/**
 * Create (without `id`) or update a saved bulk load profile.
 * @param profile - Label, table, mode and mapping (and `id` to update).
 * @returns The stored profile.
 */
export async function storeSavedBulkLoadProfile(profile: Omit<SavedBulkLoadProfileRecord, 'id' | 'userId'> & { id?: number }): Promise<SavedBulkLoadProfileRecord> {
  const [stored] = await runSavedBulkLoadProfileProcess('storeSavedBulkLoadProfile', { ...profile })
  if (!stored) throw new Error('The profile was not saved.')
  return stored
}

/**
 * Delete a saved bulk load profile.
 * @param id - Profile id.
 */
export async function deleteSavedBulkLoadProfile(id: number): Promise<void> {
  await runSavedBulkLoadProfileProcess('deleteSavedBulkLoadProfile', { id })
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
  return apiUrl(`/download/${encodeURIComponent(fileName)}?${params.toString()}`)
}
