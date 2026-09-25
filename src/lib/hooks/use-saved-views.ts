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
 * @file use-saved-views — backend saved views for the query screen, through the QQQ
 * `querySavedView`, `storeSavedView` and `deleteSavedView` processes (as the Material
 * dashboard uses them). Views the current user owns are listed separately from views
 * shared with them.
 */

'use client'

import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import type { QInstance } from '@/types'
import { processInit } from '@/lib/api/processes'
import { queryKeys } from '@/lib/query-client'
import { parseViewJson, type RecordQueryView, type SavedView } from '@/lib/utils/saved-view-utils'

/** Process names that implement saved views on a QQQ backend. */
export const SAVED_VIEW_PROCESSES = { query: 'querySavedView', store: 'storeSavedView', delete: 'deleteSavedView' } as const

/**
 * Runs a saved-view process synchronously and returns its `savedViewList`.
 *
 * @param processName - One of {@link SAVED_VIEW_PROCESSES}.
 * @param values - Process input values.
 * @returns The saved views the process returned.
 */
export async function runSavedViewProcess(processName: string, values: Record<string, unknown>): Promise<SavedView[]> {
  const response = await processInit(processName, { values, stepTimeoutMillis: 60 * 1000 })
  if (response.type === 'ERROR') throw new Error(response.userFacingError ?? response.error)
  if (response.type !== 'COMPLETE') throw new Error('The saved view request did not complete.')
  const list = (response.values.savedViewList ?? []) as Array<{ values?: Record<string, unknown> }>
  return list.map((record) => {
    const v = record.values ?? {}
    return {
      id: Number(v.id),
      label: String(v.label ?? ''),
      userId: typeof v.userId === 'string' ? v.userId : undefined,
      tableName: String(v.tableName ?? ''),
      view: parseViewJson(v.viewJson),
    }
  })
}

/** Saved view capabilities for one table. */
export interface SavedViewsResult {
  /** Whether the backend defines the saved view processes (and the user may run them). */
  isAvailable: boolean
  /** Whether the user may store views. */
  canStore: boolean
  /** Whether the user may delete views. */
  canDelete: boolean
  /** Views the current user owns, sorted by label. */
  yourViews: SavedView[]
  /** Views other users shared with the current user. */
  sharedViews: SavedView[]
  /** Whether the list is loading. */
  isLoading: boolean
  /** Error loading the list, if any. */
  error: Error | null
  /** Stores (inserts, or updates when `id` is given) a view and returns the stored record. */
  storeView: (input: { id?: number; label: string; view: RecordQueryView }) => Promise<SavedView>
  /** Deletes a view. */
  deleteView: (id: number) => Promise<void>
  /** Whether the current user owns a view. */
  isOwner: (view: SavedView) => boolean
}

/**
 * Loads and manages the backend saved views for a table.
 *
 * @param tableName - Backend table name.
 * @param metaData - Instance metadata (to discover the saved view processes).
 * @param currentUserId - The session user's id (`values.user.email` from manageSession).
 * @returns Saved view lists and actions.
 */
export function useSavedViews(tableName: string, metaData: QInstance | undefined, currentUserId: string | undefined): SavedViewsResult {
  const queryClient = useQueryClient()
  const processes = metaData?.processes ?? {}
  const permitted = (name: string) => Boolean(processes[name]) && processes[name].hasPermission !== false
  const isAvailable = permitted(SAVED_VIEW_PROCESSES.query)
  const listKey = useMemo(() => [...queryKeys.all(), 'savedViews', tableName] as const, [tableName])

  const listQuery = useQuery({
    queryKey: listKey,
    queryFn: () => runSavedViewProcess(SAVED_VIEW_PROCESSES.query, { tableName }),
    enabled: isAvailable,
    staleTime: 60 * 1000,
  })

  const isOwner = useCallback((view: SavedView) => Boolean(currentUserId) && view.userId === currentUserId, [currentUserId])
  const all = useMemo(() => [...(listQuery.data ?? [])].sort((a, b) => a.label.localeCompare(b.label)), [listQuery.data])

  const storeView = useCallback(async ({ id, label, view }: { id?: number; label: string; view: RecordQueryView }) => {
    const stored = await runSavedViewProcess(SAVED_VIEW_PROCESSES.store, {
      tableName,
      label,
      viewJson: JSON.stringify(view),
      ...(id !== undefined ? { id } : {}),
    })
    if (!stored[0]) throw new Error('No saved view was stored.')
    await queryClient.invalidateQueries({ queryKey: listKey })
    await queryClient.invalidateQueries({ queryKey: [...queryKeys.all(), 'savedView', tableName, stored[0].id] })
    return stored[0]
  }, [tableName, queryClient, listKey])

  const deleteView = useCallback(async (id: number) => {
    await runSavedViewProcess(SAVED_VIEW_PROCESSES.delete, { id })
    queryClient.removeQueries({ queryKey: [...queryKeys.all(), 'savedView', tableName, id] })
    await queryClient.invalidateQueries({ queryKey: listKey })
  }, [queryClient, listKey, tableName])

  return {
    isAvailable,
    canStore: permitted(SAVED_VIEW_PROCESSES.store),
    canDelete: permitted(SAVED_VIEW_PROCESSES.delete),
    yourViews: all.filter(isOwner),
    sharedViews: all.filter((v) => !isOwner(v)),
    isLoading: listQuery.isLoading,
    error: listQuery.error,
    storeView,
    deleteView,
    isOwner,
  }
}

/**
 * Loads one saved view by id (the `/savedView/{id}` route).
 *
 * @param tableName - Backend table name.
 * @param viewId - Saved view id, or undefined when not on a saved-view route.
 * @param enabled - Whether the backend supports saved views.
 * @returns The TanStack query for the view.
 */
export function useSavedView(tableName: string, viewId: number | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...queryKeys.all(), 'savedView', tableName, viewId],
    queryFn: async () => {
      const [view] = await runSavedViewProcess(SAVED_VIEW_PROCESSES.query, { id: viewId })
      if (!view) throw new Error('The requested view was not found.')
      if (view.tableName !== tableName) throw new Error('The requested view belongs to a different table.')
      return view
    },
    enabled: enabled && viewId !== undefined && Number.isFinite(viewId),
    retry: false,
    staleTime: 60 * 1000,
  })
}
