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

/** Processes API — Process lifecycle endpoints: init, step, status, records, and cancel. */

import type { QJobResponse, QRecord } from '@/types'
import apiClient from './client'

/**
 * Request body for initialising a process execution via {@link processInit}.
 */
export interface ProcessInitRequest {
  /** Arbitrary key-value pairs consumed by the process's first step. */
  values?: Record<string, unknown>
  /**
   * Indicates how records are supplied to the process.
   * - `"recordIds"` — explicit comma-separated primary-key list.
   * - `"filterJSON"` — serialised `QQueryFilter` JSON string.
   * - `"filterId"` — a saved-filter identifier.
   */
  recordsParam?: 'recordIds' | 'filterJSON' | 'filterId'
  /** Comma-separated list of primary key values when `recordsParam` is `"recordIds"`. */
  recordIds?: string
  /** Serialised `QQueryFilter` JSON string when `recordsParam` is `"filterJSON"`. */
  filterJSON?: string
  /**
   * Client-side step timeout in milliseconds.
   * The server will return a job-status response if the step takes longer than this.
   */
  stepTimeoutMillis?: number
  /** Optional file to upload with the init request (e.g. for bulk-load processes). */
  file?: File
}

/**
 * Request body for advancing a process to the next step via {@link processStep}.
 */
export interface ProcessStepRequest {
  /** Field values submitted by the user on the current step's form. */
  values?: Record<string, unknown>
  /**
   * Client-side step timeout in milliseconds.
   * The server will return a job-status response if the step takes longer than this.
   */
  stepTimeoutMillis?: number
  /** Optional file to upload with this step (e.g. for bulk-load processes). */
  file?: File
}

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
 * Initialises a new process execution via `POST /processes/{processName}/init`.
 *
 * All fields are serialised into a `multipart/form-data` body:
 * - `values` is JSON-stringified.
 * - `file` is appended as a binary part.
 * - Other fields are appended as plain strings.
 *
 * @param processName - Backend-registered name of the process to start.
 * @param request - Optional init parameters including input values, record selection, and file.
 * @returns A `QJobResponse` describing the resulting job state or the next step to render.
 */
export async function processInit(
  processName: string,
  request: ProcessInitRequest = {}
): Promise<QJobResponse> {
  const formData = new FormData()

  if (request.values) {
    formData.append('values', JSON.stringify(request.values))
  }
  if (request.recordsParam) {
    formData.append('recordsParam', request.recordsParam)
  }
  if (request.recordIds) {
    formData.append('recordIds', request.recordIds)
  }
  if (request.filterJSON) {
    formData.append('filterJSON', request.filterJSON)
  }
  if (request.stepTimeoutMillis !== undefined) {
    formData.append('stepTimeoutMillis', String(request.stepTimeoutMillis))
  }
  if (request.file) {
    formData.append('file', request.file)
  }

  return apiClient.post<QJobResponse>(
    `/processes/${encodeURIComponent(processName)}/init`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
}

/**
 * Advances a running process to the next step via
 * `POST /processes/{processName}/{processUUID}/step/{stepName}`.
 *
 * Serialises field values and an optional file into a `multipart/form-data` body,
 * then submits the current step's form data to the server.
 *
 * @param processName - Backend-registered name of the process.
 * @param processUUID - UUID identifying this process run instance.
 * @param stepName - Name of the step being submitted.
 * @param request - Optional step values and file to submit.
 * @returns A `QJobResponse` describing the resulting job state or the next step to render.
 */
export async function processStep(
  processName: string,
  processUUID: string,
  stepName: string,
  request: ProcessStepRequest = {}
): Promise<QJobResponse> {
  const formData = new FormData()

  if (request.values) {
    formData.append('values', JSON.stringify(request.values))
  }
  if (request.stepTimeoutMillis !== undefined) {
    formData.append('stepTimeoutMillis', String(request.stepTimeoutMillis))
  }
  if (request.file) {
    formData.append('file', request.file)
  }

  return apiClient.post<QJobResponse>(
    `/processes/${encodeURIComponent(processName)}/${processUUID}/step/${encodeURIComponent(stepName)}`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
}

/**
 * Polls the status of an asynchronous process job via
 * `GET /processes/{processName}/{processUUID}/status/{jobUUID}`.
 *
 * Called repeatedly by the step-wizard when a step exceeds its `stepTimeoutMillis`
 * and the server returns a RUNNING job response instead of a completed one.
 *
 * @param processName - Backend-registered name of the process.
 * @param processUUID - UUID identifying this process run instance.
 * @param jobUUID - UUID of the async job to poll.
 * @returns A `QJobResponse` with the current job state (RUNNING, COMPLETE, ERROR, etc.).
 */
export async function processStatus(
  processName: string,
  processUUID: string,
  jobUUID: string
): Promise<QJobResponse> {
  return apiClient.get<QJobResponse>(
    `/processes/${encodeURIComponent(processName)}/${processUUID}/status/${jobUUID}`
  )
}

/**
 * Retrieves a paginated list of records associated with a process run via
 * `GET /processes/{processName}/{processUUID}/records`.
 *
 * Used by the process result and validation-review screens to page through
 * records that were processed (or rejected) by the run.
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
  return apiClient.get<ProcessRecordsResponse>(
    `/processes/${encodeURIComponent(processName)}/${processUUID}/records`,
    { params: { skip, limit } }
  )
}

/**
 * Requests cancellation of a running process job via
 * `GET /processes/{processName}/{processUUID}/cancel`.
 *
 * @param processName - Backend-registered name of the process.
 * @param processUUID - UUID identifying this process run instance.
 * @returns `true` when the cancellation request was accepted, `false` otherwise.
 */
export async function processCancel(
  processName: string,
  processUUID: string
): Promise<boolean> {
  return apiClient.get<boolean>(
    `/processes/${encodeURIComponent(processName)}/${processUUID}/cancel`
  )
}
