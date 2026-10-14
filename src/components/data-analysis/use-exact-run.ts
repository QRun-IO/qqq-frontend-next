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

/** @file Owner-scoped exact runs with lifecycle-bound polling and typed results. */
'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import type { DataAnalysisStartRunRequestV1 } from '@/types/data-analysis'
import { getRun, startRun } from '@/lib/api/data-analysis'
import { queryKeys } from '@/lib/query-client'

/** Runs and polls an exact profile, stopping on failure, completion or unmount.
 * @param request - The immutable panel request.
 * @returns Mutation and polled status.
 */
export function useExactRun(request: DataAnalysisStartRunRequestV1) {
  const start = useMutation({
    mutationFn: async () => {
      const result = await startRun(request)
      if (!result?.runId) throw new Error('The analysis run did not return an identifier.')
      return result
    },
  })
  const runId = start.data?.runId
  const run = useQuery({
    queryKey: [...queryKeys.dataAnalysis(request.tableName), 'run', runId],
    queryFn: async () => {
      const result = await getRun(runId!)
      if (!result?.status) throw new Error('The analysis run returned no status.')
      return result
    },
    enabled: Boolean(runId),
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: (query) =>
      query.state.error || ['COMPLETE', 'FAILED'].includes(query.state.data?.status ?? '')
        ? false
        : 1500,
  })
  const busy =
    start.isPending ||
    Boolean(runId && !run.error && !['COMPLETE', 'FAILED'].includes(run.data?.status ?? ''))
  return { start, run, busy }
}
