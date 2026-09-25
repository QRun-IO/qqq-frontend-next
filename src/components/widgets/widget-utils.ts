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
 * @file Pure helpers for widget export (CSV), dropdown selection storage and grid sizing.
 */

import type { QWidgetDropdown, QWidgetMetaData } from '@/types'

/** Root of the local-storage keys that persist widget dropdown selections (shared with Material). */
export const WIDGET_DROPDOWN_STORAGE_ROOT = 'qqq.widgets.dropdownData'

/** Root of the local-storage keys that persist the selected tab of a tabbed parent widget. */
export const WIDGET_SELECTED_TAB_STORAGE_ROOT = 'qqq.widgets.selectedTabs'

/** A dropdown selection as persisted: the option id and its label. */
export interface StoredDropdownSelection {
  id: string
  label?: string
}

/**
 * The query-parameter name a widget dropdown's selection is sent under: the
 * possible-value source name for PVS dropdowns, else the dropdown name (date pickers).
 *
 * @param dropdown - Dropdown metadata.
 * @returns The parameter name.
 */
export function dropdownParamName(dropdown: QWidgetDropdown): string {
  return dropdown.possibleValueSourceName ?? dropdown.name
}

/**
 * Local-storage key for one widget's dropdown selection.
 *
 * @param widgetName - Owning widget name.
 * @param paramName - Dropdown parameter name (see {@link dropdownParamName}).
 * @returns The storage key.
 */
export function dropdownStorageKey(widgetName: string, paramName: string): string {
  return `${WIDGET_DROPDOWN_STORAGE_ROOT}.${widgetName}.${paramName}`
}

/**
 * Reads a persisted dropdown selection; storage may be unavailable or corrupt.
 *
 * @param key - Storage key.
 * @returns The stored selection, or null.
 */
export function readStoredSelection(key: string): StoredDropdownSelection | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && 'id' in parsed) {
      const id = (parsed as { id: unknown }).id
      if (id === null || id === undefined || id === '') return null
      const label = (parsed as { label?: unknown }).label
      return { id: String(id), label: typeof label === 'string' ? label : undefined }
    }
  } catch {
    // unreadable storage means no stored selection
  }
  return null
}

/**
 * Persists (or clears, when `selection` is null) a dropdown selection.
 *
 * @param key - Storage key.
 * @param selection - Selection to store, or null to remove.
 */
export function writeStoredSelection(key: string, selection: StoredDropdownSelection | null): void {
  try {
    if (selection) window.localStorage.setItem(key, JSON.stringify(selection))
    else window.localStorage.removeItem(key)
  } catch {
    // storage is a convenience; ignore failures
  }
}

/**
 * Initial dropdown parameters for a widget from persisted selections, when the
 * widget (or its parent, for children) stores selections.
 *
 * @param widget - Widget metadata.
 * @param parent - Parent widget metadata, for child widgets.
 * @returns Parameter name → stored option id.
 */
export function storedDropdownParams(widget: QWidgetMetaData, parent?: QWidgetMetaData): Record<string, string> {
  const owner = widget.storeDropdownSelections && widget.dropdowns?.length ? widget
    : parent?.storeDropdownSelections && parent.dropdowns?.length ? parent : undefined
  const params: Record<string, string> = {}
  if (!owner) return params
  for (const dropdown of owner.dropdowns ?? []) {
    const name = dropdownParamName(dropdown)
    const stored = readStoredSelection(dropdownStorageKey(owner.name, name))
    if (stored) params[name] = stored.id
  }
  return params
}

/**
 * Converts a widget's `csvData` rows to CSV text exactly as the Material dashboard
 * does: numeric non-zero cells unquoted, everything else quoted with doubled quotes.
 *
 * @param csvData - Rows of cells.
 * @returns CSV text with a trailing newline per row.
 */
export function widgetCsvToString(csvData: unknown[][]): string {
  let csv = ''
  for (const row of csvData) {
    csv += row.map((cell) => {
      if (cell && !Number.isNaN(Number(String(cell)))) return String(cell)
      const text = cell === null || cell === undefined ? '' : String(cell)
      return `"${text.replace(/"/g, '""')}"`
    }).join(',')
    csv += '\n'
  }
  return csv
}

/**
 * Builds the export file name: `<label> <yyyy-MM-dd HHmm>.csv` in local time.
 *
 * @param label - Widget label.
 * @param now - Clock, injectable for tests.
 * @returns The file name.
 */
export function widgetExportFileName(label: string, now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${label} ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}${pad(now.getMinutes())}.csv`
}

/**
 * Triggers a browser download of text content.
 *
 * @param fileName - Download file name.
 * @param text - File contents.
 * @param mimeType - Content type.
 */
export function downloadText(fileName: string, text: string, mimeType = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Tailwind classes for QQQ's 12-column widget sizing (static strings for the JIT). */
const COLUMN_SPANS: Record<number, string> = {
  1: 'lg:col-span-1', 2: 'lg:col-span-2', 3: 'lg:col-span-3', 4: 'lg:col-span-4', 5: 'lg:col-span-5', 6: 'lg:col-span-6',
  7: 'lg:col-span-7', 8: 'lg:col-span-8', 9: 'lg:col-span-9', 10: 'lg:col-span-10', 11: 'lg:col-span-11', 12: 'lg:col-span-12',
}

/**
 * Column-span classes for a widget in a 12-column grid: full width on small
 * screens, `gridColumns` of 12 (default 12, as in Material) on large screens.
 *
 * @param gridColumns - Widget metadata grid columns.
 * @returns Tailwind classes.
 */
export function widgetColumnClasses(gridColumns?: number): string {
  const span = gridColumns && gridColumns >= 1 && gridColumns <= 12 ? Math.round(gridColumns) : 12
  return `col-span-12 ${COLUMN_SPANS[span]}`
}

/**
 * Strips HTML tags for plain-text export of HTML table cells.
 *
 * @param value - Cell value.
 * @returns Plain text.
 */
export function plainText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim()
}
