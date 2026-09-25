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
 * @file Permission gating helpers — what the current user may do with an object,
 * combining the backend's per-user permission flags with the table's capabilities.
 *
 * The backend omits objects denied with `DenyBehavior.HIDDEN` from metadata and
 * returns objects denied with `DenyBehavior.DISABLED` with their permission flag
 * false. The backend always enforces; these helpers keep the UI from offering
 * (or requesting) what it would refuse.
 */

import type { Capability, QProcessMetaData, QReportMetaData, QTableMetaData, QWidgetMetaData } from '@/types'

type TableAccess = Pick<QTableMetaData, 'capabilities' | 'readPermission' | 'insertPermission' | 'editPermission' | 'deletePermission'>

/**
 * Whether a table declares a capability.
 *
 * @param table - Table metadata (light or full).
 * @param capability - The capability to check.
 * @returns Whether the table declares the capability.
 */
export function hasCapability(table: Pick<QTableMetaData, 'capabilities'> | undefined, capability: Capability | string): boolean {
  return Boolean(table?.capabilities?.includes(capability as Capability))
}

/**
 * Whether the user may read (query and view) the table's records.
 *
 * @param table - Table metadata.
 * @returns Whether the user may read (query/view) records.
 */
export function canReadRecords(table: TableAccess | undefined): boolean {
  return Boolean(table?.readPermission)
}

/**
 * Whether the user may create records.
 *
 * @param table - Table metadata.
 * @returns Whether the user may create records (permission and TABLE_INSERT).
 */
export function canInsertRecords(table: TableAccess | undefined): boolean {
  return Boolean(table?.insertPermission) && hasCapability(table, 'TABLE_INSERT')
}

/**
 * Whether the user may edit records.
 *
 * @param table - Table metadata.
 * @returns Whether the user may edit records (permission and TABLE_UPDATE).
 */
export function canEditRecords(table: TableAccess | undefined): boolean {
  return Boolean(table?.editPermission) && hasCapability(table, 'TABLE_UPDATE')
}

/**
 * Whether the user may delete records.
 *
 * @param table - Table metadata.
 * @returns Whether the user may delete records (permission and TABLE_DELETE).
 */
export function canDeleteRecords(table: TableAccess | undefined): boolean {
  return Boolean(table?.deletePermission) && hasCapability(table, 'TABLE_DELETE')
}

/**
 * Whether the user may run a process at all.
 *
 * @param process - Process metadata.
 * @returns Whether the user may run the process at all (hidden processes such as
 *   `table.bulkEdit` are still launched from table actions).
 */
export function canAccessProcess(process: Pick<QProcessMetaData, 'hasPermission'> | undefined): boolean {
  return Boolean(process) && process?.hasPermission !== false
}

/**
 * Whether a process is offered in menus and quick actions.
 *
 * @param process - Process metadata.
 * @returns Whether the process is offered in menus and quick actions (visible and permitted).
 */
export function canRunProcess(process: Pick<QProcessMetaData, 'isHidden' | 'hasPermission'> | undefined): boolean {
  return canAccessProcess(process) && !process?.isHidden
}

/**
 * Whether the user may run a report.
 *
 * @param report - Report metadata.
 * @returns Whether the user may run the report.
 */
export function canRunReport(report: Pick<QReportMetaData, 'hasPermission'> | undefined): boolean {
  return Boolean(report) && report?.hasPermission !== false
}

/**
 * Whether the user may load a widget's data.
 *
 * @param widget - Widget metadata.
 * @returns Whether the user may load the widget's data.
 */
export function canViewWidget(widget: Pick<QWidgetMetaData, 'hasPermission'> | undefined): boolean {
  return Boolean(widget) && widget?.hasPermission !== false
}

/**
 * The permission-denied sentence used across pages.
 *
 * @param action - e.g. "view", "create", "edit", "delete", "run".
 * @param label - The object label (from metadata).
 * @param noun - "records" for tables, otherwise the object kind.
 * @returns e.g. "You do not have permission to view Pet records."
 */
export function permissionDeniedMessage(action: string, label: string, noun = 'records'): string {
  return `You do not have permission to ${action} ${label}${noun ? ` ${noun}` : ''}.`
}
