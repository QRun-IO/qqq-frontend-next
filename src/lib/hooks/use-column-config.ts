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
 * @file use-column-config — sub-hook that manages column visibility, order, widths,
 * and the column-config panel open state for the Record Query page.
 *
 * This hook is an internal implementation detail of `useRecordQuery`. It is not
 * intended to be consumed directly by page or component code — use the `columns`
 * namespace returned by `useRecordQuery` instead.
 */

'use client'

import { useCallback, useEffect, type Dispatch } from 'react'

import { useLocalStorage } from '@/lib/hooks/use-local-storage'
import type { RecordQueryState, RecordQueryAction } from '@/lib/hooks/use-record-query'

/**
 * The shape of the object returned by `useColumnConfig`.
 *
 * All values mirror the `columns` namespace exposed by `useRecordQuery` so that
 * `useRecordQuery` can spread this directly into its return value.
 */
export interface ColumnConfigResult {
  /** Map of fieldName → visible; `undefined` entries are treated as visible. */
  columnVisibility: Record<string, boolean>
  /** Ordered list of column field names; empty array means metadata-default order. */
  columnOrder: string[]
  /** Map of fieldName → pixel width for resized columns. */
  columnWidths: Record<string, number>
  /** Whether the column-configuration side panel is open. */
  columnConfigOpen: boolean
  /**
   * Replace the entire column visibility map.
   *
   * @param visibility - Map of fieldName → boolean.
   */
  setColumnVisibility: (visibility: Record<string, boolean>) => void
  /**
   * Toggle a single column's visibility.
   *
   * Treats `undefined` (never toggled) as `true` before inverting (MED-11).
   *
   * @param fieldName - The field to toggle.
   */
  toggleColumn: (fieldName: string) => void
  /**
   * Replace the ordered list of column field names.
   *
   * @param order - Array of field names in the desired display order.
   */
  setColumnOrder: (order: string[]) => void
  /**
   * Record the pixel width of a resized column.
   *
   * @param fieldName - The resized column's field name.
   * @param width - New width in pixels.
   */
  setColumnWidth: (fieldName: string, width: number) => void
  /** Toggle the column-configuration side panel open/closed. */
  toggleColumnConfig: () => void
  /**
   * Explicitly set the open state of the column-configuration side panel.
   *
   * @param open - `true` to open, `false` to close.
   */
  setColumnConfigOpen: (open: boolean) => void
}

/**
 * Manages column visibility, order, widths, and the column-config panel open state
 * for the Record Query page.
 *
 * Column visibility, order, and widths are persisted to localStorage so they survive
 * navigation and page refreshes. The panel open state is ephemeral (in-memory only).
 *
 * This hook reads its authoritative state from the `RecordQueryState` managed by the
 * parent `useRecordQuery` hook and dispatches actions to mutate it. The returned
 * localStorage setters are used only to initialize state and sync persistence — the
 * reducer is the single source of truth during a session.
 *
 * @param tableName - Backend table name used as the localStorage key prefix.
 * @param state - Current `RecordQueryState` snapshot from `useRecordQuery`.
 * @param dispatch - Dispatcher from `useRecordQuery`'s `useReducer` call.
 * @returns Object containing all column-config state values and stable callback functions.
 */
export function useColumnConfig(
  tableName: string,
  state: RecordQueryState,
  dispatch: Dispatch<RecordQueryAction>
): ColumnConfigResult {
  const storageKeyColumns = `qqq-${tableName}-columns`
  const storageKeyColumnOrder = `qqq-${tableName}-column-order`
  const storageKeyColumnWidths = `qqq-${tableName}-column-widths`

  const [, setStoredColumnVisibility] = useLocalStorage<Record<string, boolean>>(
    storageKeyColumns,
    {}
  )
  const [, setStoredColumnOrder] = useLocalStorage<string[]>(storageKeyColumnOrder, [])
  const [, setStoredColumnWidths] = useLocalStorage<Record<string, number>>(
    storageKeyColumnWidths,
    {}
  )

  // ------------------------------------------------------------------
  // Persist column settings to localStorage when they change
  // ------------------------------------------------------------------
  useEffect(() => {
    setStoredColumnVisibility(state.columnVisibility)
  }, [state.columnVisibility]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setStoredColumnOrder(state.columnOrder)
  }, [state.columnOrder]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setStoredColumnWidths(state.columnWidths)
  }, [state.columnWidths]) // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------------
  // Stable dispatch wrappers
  // ------------------------------------------------------------------
  /** Replace the entire column visibility map. */
  const setColumnVisibility = useCallback(
    (visibility: Record<string, boolean>) =>
      dispatch({ type: 'SET_COLUMN_VISIBILITY', visibility }),
    [dispatch]
  )

  /** Toggle a single column's visibility. */
  const toggleColumn = useCallback(
    (fieldName: string) => dispatch({ type: 'TOGGLE_COLUMN', fieldName }),
    [dispatch]
  )

  /** Replace the ordered list of column field names. */
  const setColumnOrder = useCallback(
    (order: string[]) => dispatch({ type: 'SET_COLUMN_ORDER', order }),
    [dispatch]
  )

  /** Record the pixel width of a resized column. */
  const setColumnWidth = useCallback(
    (fieldName: string, width: number) =>
      dispatch({ type: 'SET_COLUMN_WIDTH', fieldName, width }),
    [dispatch]
  )

  /** Toggle the column-configuration side panel open/closed. */
  const toggleColumnConfig = useCallback(
    () => dispatch({ type: 'TOGGLE_COLUMN_CONFIG' }),
    [dispatch]
  )

  /** Explicitly set the open state of the column-configuration side panel. */
  const setColumnConfigOpen = useCallback(
    (open: boolean) => dispatch({ type: 'SET_COLUMN_CONFIG_OPEN', open }),
    [dispatch]
  )

  return {
    columnVisibility: state.columnVisibility,
    columnOrder: state.columnOrder,
    columnWidths: state.columnWidths,
    columnConfigOpen: state.columnConfigOpen,
    setColumnVisibility,
    toggleColumn,
    setColumnOrder,
    setColumnWidth,
    toggleColumnConfig,
    setColumnConfigOpen,
  }
}
