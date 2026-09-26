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

import type { QHelpContent, QWidgetDropdown, QWidgetHelpContent, QWidgetMetaData } from '@/types'
import { WIDGET_HELP_ROLES, selectSlotHelpContent } from '@/lib/utils/help-utils'

/** Root of the local-storage keys that persist widget dropdown selections (shared with Material). */
export const WIDGET_DROPDOWN_STORAGE_ROOT = 'qqq.widgets.dropdownData'

/** Root of the local-storage keys that persist the selected tab of a tabbed parent widget. */
export const WIDGET_SELECTED_TAB_STORAGE_ROOT = 'qqq.widgets.selectedTabs'

/**
 * Classes that make a widget link (a statistic, a block value, a stepper link) at least a
 * 44 x 44 px target on touch screens (QRun-IO/qqq#708); mouse layouts are unchanged.
 */
export const TOUCH_LINK = 'pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:items-center'

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
    if (stored) params[name] = dropdown.type === 'DATE_PICKER' ? normalizeDropdownDate(stored.id) : stored.id
  }
  return params
}

/**
 * The order of day, month and year in the browser locale's short date format.
 *
 * @returns Part types in display order (e.g. `['month', 'day', 'year']` for en-US).
 */
function localeDateOrder(): Array<'day' | 'month' | 'year'> {
  return new Intl.DateTimeFormat().formatToParts(new Date(2001, 10, 22))
    .map((part) => part.type)
    .filter((type): type is 'day' | 'month' | 'year' => type === 'day' || type === 'month' || type === 'year')
}

/**
 * Formats a date-picker selection the way the Material dashboard sends it to the widget
 * renderer: the local date's `toLocaleDateString()` (e.g. `12/31/2025` in en-US).
 *
 * @param date - The chosen day (local time).
 * @returns The value sent as the dropdown's parameter.
 */
export function formatDropdownDate(date: Date): string {
  return date.toLocaleDateString()
}

/**
 * Parses a date-picker value: an ISO day (`2025-12-31`, stored by earlier versions) or a
 * date in the browser locale's short format (what {@link formatDropdownDate} produces).
 *
 * @param value - The stored or sent value.
 * @returns The local day, or null when the value is not a date.
 */
export function parseDropdownDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
  const numbers = value.match(/\d+/g)
  const order = localeDateOrder()
  if (!numbers || numbers.length !== 3 || order.length !== 3) return null
  const part = (type: 'day' | 'month' | 'year') => Number(numbers[order.indexOf(type)])
  const date = new Date(part('year'), part('month') - 1, part('day'))
  return Number.isNaN(date.getTime()) || date.getDate() !== part('day') ? null : date
}

/**
 * Brings a stored date-picker value to the format the renderer is sent ({@link formatDropdownDate}).
 *
 * @param value - Stored value.
 * @returns The value to send (unchanged when it is not a date).
 */
export function normalizeDropdownDate(value: string): string {
  const date = parseDropdownDate(value)
  return date ? formatDropdownDate(date) : value
}

/**
 * The `yyyy-MM-dd` value of a local day, for a native date input.
 *
 * @param date - Local day.
 * @returns The input value.
 */
export function isoDay(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Name of the dropdown whose `custom` option opens a start/end range (Material `timeframe`). */
export const TIMEFRAME_DROPDOWN = 'timeframe'
/** Id of the timeframe option that asks for a custom range. */
export const CUSTOM_TIMEFRAME = 'custom'

/**
 * Converts a `datetime-local` value (local time) to the UTC form the backend reads
 * (`yyyy-MM-ddTHH:mm:ssZ`), as Material's `frontendLocalZoneDateTimeStringToUTCStringForBackend`.
 *
 * @param local - A `datetime-local` value.
 * @returns The UTC instant, or null when the value is not a date-time.
 */
export function localDateTimeToUtc(local: string): string | null {
  const date = new Date(local)
  if (!local || Number.isNaN(date.getTime())) return null
  return `${date.toISOString().slice(0, 19)}Z`
}

/**
 * Converts a UTC instant (`...Z`) to a `datetime-local` value in local time.
 *
 * @param utc - The instant.
 * @returns The local value (`yyyy-MM-ddTHH:mm`), or an empty string.
 */
export function utcToLocalDateTime(utc: string | undefined): string {
  const date = utc ? new Date(utc) : null
  if (!date || Number.isNaN(date.getTime())) return ''
  return `${isoDay(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/**
 * The value sent for a custom timeframe: `custom,<utcStart>,<utcEnd>`.
 *
 * @param startLocal - Start as a `datetime-local` value.
 * @param endLocal - End as a `datetime-local` value.
 * @returns The value, or null until both ends are set.
 */
export function customTimeframeValue(startLocal: string, endLocal: string): string | null {
  const start = localDateTimeToUtc(startLocal)
  const end = localDateTimeToUtc(endLocal)
  return start && end ? `${CUSTOM_TIMEFRAME},${start},${end}` : null
}

/**
 * Reads a custom timeframe value back into local start and end inputs.
 *
 * @param value - A selection id.
 * @returns The local range, or null when the value is not a custom timeframe.
 */
export function parseCustomTimeframe(value: string | null | undefined): { start: string; end: string } | null {
  if (!value?.startsWith(`${CUSTOM_TIMEFRAME},`)) return null
  const [, start, end] = value.split(',')
  return { start: utcToLocalDateTime(start), end: utcToLocalDateTime(end) }
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

/** Material Dashboard's grid breakpoints (xs 0, sm 576, md 768, lg 992, xl 1200, xxl 1400 px). */
const SIZE_CLASSES = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'] as const

/** Column-span classes per Material breakpoint (static strings for the JIT). */
const SIZE_CLASS_SPANS: Record<(typeof SIZE_CLASSES)[number], Record<number, string>> = {
  xs: { 1: 'col-span-1', 2: 'col-span-2', 3: 'col-span-3', 4: 'col-span-4', 5: 'col-span-5', 6: 'col-span-6', 7: 'col-span-7', 8: 'col-span-8', 9: 'col-span-9', 10: 'col-span-10', 11: 'col-span-11', 12: 'col-span-12' },
  sm: { 1: 'min-[576px]:col-span-1', 2: 'min-[576px]:col-span-2', 3: 'min-[576px]:col-span-3', 4: 'min-[576px]:col-span-4', 5: 'min-[576px]:col-span-5', 6: 'min-[576px]:col-span-6', 7: 'min-[576px]:col-span-7', 8: 'min-[576px]:col-span-8', 9: 'min-[576px]:col-span-9', 10: 'min-[576px]:col-span-10', 11: 'min-[576px]:col-span-11', 12: 'min-[576px]:col-span-12' },
  md: { 1: 'min-[768px]:col-span-1', 2: 'min-[768px]:col-span-2', 3: 'min-[768px]:col-span-3', 4: 'min-[768px]:col-span-4', 5: 'min-[768px]:col-span-5', 6: 'min-[768px]:col-span-6', 7: 'min-[768px]:col-span-7', 8: 'min-[768px]:col-span-8', 9: 'min-[768px]:col-span-9', 10: 'min-[768px]:col-span-10', 11: 'min-[768px]:col-span-11', 12: 'min-[768px]:col-span-12' },
  lg: { 1: 'min-[992px]:col-span-1', 2: 'min-[992px]:col-span-2', 3: 'min-[992px]:col-span-3', 4: 'min-[992px]:col-span-4', 5: 'min-[992px]:col-span-5', 6: 'min-[992px]:col-span-6', 7: 'min-[992px]:col-span-7', 8: 'min-[992px]:col-span-8', 9: 'min-[992px]:col-span-9', 10: 'min-[992px]:col-span-10', 11: 'min-[992px]:col-span-11', 12: 'min-[992px]:col-span-12' },
  xl: { 1: 'min-[1200px]:col-span-1', 2: 'min-[1200px]:col-span-2', 3: 'min-[1200px]:col-span-3', 4: 'min-[1200px]:col-span-4', 5: 'min-[1200px]:col-span-5', 6: 'min-[1200px]:col-span-6', 7: 'min-[1200px]:col-span-7', 8: 'min-[1200px]:col-span-8', 9: 'min-[1200px]:col-span-9', 10: 'min-[1200px]:col-span-10', 11: 'min-[1200px]:col-span-11', 12: 'min-[1200px]:col-span-12' },
  xxl: { 1: 'min-[1400px]:col-span-1', 2: 'min-[1400px]:col-span-2', 3: 'min-[1400px]:col-span-3', 4: 'min-[1400px]:col-span-4', 5: 'min-[1400px]:col-span-5', 6: 'min-[1400px]:col-span-6', 7: 'min-[1400px]:col-span-7', 8: 'min-[1400px]:col-span-8', 9: 'min-[1400px]:col-span-9', 10: 'min-[1400px]:col-span-10', 11: 'min-[1400px]:col-span-11', 12: 'min-[1400px]:col-span-12' },
}

/**
 * A column count from metadata, rounded into 1-12.
 *
 * @param value - Declared columns.
 * @returns The span, or undefined when the value is not a usable number.
 */
function columnSpan(value: unknown): number | undefined {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
  return Number.isFinite(number) && number >= 1 && number <= 12 ? Math.round(number) : undefined
}

/**
 * Column-span classes for a widget in a 12-column grid: full width on small
 * screens, `gridColumns` of 12 (default 12, as in Material) on large screens.
 *
 * A widget that declares per-breakpoint sizes (`gridCols:sizeClass:{xs,sm,md,lg,xl,xxl}` in its
 * `defaultValues`) is sized as Material sizes it: each declared breakpoint (Material's widths)
 * applies from its width up, `xs` defaults to 12 and `xxl` to `gridColumns`.
 *
 * @param gridColumns - Widget metadata grid columns.
 * @param defaultValues - Widget metadata default values (per-breakpoint overrides).
 * @returns Tailwind classes.
 */
export function widgetColumnClasses(gridColumns?: number, defaultValues?: Record<string, unknown>): string {
  const sizes = Object.fromEntries(SIZE_CLASSES.map((size) => [size, columnSpan(defaultValues?.[`gridCols:sizeClass:${size}`])]))
  if (Object.values(sizes).some((span) => span !== undefined)) {
    sizes.xs ??= 12
    sizes.xxl ??= columnSpan(gridColumns) ?? 12
    const classes = SIZE_CLASSES.flatMap((size) => (sizes[size] ? [SIZE_CLASS_SPANS[size][sizes[size]]] : []))
    return `${classes.join(' ')} min-w-0`
  }
  const span = columnSpan(gridColumns) ?? 12
  return `col-span-12 min-w-0 ${COLUMN_SPANS[span]}`
}

/** Classes for a dashboard grid item: an in-page anchor target (`#widgetName`) clear of the header. */
export const WIDGET_ANCHOR = 'scroll-mt-[100px]'

/**
 * The help entry declared for one of a widget's help slots (Material `WidgetUtils.getHelp`):
 * the entries under `slot` in the widget's help content, chosen by screen role. A single
 * `{content}` help (the legacy shape) is the `label` slot's. In help-authoring mode
 * (`?helpHelp`) every slot returns an entry ending with its key (`widget:{name};slot:{slot}`).
 *
 * @param widgetMetaData - Widget metadata.
 * @param slot - Slot name (`label`, `sectionSubhead`, `top`, `{blockId},{slot}`, ...).
 * @param roles - The screen's help roles, most specific first.
 * @param helpHelpActive - Whether help-authoring mode is on.
 * @returns The entry to show, or undefined.
 */
export function widgetSlotHelp(
  widgetMetaData: QWidgetMetaData | undefined,
  slot: string,
  roles: readonly string[] = WIDGET_HELP_ROLES,
  helpHelpActive = false,
): QWidgetHelpContent | undefined {
  if (!widgetMetaData) return undefined
  const helpContent = widgetMetaData.helpContent
  let entries: QWidgetHelpContent[] | undefined
  if (helpContent && 'content' in helpContent && typeof helpContent.content === 'string') {
    entries = slot === 'label' ? [{ content: helpContent.content, format: 'TEXT' }] : undefined
  } else if (helpContent) {
    const slotEntries = (helpContent as Record<string, QWidgetHelpContent[]>)[slot]
    entries = Array.isArray(slotEntries) ? slotEntries : undefined
  }
  return selectSlotHelpContent(entries as QHelpContent[] | undefined, roles, widgetHelpKey(widgetMetaData.name, slot), helpHelpActive) as QWidgetHelpContent | undefined
}

/**
 * The help-content key of a widget slot (`widget:{name};slot:{slot}`), shown in help-authoring mode.
 *
 * @param widgetName - Widget name.
 * @param slot - Slot name.
 * @returns The key.
 */
export function widgetHelpKey(widgetName: string, slot: string): string {
  return `widget:${widgetName};slot:${slot}`
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
