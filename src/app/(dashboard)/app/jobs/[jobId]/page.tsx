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

/** @file Live job route, separate from metadata table records. */
'use client'
import { useRouteParams } from '@/lib/hooks/use-route-params'
import { JobDetailView } from '@/components/jobs/JobDetailView'

/** Renders a job by id.
 * @returns Job view or invalid-id message.
 */
export default function JobRoute() {
  const { jobId } = useRouteParams<{ jobId: string }>()
  const id = Number(jobId)
  if (!Number.isSafeInteger(id) || id <= 0) return <p role="alert">Invalid job identifier.</p>
  return <div className="w-full min-w-0 rounded-xl border border-border bg-card"><JobDetailView key={id} jobId={id} /></div>
}
