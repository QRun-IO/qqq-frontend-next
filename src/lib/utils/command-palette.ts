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
 * @file command-palette — the command palette's matching, ranking and current-table actions,
 * following the Material dashboard's CommandMenu: per-word substring matching, labels that
 * start with the search first, and a "{Table} Actions" group (New, Copy, Edit, Audit and the
 * table's processes) on the table's query and record screens.
 */

import type { QIcon, QInstance, QProcessMetaData, QTableMetaData } from '@/types'
import { auditSource } from '@/lib/api/audits'
import { canEditRecords, canInsertRecords } from '@/lib/auth/permissions'
import { processRunHref } from './material-links'
import { getProcessesForTable, getRecordActionProcesses, launchTableName } from './process-utils'

/**
 * Whether a palette entry matches the search, as Material's `doFilter` does: one word matches
 * anywhere in the value; several words must each be found in the value's words, in order
 * (a word may match the same value word as the previous one), and a search with more words
 * than the value never matches.
 *
 * @param value - The entry's searchable text.
 * @param search - What the user typed.
 * @returns Whether the entry is shown.
 */
export function commandMatches(value: string, search: string): boolean {
  const searchParts = search.toLowerCase().split(' ')
  if (searchParts.length === 1) return value.toLowerCase().includes(search.toLowerCase())
  const valueParts = value.toLowerCase().split(' ')
  if (searchParts.length > valueParts.length) return false
  let valueIndex = 0
  for (const part of searchParts) {
    let found = false
    for (; valueIndex < valueParts.length; valueIndex++) {
      if (valueParts[valueIndex].includes(part)) {
        found = true
        break
      }
    }
    if (!found) return false
  }
  return true
}

/**
 * Orders two labels as Material's `comparator` does while searching: a label starting with the
 * whole search first, then one starting with its first word, then alphabetical.
 *
 * @param labelA - First label.
 * @param labelB - Second label.
 * @param search - What the user typed (blank keeps the given order).
 * @returns A sort comparison result.
 */
export function compareCommandLabels(labelA: string, labelB: string, search: string): number {
  if (search === '') return 0
  const a = labelA.toLowerCase()
  const b = labelB.toLowerCase()
  const whole = search.toLowerCase()
  if (a.startsWith(whole) !== b.startsWith(whole)) return a.startsWith(whole) ? -1 : 1
  const space = whole.indexOf(' ')
  if (space > 0) {
    const first = whole.substring(0, space)
    if (a.startsWith(first) !== b.startsWith(first)) return a.startsWith(first) ? -1 : 1
  }
  return labelA.localeCompare(labelB)
}

/** One entry of the "{Table} Actions" group. */
export interface TableAction {
  /** Stable key (`new`, `copy`, `edit`, `audit` or `process-{name}`). */
  key: string
  /** Label shown and matched. */
  label: string
  /** Material icon for the entry. */
  icon: QIcon
  /** Destination path; absent for Audit, which opens the record's audit dialog (`#audit`). */
  path?: string
}

/** The table screen the palette opened over, when it offers table actions. */
export interface TableScreen {
  /** The table's metadata (from the instance). */
  table: QTableMetaData
  /** The record id on a record view; absent on the query screen. */
  recordId?: string
}

/**
 * Finds the table screen under the palette: the table's query screen (or a saved view of it) or
 * one of its record views. Create, edit and copy screens, other table pages and an open audit
 * dialog offer no table actions (Material hides the group on edit, create, copy and audit).
 *
 * @param pathname - The current path.
 * @param hash - The current hash (`#audit` while the audit dialog is open).
 * @param metaData - Instance metadata.
 * @returns The screen, or `null` when the palette offers no table actions.
 */
export function tableScreenFor(pathname: string, hash: string, metaData: QInstance | undefined): TableScreen | null {
  const segments = pathname.split('/').filter(Boolean).map((segment) => {
    try {
      return decodeURIComponent(segment)
    } catch {
      return segment
    }
  })
  if (segments[0] !== 'app' || !segments[1]) return null
  const table = metaData?.tables?.[segments[1]]
  if (!table || hash.replace(/^#\/?/, '') === 'audit') return null
  const rest = segments.slice(2)
  if (rest.length === 0 || (rest[0] === 'savedView' && rest.length === 2)) return { table }
  if (rest.length === 1 && !['create', 'dev', 'key', 'savedView'].includes(rest[0])) return { table, recordId: rest[0] }
  return null
}

/**
 * Builds the "{Table} Actions" entries for a table screen, gated like the screen's own controls:
 * New and Copy need insert permission and the TABLE_INSERT capability, Edit needs edit permission
 * and TABLE_UPDATE, Audit needs audits the user can read; then the table's processes by label
 * (on a record view, those that accept a single record). Copy, Edit and Audit need a record.
 *
 * @param screen - The table screen.
 * @param metaData - Instance metadata.
 * @returns The entries, in Material's order.
 */
export function buildTableActions(screen: TableScreen, metaData: QInstance): TableAction[] {
  const { table, recordId } = screen
  const tablePath = `/app/${encodeURIComponent(table.name)}`
  const recordPath = recordId === undefined ? undefined : `${tablePath}/${encodeURIComponent(recordId)}`
  const actions: TableAction[] = []
  if (canInsertRecords(table)) actions.push({ key: 'new', label: 'New', icon: { name: 'add' }, path: `${tablePath}/create` })
  if (recordPath && canInsertRecords(table)) actions.push({ key: 'copy', label: 'Copy', icon: { name: 'content_copy' }, path: `${recordPath}/copy` })
  if (recordPath && canEditRecords(table)) actions.push({ key: 'edit', label: 'Edit', icon: { name: 'edit' }, path: `${recordPath}/edit` })
  if (recordPath && auditSource(metaData)) actions.push({ key: 'audit', label: 'Audit', icon: { name: 'checklist' } })

  const screenProcesses = getProcessesForTable(metaData, table.name)
  const processes: QProcessMetaData[] = recordPath
    ? getRecordActionProcesses(screenProcesses, table.name)
    : screenProcesses.filter((process) => process.hasPermission !== false)
  for (const process of [...processes].sort((a, b) => a.label.localeCompare(b.label))) {
    const tableName = launchTableName(process, table.name)
    actions.push({
      key: `process-${process.name}`,
      label: process.label,
      icon: process.icon?.name || process.icon?.path ? process.icon : { name: process.iconName || 'play_arrow' },
      path: processRunHref(process.name, recordPath ? { recordId, returnTo: recordPath, tableName } : { returnTo: tablePath, tableName }),
    })
  }
  return actions
}
