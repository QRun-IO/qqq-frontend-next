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
 * @file use-saved-views — sub-hook that manages saved views (named filter snapshots)
 * for the Record Query page.
 *
 * Saved views are persisted to localStorage keyed by table name. Each view captures
 * filter criteria, column visibility, column order, and sort order at the time of
 * saving. Pagination offsets are intentionally excluded so that loading a view always
 * starts at page 1.
 *
 * This hook is an internal implementation detail of `useRecordQuery`. It is not
 * intended to be consumed directly by page or component code — use the `views`
 * namespace returned by `useRecordQuery` instead.
 */

'use client'

import { useCallback, type Dispatch } from 'react'

import { useLocalStorage } from '@/lib/hooks/use-local-storage'
import type {
  SavedView,
  RecordQueryState,
  RecordQueryAction,
} from '@/lib/hooks/use-record-query'

/**
 * The shape of the object returned by `useSavedViews`.
 *
 * All values mirror the `views` namespace exposed by `useRecordQuery` so that
 * `useRecordQuery` can spread this directly into its return value.
 */
export interface SavedViewsResult {
  /** Ordered list of all saved views for the current table. */
  list: SavedView[]
  /**
   * Snapshot the current filter, column visibility, column order, and sort order
   * into a new saved view and persist it to localStorage.
   *
   * Pagination offsets are intentionally excluded from the snapshot so that loading
   * the view always starts at page 1.
   *
   * @param name - User-visible label for the saved view.
   * @returns The newly created `SavedView` object.
   */
  saveView: (name: string) => SavedView
  /**
   * Apply a previously saved view to the current query state.
   *
   * Restores filter, column visibility, column order, and sort order from the view.
   * Pagination resets to page 1 and the quick-search term is cleared.
   *
   * @param view - The saved view to load.
   */
  loadView: (view: SavedView) => void
  /**
   * Remove a saved view from localStorage by its ID.
   *
   * @param id - The `id` of the `SavedView` to delete.
   */
  deleteView: (id: string) => void
}

/**
 * Manages saved views (named filter snapshots) for the Record Query page.
 *
 * Saved views are persisted to localStorage. This hook owns the localStorage
 * read/write for the saved-views list, and delegates state mutations to the
 * parent `useRecordQuery` reducer via `dispatch`.
 *
 * @param tableName - Backend table name used as the localStorage key prefix.
 * @param state - Current `RecordQueryState` snapshot from `useRecordQuery`.
 * @param dispatch - Dispatcher from `useRecordQuery`'s `useReducer` call.
 * @returns Object containing the saved views list and stable callbacks for
 *   saving, loading, and deleting views.
 */
export function useSavedViews(
  tableName: string,
  state: RecordQueryState,
  dispatch: Dispatch<RecordQueryAction>
): SavedViewsResult {
  const storageKeySavedViews = `qqq-${tableName}-saved-views`

  const [savedViews, setSavedViews] = useLocalStorage<SavedView[]>(storageKeySavedViews, [])

  // ------------------------------------------------------------------
  // Stable callbacks
  // ------------------------------------------------------------------

  /**
   * Snapshot the current filter, column visibility, column order, and sort order
   * into a new saved view and persist it to localStorage.
   */
  const saveView = useCallback(
    (name: string) => {
      const view: SavedView = {
        id: crypto.randomUUID(),
        name,
        filter: {
          criteria: state.userFilter.criteria,
          orderBys: state.userFilter.orderBys,
          subFilters: state.userFilter.subFilters,
          booleanOperator: state.userFilter.booleanOperator,
        },
        columnVisibility: state.columnVisibility,
        columnOrder: state.columnOrder,
        sortOrder: state.sortOrder,
        createdAt: new Date().toISOString(),
      }
      setSavedViews((prev) => [...prev, view])
      return view
    },
    [
      state.userFilter,
      state.columnVisibility,
      state.columnOrder,
      state.sortOrder,
      setSavedViews,
    ]
  )

  /**
   * Apply a previously saved view to the current query state.
   */
  const loadView = useCallback(
    (view: SavedView) => {
      dispatch({ type: 'LOAD_SAVED_VIEW', view })
    },
    [dispatch]
  )

  /**
   * Remove a saved view from localStorage by its ID.
   */
  const deleteView = useCallback(
    (id: string) => {
      setSavedViews((prev) => prev.filter((v) => v.id !== id))
    },
    [setSavedViews]
  )

  return {
    list: savedViews,
    saveView,
    loadView,
    deleteView,
  }
}
