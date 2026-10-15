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

import { getErrorMessage } from '@/lib/utils/error-utils'

import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import type { QInstance, TableCapabilitiesV1 } from '@/types'
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
  if (response.type === 'ERROR') throw new Error(getErrorMessage(response))
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
      // quick views (backend quickSavedView rows) carry their type, position and count flag
      ...(typeof v.type === 'string' ? { type: v.type } : {}),
      ...(typeof v.sortOrder === 'number' ? { sortOrder: v.sortOrder } : {}),
      ...(typeof v.doCount === 'boolean' ? { doCount: v.doCount } : {}),
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
  /** The quick views (yours, then shared ones), in their sort order (Material `QuickSavedViews`). */
  quickViews: SavedView[]
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
 * @param capabilities - Per-user table capabilities; absent for pre-1.6 servers.
 */
export function useSavedViews(tableName: string, metaData: QInstance | undefined, currentUserId: string | undefined, capabilities?: TableCapabilitiesV1): SavedViewsResult {
  const queryClient = useQueryClient()
  const processes = metaData?.processes ?? {}
  const permitted = (name: string) => Boolean(processes[name]) && processes[name].hasPermission !== false
  const declared = capabilities?.savedViews
  const names = capabilities === undefined ? SAVED_VIEW_PROCESSES : {
    query: declared?.available ? declared.queryProcessName : undefined,
    store: declared?.available ? declared.storeProcessName : undefined,
    delete: declared?.available ? declared.deleteProcessName : undefined,
  }
  const isAvailable = capabilities === undefined ? permitted(names.query!) : Boolean(names.query)
  const listKey = useMemo(() => [...queryKeys.all(), 'savedViews', tableName, names.query] as const, [tableName, names.query])

  const listQuery = useQuery({
    queryKey: listKey,
    queryFn: () => {
      if (!names.query) throw new Error('Saved views are unavailable.')
      return runSavedViewProcess(names.query, { tableName })
    },
    enabled: isAvailable,
    staleTime: 60 * 1000,
  })

  const isOwner = useCallback((view: SavedView) => Boolean(currentUserId) && view.userId === currentUserId, [currentUserId])
  const all = useMemo(() => [...(isAvailable ? listQuery.data ?? [] : [])].sort((a, b) => a.label.localeCompare(b.label)), [listQuery.data, isAvailable])

  const storeView = useCallback(async ({ id, label, view }: { id?: number; label: string; view: RecordQueryView }) => {
    if (!names.store) throw new Error('Saving views is unavailable.')
    const stored = await runSavedViewProcess(names.store, {
      tableName,
      label,
      viewJson: JSON.stringify(view),
      ...(id !== undefined ? { id } : {}),
    })
    if (!stored[0]) throw new Error('No saved view was stored.')
    await queryClient.invalidateQueries({ queryKey: listKey })
    await queryClient.invalidateQueries({ queryKey: [...queryKeys.all(), 'savedView', tableName, stored[0].id] })
    return stored[0]
  }, [tableName, queryClient, listKey, names.store])

  const deleteView = useCallback(async (id: number) => {
    if (!names.delete) throw new Error('Deleting views is unavailable.')
    await runSavedViewProcess(names.delete, { id })
    queryClient.removeQueries({ queryKey: [...queryKeys.all(), 'savedView', tableName, id] })
    await queryClient.invalidateQueries({ queryKey: listKey })
  }, [queryClient, listKey, tableName, names.delete])

  return {
    isAvailable,
    canStore: capabilities === undefined ? permitted(SAVED_VIEW_PROCESSES.store) : Boolean(names.store),
    canDelete: capabilities === undefined ? permitted(SAVED_VIEW_PROCESSES.delete) : Boolean(names.delete),
    yourViews: all.filter(isOwner),
    sharedViews: all.filter((v) => !isOwner(v)),
    quickViews: [...all.filter(isOwner), ...all.filter((v) => !isOwner(v))]
      .filter((v) => v.type === 'quickView')
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
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
 * @param capabilities - Per-user table capabilities; absent for pre-1.6 servers.
 */
export function useSavedView(tableName: string, viewId: number | undefined, enabled: boolean, capabilities?: TableCapabilitiesV1) {
  const queryProcess = capabilities === undefined ? SAVED_VIEW_PROCESSES.query : capabilities.savedViews?.available ? capabilities.savedViews.queryProcessName : undefined
  return useQuery({
    queryKey: [...queryKeys.all(), 'savedView', tableName, viewId, queryProcess],
    queryFn: async () => {
      if (!queryProcess) throw new Error('Saved views are unavailable.')
      const [view] = await runSavedViewProcess(queryProcess, { id: viewId })
      if (!view) throw new Error('The requested view was not found.')
      if (view.tableName !== tableName) throw new Error('The requested view belongs to a different table.')
      return view
    },
    enabled: enabled && Boolean(queryProcess) && viewId !== undefined && Number.isFinite(viewId),
    retry: false,
    staleTime: 60 * 1000,
  })
}
