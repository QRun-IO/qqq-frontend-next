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
 * @file query-view-storage — what the query screen remembers per table in localStorage, under the
 * Material dashboard's keys: the last view (`qqq.recordQueryView.<table>`, a `RecordQueryView`
 * document whose `viewIdentity` names the saved view it came from) and the last saved view
 * (`qqq.currentSavedViewId.<table>`). The row density (`qqq.density`) is global, as in Material.
 * Every access is best-effort: storage may be unavailable.
 */

import { parseViewJson, type RecordQueryView } from './saved-view-utils'
import { CURRENT_SAVED_VIEW_ID_STORAGE_KEY_ROOT, VIEW_STORAGE_KEY_ROOT } from './query-view-storage-cleanup'

export { CURRENT_SAVED_VIEW_ID_STORAGE_KEY_ROOT, VIEW_STORAGE_KEY_ROOT } from './query-view-storage-cleanup'
/** The (global) row density key. */
export const DENSITY_STORAGE_KEY = 'qqq.density'
/** The `viewIdentity` of an ad-hoc (unsaved) view. */
export const AD_HOC_VIEW_IDENTITY = 'empty'

/**
 * The `viewIdentity` of a saved view's document.
 *
 * @param id - Saved view id.
 * @returns `savedView:{id}`.
 */
export function savedViewIdentity(id: number): string {
  return `savedView:${id}`
}

/**
 * Reads the last view of a table.
 *
 * @param tableName - Table name.
 * @returns The view document, or null when none is stored (or it cannot be read).
 */
export function readStoredQueryView(tableName: string): RecordQueryView | null {
  try {
    const raw = localStorage.getItem(`${VIEW_STORAGE_KEY_ROOT}.${tableName}`)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parseViewJson(parsed)
  } catch {
    return null
  }
}

/**
 * Remembers the last view of a table.
 *
 * @param tableName - Table name.
 * @param view - The view document (with its `viewIdentity`).
 */
export function writeStoredQueryView(tableName: string, view: RecordQueryView): void {
  try {
    localStorage.setItem(`${VIEW_STORAGE_KEY_ROOT}.${tableName}`, JSON.stringify(view))
  } catch {
    // persistence is best-effort
  }
}

/**
 * Reads the id of the saved view last open on a table.
 *
 * @param tableName - Table name.
 * @returns The id, or null.
 */
export function readCurrentSavedViewId(tableName: string): number | null {
  try {
    const raw = localStorage.getItem(`${CURRENT_SAVED_VIEW_ID_STORAGE_KEY_ROOT}.${tableName}`)
    const id = raw === null ? NaN : Number.parseInt(raw, 10)
    return Number.isFinite(id) && id > 0 ? id : null
  } catch {
    return null
  }
}

/**
 * Remembers (or, with null, forgets) the saved view open on a table.
 *
 * @param tableName - Table name.
 * @param id - The saved view id, or null to forget it.
 */
export function writeCurrentSavedViewId(tableName: string, id: number | null): void {
  try {
    const key = `${CURRENT_SAVED_VIEW_ID_STORAGE_KEY_ROOT}.${tableName}`
    if (id === null) localStorage.removeItem(key)
    else localStorage.setItem(key, String(id))
  } catch {
    // persistence is best-effort
  }
}

/**
 * Forgets a table's remembered view and saved view (Material's error-boundary "click here to fix it").
 *
 * @param tableName - Table name.
 */
export function clearStoredQueryState(tableName: string): void {
  try {
    localStorage.removeItem(`${VIEW_STORAGE_KEY_ROOT}.${tableName}`)
    localStorage.removeItem(`${CURRENT_SAVED_VIEW_ID_STORAGE_KEY_ROOT}.${tableName}`)
  } catch {
    // persistence is best-effort
  }
}

/** Column settings the query screen stored per table before it stored whole views. */
export interface LegacyColumnState {
  columnVisibility: Record<string, boolean>
  columnOrder: string[]
  columnWidths: Record<string, number>
}

/**
 * Reads the column settings earlier versions stored under `qqq-<table>-columns`,
 * `qqq-<table>-column-order` and `qqq-<table>-column-widths`, so upgrading keeps them.
 *
 * @param tableName - Table name.
 * @returns The settings, or null when none are stored.
 */
export function readLegacyColumnState(tableName: string): LegacyColumnState | null {
  try {
    const read = <T>(suffix: string, valid: (value: unknown) => boolean, fallback: T): T => {
      const raw = localStorage.getItem(`qqq-${tableName}-${suffix}`)
      if (!raw) return fallback
      const value: unknown = JSON.parse(raw)
      return valid(value) ? value as T : fallback
    }
    const isRecord = (value: unknown) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    const columnVisibility = read<Record<string, boolean>>('columns', isRecord, {})
    const columnOrder = read<string[]>('column-order', (value) => Array.isArray(value) && value.every((v) => typeof v === 'string'), [])
    const columnWidths = read<Record<string, number>>('column-widths', isRecord, {})
    if (!Object.keys(columnVisibility).length && !columnOrder.length && !Object.keys(columnWidths).length) return null
    return { columnVisibility, columnOrder, columnWidths }
  } catch {
    return null
  }
}
