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
 * @file record-menu-utils — the record view's menus, resolved from table metadata the way the
 * Material dashboard does (RecordViewMenus.tsx): the table's `VIEW_SCREEN_ACTIONS` menu or the
 * default actions menu, and its `VIEW_SCREEN_ADDITIONAL` menus, with built-in options filtered by
 * capability and permission, process lists that skip processes already shown, and no leading,
 * repeated or trailing dividers.
 */

import type { QProcessMetaData, QRecord, QTableMenu, QTableMenuItem, QTableMetaData } from '@/types'

/** Slot of the record view's actions menu. */
export const VIEW_SCREEN_ACTIONS = 'VIEW_SCREEN_ACTIONS'
/** Slot of the record view's additional menus. */
export const VIEW_SCREEN_ADDITIONAL = 'VIEW_SCREEN_ADDITIONAL'

/**
 * The default actions menu when the table defines none (Material `buildDefaultActionMenu`,
 * QQQ `QMenuDefaultViewScreenActionsMenu`).
 */
export const DEFAULT_ACTIONS_MENU: QTableMenu = {
  label: 'Actions',
  slot: VIEW_SCREEN_ACTIONS,
  items: [
    { itemType: 'SUB_LIST', values: { items: ['NEW', 'COPY', 'EDIT', 'DELETE'].map((option) => ({ itemType: 'BUILT_IN', values: { option } })) } },
    { itemType: 'DIVIDER' },
    { itemType: 'BUILT_IN', values: { option: 'THIS_TABLE_PROCESS_LIST' } },
    { itemType: 'DIVIDER' },
    { itemType: 'SUB_LIST', values: { items: ['ALL_TABLES_PROCESS_LIST', 'DEVELOPER_MODE', 'AUDIT'].map((option) => ({ itemType: 'BUILT_IN', values: { option } })) } },
  ],
}

/** What choosing a menu item does. */
export type RecordMenuAction =
  | { type: 'new' }
  | { type: 'copy' }
  | { type: 'edit' }
  | { type: 'delete' }
  | { type: 'developerMode' }
  | { type: 'audit' }
  | { type: 'runProcess'; process: QProcessMetaData }
  | { type: 'downloadFile'; fieldName: string }

/** A menu entry ready to render. */
export type RecordMenuEntry =
  | {
    kind: 'item'
    key: string
    label: string
    /** The item's metadata icon name, when it declares one. */
    iconName?: string
    action: RecordMenuAction
    /** A download item whose field is empty. */
    disabled?: boolean
    /** Stable suffix for `data-qqq-id` (`record-action-<id>`, `mobile-action-<id>`). */
    id: string
  }
  | { kind: 'divider'; key: string }
  | { kind: 'submenu'; key: string; label: string; iconName?: string; id: string; entries: RecordMenuEntry[] }

/** What the menus may offer for the record being viewed. */
export interface RecordMenuContext {
  /** The record's table. */
  tableMetaData: QTableMetaData
  /** The record (DOWNLOAD_FILE items are disabled when their field is empty). */
  record: QRecord
  /** Insert capability and permission (NEW, COPY). */
  canInsert: boolean
  /** Update capability and permission (EDIT). */
  canEdit: boolean
  /** Delete capability and permission (DELETE). */
  canDelete: boolean
  /** Whether the user can read this record's audits (AUDIT). */
  canAudit: boolean
  /** The screen's single-record processes: the table's own, then those added to every screen. */
  processes: QProcessMetaData[]
  /** Every process in the user's metadata, for RUN_PROCESS items. */
  allProcesses?: Record<string, QProcessMetaData>
}

/**
 * Whether a value from `values` is a list of menu items.
 *
 * @param value - Candidate.
 * @returns True for an array of objects with an `itemType`.
 */
function isItemList(value: unknown): value is QTableMenuItem[] {
  return Array.isArray(value) && value.every((item) => item !== null && typeof item === 'object' && typeof (item as QTableMenuItem).itemType === 'string')
}

/**
 * A string from an item's values.
 *
 * @param item - Menu item.
 * @param key - Value key.
 * @returns The text, or undefined.
 */
function valueString(item: QTableMenuItem, key: string): string | undefined {
  const value = item.values?.[key]
  return typeof value === 'string' && value ? value : undefined
}

/**
 * The record view's actions menu: the table's `VIEW_SCREEN_ACTIONS` menu, else the default.
 *
 * @param tableMetaData - Table metadata.
 * @returns The menu.
 */
export function recordActionsMenu(tableMetaData: QTableMetaData): QTableMenu {
  return (tableMetaData.menus ?? []).find((menu) => menu.slot === VIEW_SCREEN_ACTIONS) ?? DEFAULT_ACTIONS_MENU
}

/**
 * The table's `VIEW_SCREEN_ADDITIONAL` menus, in order.
 *
 * @param tableMetaData - Table metadata.
 * @returns The menus.
 */
export function recordAdditionalMenus(tableMetaData: QTableMetaData): QTableMenu[] {
  return (tableMetaData.menus ?? []).filter((menu) => menu.slot === VIEW_SCREEN_ADDITIONAL)
}

/**
 * Whether a record value is empty (no file to download).
 *
 * @param value - Field value.
 * @returns True for null, undefined and ''.
 */
function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || value === ''
}

/**
 * Resolves a menu's items into entries, in one pass so that process lists skip processes an
 * earlier item already showed and dividers never lead, repeat or trail.
 *
 * @param items - The menu's items.
 * @param context - What the menu may offer.
 * @returns The entries to render.
 */
export function resolveRecordMenu(items: QTableMenuItem[] | undefined, context: RecordMenuContext): RecordMenuEntry[] {
  const shownProcesses = new Set<string>()
  const tableName = context.tableMetaData.name
  const own = context.processes
    .filter((process) => process.tableName === tableName)
    .sort((a, b) => a.label.localeCompare(b.label))
  const generic = context.processes.filter((process) => process.tableName !== tableName)

  // processes an item names individually are not repeated by a later process list (Material ItemsShownInMenu)
  const collectNamed = (list: QTableMenuItem[] | undefined) => {
    for (const item of list ?? []) {
      if (item.itemType === 'RUN_PROCESS') {
        const name = valueString(item, 'processName')
        if (name) shownProcesses.add(name)
      } else if (isItemList(item.values?.items)) {
        collectNamed(item.values.items)
      }
    }
  }
  collectNamed(items)

  const processEntry = (process: QProcessMetaData, key: string, label?: string, iconName?: string): RecordMenuEntry => ({
    kind: 'item', key, label: label ?? process.label, iconName: iconName ?? process.icon?.name ?? process.iconName ?? undefined,
    action: { type: 'runProcess', process }, id: process.name,
  })

  const resolve = (list: QTableMenuItem[] | undefined, prefix: string): RecordMenuEntry[] => {
    const out: RecordMenuEntry[] = []
    ;(list ?? []).forEach((item, index) => {
      const key = `${prefix}${index}`
      const label = item.label || undefined
      const iconName = item.icon?.name || undefined
      switch (item.itemType) {
        case 'DIVIDER':
          out.push({ kind: 'divider', key })
          return
        case 'SUB_LIST':
          out.push(...resolve(isItemList(item.values?.items) ? item.values.items : [], `${key}-`))
          return
        case 'SUB_MENU': {
          const entries = tidyDividers(resolve(isItemList(item.values?.items) ? item.values.items : [], `${key}-`))
          if (entries.some((entry) => entry.kind !== 'divider')) {
            out.push({ kind: 'submenu', key, label: label ?? 'More', iconName, id: `submenu-${key}`, entries })
          }
          return
        }
        case 'RUN_PROCESS': {
          const name = valueString(item, 'processName')
          const process = name ? (context.allProcesses?.[name] ?? context.processes.find((candidate) => candidate.name === name)) : undefined
          if (process && process.hasPermission !== false) out.push(processEntry(process, key, label, iconName))
          return
        }
        case 'DOWNLOAD_FILE': {
          const fieldName = valueString(item, 'fieldName')
          const field = fieldName ? context.tableMetaData.fields[fieldName] : undefined
          if (!fieldName || !field) return
          out.push({
            kind: 'item', key, label: label ?? field.label, iconName, action: { type: 'downloadFile', fieldName },
            disabled: isEmptyValue(context.record.values[fieldName]), id: `download-${fieldName}`,
          })
          return
        }
        case 'BUILT_IN': {
          const option = valueString(item, 'option')
          const builtIn = (type: Exclude<RecordMenuAction['type'], 'runProcess' | 'downloadFile'>, defaultLabel: string, id: string) =>
            out.push({ kind: 'item', key, label: label ?? defaultLabel, iconName, action: { type } as RecordMenuAction, id })
          switch (option) {
            case 'NEW': if (context.canInsert) builtIn('new', 'New', 'new'); return
            case 'COPY': if (context.canInsert) builtIn('copy', 'Copy', 'copy'); return
            case 'EDIT': if (context.canEdit) builtIn('edit', 'Edit', 'edit'); return
            case 'DELETE': if (context.canDelete) builtIn('delete', 'Delete', 'delete'); return
            case 'DEVELOPER_MODE': builtIn('developerMode', 'Developer Mode', 'developer-mode'); return
            case 'AUDIT': if (context.canAudit) builtIn('audit', 'Audit', 'audit'); return
            case 'THIS_TABLE_PROCESS_LIST':
            case 'ALL_TABLES_PROCESS_LIST':
              for (const process of option === 'THIS_TABLE_PROCESS_LIST' ? own : generic) {
                if (shownProcesses.has(process.name)) continue
                shownProcesses.add(process.name)
                out.push(processEntry(process, `${key}-${process.name}`))
              }
              return
            default:
              return
          }
        }
        default:
          return
      }
    })
    return out
  }

  return tidyDividers(resolve(items, ''))
}

/**
 * Drops dividers that would lead, repeat or trail (Material `okayToShowDivider`, plus the
 * trailing case Material left as a to-do).
 *
 * @param entries - Resolved entries.
 * @returns The entries with only separating dividers.
 */
export function tidyDividers(entries: RecordMenuEntry[]): RecordMenuEntry[] {
  const out: RecordMenuEntry[] = []
  for (const entry of entries) {
    if (entry.kind === 'divider' && (out.length === 0 || out[out.length - 1].kind === 'divider')) continue
    out.push(entry)
  }
  while (out.length > 0 && out[out.length - 1].kind === 'divider') out.pop()
  return out
}

/**
 * Whether resolved entries offer anything to choose.
 *
 * @param entries - Resolved entries.
 * @returns True when at least one item or submenu is present.
 */
export function hasMenuItems(entries: RecordMenuEntry[]): boolean {
  return entries.some((entry) => entry.kind !== 'divider')
}
