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
 * @file audits — reads a record's audit history the way the QQQ dashboards do:
 * through the standard `GetAuditsForRecord` process when the user may run it,
 * otherwise by querying the standard `audit` table joined to `auditDetail`.
 */

import { getErrorMessage } from '@/lib/utils/error-utils'

import type { QAuditRecord, QInstance, QRecord, TableCapabilitiesV1 } from '@/types'
import { countRecords } from './tables'
import apiClient from './client'

/** Name of the backend's standard audit-reading process (`GetAuditsForRecordProcess`). */
export const AUDIT_PROCESS_NAME = 'GetAuditsForRecord'
/** Name of the backend's standard audit table (`AuditsMetaDataProvider`). */
export const AUDIT_TABLE_NAME = 'audit'
/** Most audit rows read for one record, as in the Material dashboard. */
export const AUDIT_LIMIT = 1000

/** How a record's audits can be read by the current user, if at all. */
export type AuditSource = 'process' | 'table' | null

/**
 * Chooses how the current user can read audits.
 *
 * @param metaData - Instance metadata.
 * @returns `process`, `table`, or `null` when the instance has no audits the user can read.
 * @param capabilities - Per-user table capabilities; absent for pre-1.6 servers.
 */
export function auditSource(metaData: QInstance | undefined, capabilities?: TableCapabilitiesV1): AuditSource {
  if (capabilities !== undefined) {
    const audits = capabilities.audits
    return !audits?.available ? null : audits.processName ? 'process' : audits.tableName ? 'table' : null
  }
  const process = metaData?.processes?.[AUDIT_PROCESS_NAME]
  if (process && process.hasPermission !== false) return 'process'
  const table = metaData?.tables?.[AUDIT_TABLE_NAME]
  if (table && table.readPermission !== false) return 'table'
  return null
}

/** Response of a completed v1 process step. */
interface ProcessCompleteResponse {
  type?: string
  values?: Record<string, unknown>
  error?: string
  userFacingError?: string
}

/** Audit entries plus the optional count when the 1,000-detail cap was reached. */
export interface AuditHistory {
  records: QAuditRecord[]
  total: number | null
}

/**
 * Loads the audit history of one record in the requested order.
 *
 * @param source - How to read audits (see {@link auditSource}).
 * @param tableName - The audited table.
 * @param primaryKey - The record's primary key.
 * @param isSortAscending - True for oldest first.
 * @returns Audit entries and the total when the backend supplies one.
 * @param capabilities - Per-user table capabilities; absent for pre-1.6 servers.
 */
export async function getAuditRecords(source: Exclude<AuditSource, null>, tableName: string, primaryKey: string | number, isSortAscending = false, capabilities?: TableCapabilitiesV1): Promise<AuditHistory> {
  const declared = capabilities?.audits
  if (capabilities !== undefined && !declared?.available) throw new Error('Audits are unavailable.')
  const processName = capabilities === undefined ? AUDIT_PROCESS_NAME : declared?.processName
  const auditTableName = capabilities === undefined ? AUDIT_TABLE_NAME : declared?.tableName
  const detailTableName = capabilities === undefined ? 'auditDetail' : declared?.detailTableName
  if (source === 'process') {
    if (!processName) throw new Error('Audit process is unavailable.')
    const formData = new FormData()
    formData.append('values', JSON.stringify({ tableName, recordId: String(primaryKey), isSortAscending, limit: AUDIT_LIMIT }))
    const response = await apiClient.post<ProcessCompleteResponse>(`/processes/${encodeURIComponent(processName)}/init`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    if (response?.type === 'ERROR' || (response?.type !== 'COMPLETE' && !response?.values)) {
      throw new Error(getErrorMessage(response, 'Error loading audits'))
    }
    const audits = response.values?.audits
    if (!Array.isArray(audits)) throw new Error('Invalid audit response')
    const total = response.values?.distinctCount
    return { records: groupAuditRows(audits as QRecord[]), total: typeof total === 'number' ? total : null }
  }

  if (!auditTableName) throw new Error('Audit table is unavailable.')
  const criteria = [
    { fieldName: 'auditTable.name', operator: 'EQUALS' as const, values: [tableName] },
    { fieldName: 'recordId', operator: 'EQUALS' as const, values: [String(primaryKey)] },
  ]
  const response = await apiClient.post<{ records?: QRecord[] }>(`/table/${encodeURIComponent(auditTableName)}/query`, {
    filter: {
      criteria,
      orderBys: [
        { fieldName: 'timestamp', isAscending: isSortAscending },
        { fieldName: 'id', isAscending: isSortAscending },
        ...(detailTableName ? [{ fieldName: `${detailTableName}.id`, isAscending: true }] : []),
      ],
      limit: AUDIT_LIMIT,
    },
    joins: [
      { joinTable: 'auditTable', select: false, type: 'INNER' },
      ...(detailTableName ? [{ joinTable: detailTableName, select: true, type: 'LEFT' }] : []),
    ],
  })
  if (!Array.isArray(response?.records)) throw new Error('Invalid audit response')
  let total: number | null = null
  if (response.records.length === AUDIT_LIMIT) {
    const count = await countRecords(auditTableName, { filter: { criteria } }, true)
    total = count.distinctCount ?? count.count
  }
  return { records: groupAuditRows(response.records, detailTableName), total }
}

/**
 * Groups audit rows (one per detail, from the `auditDetail` join) into entries.
 *
 * @param rows - `audit` records with `auditDetail.*` join values.
 * @returns One entry per audit, in the rows' order, with details in their order.
 * @param detailTableName - Declared detail join name.
 */
export function groupAuditRows(rows: QRecord[], detailTableName = 'auditDetail'): QAuditRecord[] {
  const entries = new Map<string, QAuditRecord>()
  for (const row of rows) {
    const values = row.values ?? {}
    const display = row.displayValues ?? {}
    const id = String(values.id)
    let entry = entries.get(id)
    if (!entry) {
      const message = typeof values.message === 'string' ? values.message : ''
      entry = {
        id: Number(values.id),
        auditTableName: String(display.auditTableId ?? values.auditTableId ?? ''),
        recordId: values.recordId as string | number,
        timestamp: String(values.timestamp ?? ''),
        user: String(display.auditUserId ?? values.auditUserId ?? ''),
        action: /\bInserted\b/.test(message) ? 'INSERT' : /\bDeleted\b/.test(message) ? 'DELETE' : 'UPDATE',
        message,
        fieldChanges: [],
      }
      entries.set(id, entry)
    }
    const detailId = values[`${detailTableName}.id`]
    if (detailId !== null && detailId !== undefined) {
      entry.fieldChanges.push({
        fieldName: String(values[`${detailTableName}.fieldName`] ?? ''),
        oldValue: values[`${detailTableName}.oldValue`] ?? null,
        newValue: values[`${detailTableName}.newValue`] ?? null,
        message: typeof values[`${detailTableName}.message`] === 'string' ? values[`${detailTableName}.message`] as string : undefined,
      })
    }
  }
  return [...entries.values()]
}
