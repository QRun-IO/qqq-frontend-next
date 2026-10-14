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

/** @file Typed jobs operations in the bundled /qqq/v1 contract. */
import apiClient from './client'
import type {
  JobActionResponseV1,
  JobDetailV1,
  JobListFilter,
  JobListResponseV1,
  JobProgressPollV1,
  JobTrackRequestV1,
} from '@/types/jobs'

/** Lists visible jobs with server-enforced ownership.
 * @param filter - Scope, state, limit and optional process.
 * @returns Jobs and active count.
 */
export const listJobs = (filter: JobListFilter = {}) =>
  apiClient.get<JobListResponseV1>('/jobs', { params: filter })

/** Reads a job and its allowed actions.
 * @param jobId - Job identifier.
 * @returns Detail.
 */
export const getJob = (jobId: number) =>
  apiClient.get<JobDetailV1>(`/jobs/${encodeURIComponent(jobId)}`)

/** Reads progress and an overlapping log cursor window.
 * @param jobId - Job identifier.
 * @param afterLogId - Last received cursor; zero loads the tail.
 * @param logLimit - Requested log page size.
 * @returns Snapshot and next cursor.
 */
export const getJobProgress = (jobId: number, afterLogId = 0, logLimit = 200) =>
  apiClient.get<JobProgressPollV1>(`/jobs/${encodeURIComponent(jobId)}/progress`, {
    params: { afterLogId, logLimit },
  })

/** Requests cancellation.
 * @param jobId - Job identifier.
 * @returns Affected job.
 */
export const cancelJob = (jobId: number) =>
  apiClient.post<JobActionResponseV1>(`/jobs/${encodeURIComponent(jobId)}/cancel`)

/** Retries failed work or launches another attempt.
 * @param jobId - Job identifier.
 * @returns Job to open, which may differ from the original.
 */
export const retryJob = (jobId: number) =>
  apiClient.post<JobActionResponseV1>(`/jobs/${encodeURIComponent(jobId)}/retry`)

/** Makes a running inline process discoverable in Jobs.
 * @param request - Running process and async job identifiers.
 * @returns Tracking job.
 */
export const trackJob = (request: JobTrackRequestV1) =>
  apiClient.post<JobActionResponseV1>('/jobs/track', request)
