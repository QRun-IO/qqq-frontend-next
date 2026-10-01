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

import { describe, expect, it } from 'vitest'

import type { QProcessMetaData, QTableMetaData, QTableMenuItem } from '@/types'
import {
  DEFAULT_ACTIONS_MENU, hasMenuItems, recordActionsMenu, recordAdditionalMenus, resolveRecordMenu, tidyDividers,
  type RecordMenuContext, type RecordMenuEntry,
} from './record-menu-utils'

function process(name: string, label: string, tableName = 'lab', extra: Partial<QProcessMetaData> = {}): QProcessMetaData {
  return { name, label, tableName, isHidden: false, iconName: '', hasPermission: true, frontendSteps: [], ...extra } as QProcessMetaData
}

const table = {
  name: 'lab', label: 'Lab', primaryKeyField: 'id', sections: [], exposedJoins: [], capabilities: [],
  fields: {
    id: { name: 'id', label: 'Id', type: 'INTEGER' },
    report: { name: 'report', label: 'Report File', type: 'BLOB' },
    manual: { name: 'manual', label: 'Manual', type: 'STRING' },
  },
} as unknown as QTableMetaData

function context(extra: Partial<RecordMenuContext> = {}): RecordMenuContext {
  return {
    tableMetaData: table,
    record: { tableName: 'lab', values: { id: 1, report: 'Ynl0ZXM=', manual: null }, displayValues: {} },
    canInsert: true, canEdit: true, canDelete: true, canAudit: true,
    processes: [process('zeta', 'Zeta Recount'), process('alpha', 'Alpha Review'), process('tag', 'Tag Records', 'other')],
    ...extra,
  }
}

/** A readable outline of entries: labels, `---` for dividers, `Label >` for submenus. */
function outline(entries: RecordMenuEntry[]): unknown[] {
  return entries.map((entry) => {
    if (entry.kind === 'divider') return '---'
    if (entry.kind === 'submenu') return { [`${entry.label} >`]: outline(entry.entries) }
    return entry.disabled ? `${entry.label} (disabled)` : entry.label
  })
}

describe('record view actions menu', () => {
  it('defaults to Material\'s menu: CRUD, own processes by label, then added processes, Developer Mode and Audit', () => {
    expect(recordActionsMenu(table)).toBe(DEFAULT_ACTIONS_MENU)
    expect(outline(resolveRecordMenu(DEFAULT_ACTIONS_MENU.items, context()))).toEqual([
      'New', 'Copy', 'Edit', 'Delete', '---', 'Alpha Review', 'Zeta Recount', '---', 'Tag Records', 'Developer Mode', 'Audit',
    ])
  })

  it('filters built-ins by permission and drops the dividers that would lead or repeat', () => {
    const readOnly = context({ canInsert: false, canEdit: false, canDelete: false, canAudit: false, processes: [] })
    expect(outline(resolveRecordMenu(DEFAULT_ACTIONS_MENU.items, readOnly))).toEqual(['Developer Mode'])
    const editOnly = context({ canInsert: false, canDelete: false, processes: [] })
    expect(outline(resolveRecordMenu(DEFAULT_ACTIONS_MENU.items, editOnly))).toEqual(['Edit', '---', 'Developer Mode', 'Audit'])
  })

  it('uses the table\'s VIEW_SCREEN_ACTIONS menu and lists its VIEW_SCREEN_ADDITIONAL menus', () => {
    const custom = { slot: 'VIEW_SCREEN_ACTIONS', label: 'Record Actions', items: [{ itemType: 'BUILT_IN', values: { option: 'EDIT' } }] }
    const files = { slot: 'VIEW_SCREEN_ADDITIONAL', label: 'Files', items: [] }
    const other = { slot: 'QUERY_SCREEN_ACTIONS', label: 'Query', items: [] }
    const withMenus = { ...table, menus: [other, files, custom] }
    expect(recordActionsMenu(withMenus)).toBe(custom)
    expect(recordAdditionalMenus(withMenus)).toEqual([files])
  })

  it('resolves run-process, download, sub-list, sub-menu and divider items; named processes are not repeated', () => {
    const items: QTableMenuItem[] = [
      { itemType: 'DIVIDER' },
      { itemType: 'SUB_LIST', values: { items: [{ itemType: 'BUILT_IN', values: { option: 'NEW' } }, { itemType: 'BUILT_IN', values: { option: 'EDIT' }, label: 'Change It' }] } },
      { itemType: 'DIVIDER' },
      { itemType: 'DIVIDER' },
      { itemType: 'RUN_PROCESS', values: { processName: 'zeta' } },
      { itemType: 'RUN_PROCESS', values: { processName: 'notVisible' } },
      { itemType: 'BUILT_IN', values: { option: 'THIS_TABLE_PROCESS_LIST' } },
      { itemType: 'DIVIDER' },
      { itemType: 'DOWNLOAD_FILE', values: { fieldName: 'report' } },
      { itemType: 'DOWNLOAD_FILE', values: { fieldName: 'manual' }, label: 'Get Manual' },
      { itemType: 'DOWNLOAD_FILE', values: { fieldName: 'noSuchField' } },
      { itemType: 'SUB_MENU', label: 'More', values: { items: [{ itemType: 'BUILT_IN', values: { option: 'DEVELOPER_MODE' } }, { itemType: 'BUILT_IN', values: { option: 'AUDIT' } }] } },
      { itemType: 'SUB_MENU', label: 'Empty', values: { items: [{ itemType: 'BUILT_IN', values: { option: 'AUDIT' } }] } },
      { itemType: 'DIVIDER' },
    ]
    const entries = resolveRecordMenu(items, context({ allProcesses: { zeta: process('zeta', 'Zeta Recount') } }))
    expect(outline(entries)).toEqual([
      'New', 'Change It', '---', 'Zeta Recount', 'Alpha Review', '---', 'Report File', 'Get Manual (disabled)',
      { 'More >': ['Developer Mode', 'Audit'] }, { 'Empty >': ['Audit'] },
    ])
    const report = entries.find((entry) => entry.kind === 'item' && entry.label === 'Report File')
    expect(report).toMatchObject({ action: { type: 'downloadFile', fieldName: 'report' }, disabled: false, id: 'download-report' })
    expect(entries.find((entry) => entry.kind === 'item' && entry.label === 'Zeta Recount')).toMatchObject({ action: { type: 'runProcess' }, id: 'zeta' })
  })

  it('omits a sub-menu with nothing the user may choose, and a process the user may not run', () => {
    const items: QTableMenuItem[] = [
      { itemType: 'SUB_MENU', label: 'Audit Only', values: { items: [{ itemType: 'BUILT_IN', values: { option: 'AUDIT' } }] } },
      { itemType: 'RUN_PROCESS', values: { processName: 'locked' } },
    ]
    const entries = resolveRecordMenu(items, context({ canAudit: false, allProcesses: { locked: process('locked', 'Locked', 'lab', { hasPermission: false }) } }))
    expect(entries).toEqual([])
    expect(hasMenuItems(entries)).toBe(false)
  })

  it('tidies dividers at either end and in runs', () => {
    const d = (key: string): RecordMenuEntry => ({ kind: 'divider', key })
    const i = (key: string): RecordMenuEntry => ({ kind: 'item', key, label: key, action: { type: 'edit' }, id: key })
    expect(tidyDividers([d('a'), i('b'), d('c'), d('d'), i('e'), d('f')]).map((entry) => entry.key)).toEqual(['b', 'c', 'e'])
  })
})
