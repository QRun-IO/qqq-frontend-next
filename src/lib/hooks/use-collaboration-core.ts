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
 * @file The collaboration hooks every screen needs: availability and recording recent views.
 * The dashboard layout and the table, app and record screens import only this module; the
 * favorites hooks (use-collaboration) and the API client load with the surfaces that use them.
 */

'use client'

import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CollaborationTarget } from '@/types/collaboration'
import { queryKeys } from '@/lib/query-client'

/** The API module, imported once (concurrent first calls share one import). */
let apiModule: Promise<typeof import('@/lib/api/collaboration')> | undefined

/**
 * The collaboration API, loaded on first use: these hooks run in the dashboard layout and every
 * table, app and record screen, so the client stays out of their first load.
 * @returns The API module.
 */
export function api() {
  return (apiModule ??= import('@/lib/api/collaboration'))
}

/**
 * Discovers availability once per query-client session, including absence.
 * @param enabled - Whether discovery may run.
 * @returns Availability query.
 */
export function useCollaborationAvailable(enabled = true) {
  return useQuery({
    queryKey: queryKeys.collaborationAvailable(),
    queryFn: async () => (await api()).isCollaborationInstalled(),
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

/**
 * Records each target open once, including React StrictMode effect replay. A subsequent
 * mount or a different target counts as a new open. Local record history remains independent.
 * @param target - The successfully opened record, table or app.
 */
export function useRecordRecentView(target: CollaborationTarget) {
  const { data: available } = useCollaborationAvailable()
  const client = useQueryClient()
  const last = useRef<string | null>(null)
  const { mutate } = useMutation({
    mutationFn: async (recent: CollaborationTarget) => (await api()).recordRecent(recent),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.collaborationRecentsRoot() }),
  })
  const { targetType, targetName, recordId } = target
  useEffect(() => {
    const key = JSON.stringify([targetType, targetName, recordId ?? null])
    if (!available || last.current === key) return
    last.current = key
    mutate({ targetType, targetName, recordId })
  }, [available, targetType, targetName, recordId, mutate])
}
