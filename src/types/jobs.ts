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

/** @file Jobs UI API schemas. Nullable measurements mean the server cannot estimate them. */

export interface JobPhaseV1 {
  name: string
  label: string
  status: string
  weight?: number | null
}

export interface JobProgressV1 {
  phases?: JobPhaseV1[] | null
  currentPhase?: string | null
  unitLabel?: string | null
  done?: number | null
  total?: number | null
  bytesDone?: number | null
  bytesTotal?: number | null
  percent?: number | null
  etaSeconds?: number | null
  message?: string | null
  updatedAt?: string | null
}

export interface JobSummaryV1 {
  jobId: number
  label?: string | null
  processName?: string | null
  status: string
  sourceType?: string | null
  userId?: string | null
  queuedAt?: string | null
  startedAt?: string | null
  finishedAt?: string | null
  rowsDone?: number | null
  rowsTotal?: number | null
  rowsFailed?: number | null
  chunksDone?: number | null
  chunksTotal?: number | null
  currentPhase?: string | null
  percent?: number | null
  message?: string | null
  bytesDone?: number | null
  bytesTotal?: number | null
  etaSeconds?: number | null
  logSeq?: number | null
}

export interface JobDetailV1 extends JobSummaryV1 {
  progress?: JobProgressV1 | null
  summary?: Record<string, unknown> | null
  actions?: string[] | null
}

export interface JobLogLineV1 {
  id: number
  jobId?: number
  chunkId?: number | null
  attempt?: number | null
  level: string
  loggedAt?: string | null
  phase?: string | null
  message: string
}

export interface JobListResponseV1 {
  jobs: JobSummaryV1[]
  activeCount: number
  generatedAt: string
}

export interface JobProgressPollV1 {
  job: JobSummaryV1
  progress?: JobProgressV1 | null
  log: JobLogLineV1[]
  nextAfterLogId: number
  logDropped: number
  terminal: boolean
}

export interface JobTrackRequestV1 {
  processName: string
  processUUID: string
  jobUUID: string
}

export interface JobActionResponseV1 {
  jobId: number
}

export interface JobListFilter {
  scope?: 'mine' | 'all'
  state?: 'active' | 'recent' | 'all'
  limit?: number
  processName?: string
}
