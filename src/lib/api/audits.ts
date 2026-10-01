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

import type { QAuditRecord, QInstance, QRecord } from '@/types'
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
 */
export function auditSource(metaData: QInstance | undefined): AuditSource {
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
 */
export async function getAuditRecords(source: Exclude<AuditSource, null>, tableName: string, primaryKey: string | number, isSortAscending = false): Promise<AuditHistory> {
  if (source === 'process') {
    const formData = new FormData()
    formData.append('values', JSON.stringify({ tableName, recordId: String(primaryKey), isSortAscending, limit: AUDIT_LIMIT }))
    const response = await apiClient.post<ProcessCompleteResponse>(`/processes/${AUDIT_PROCESS_NAME}/init`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    if (response?.type === 'ERROR' || (response?.type !== 'COMPLETE' && !response?.values)) {
      throw new Error(response?.userFacingError || response?.error || 'Error loading audits')
    }
    const audits = response.values?.audits
    if (!Array.isArray(audits)) throw new Error('Invalid audit response')
    const total = response.values?.distinctCount
    return { records: groupAuditRows(audits as QRecord[]), total: typeof total === 'number' ? total : null }
  }

  const criteria = [
    { fieldName: 'auditTable.name', operator: 'EQUALS' as const, values: [tableName] },
    { fieldName: 'recordId', operator: 'EQUALS' as const, values: [String(primaryKey)] },
  ]
  const response = await apiClient.post<{ records?: QRecord[] }>(`/table/${AUDIT_TABLE_NAME}/query`, {
    filter: {
      criteria,
      orderBys: [
        { fieldName: 'timestamp', isAscending: isSortAscending },
        { fieldName: 'id', isAscending: isSortAscending },
        { fieldName: 'auditDetail.id', isAscending: true },
      ],
      limit: AUDIT_LIMIT,
    },
    joins: [
      { joinTable: 'auditTable', select: false, type: 'INNER' },
      { joinTable: 'auditDetail', select: true, type: 'LEFT' },
    ],
  })
  if (!Array.isArray(response?.records)) throw new Error('Invalid audit response')
  let total: number | null = null
  if (response.records.length === AUDIT_LIMIT) {
    const count = await countRecords(AUDIT_TABLE_NAME, { filter: { criteria } }, true)
    total = count.distinctCount ?? count.count
  }
  return { records: groupAuditRows(response.records), total }
}

/**
 * Groups audit rows (one per detail, from the `auditDetail` join) into entries.
 *
 * @param rows - `audit` records with `auditDetail.*` join values.
 * @returns One entry per audit, in the rows' order, with details in their order.
 */
export function groupAuditRows(rows: QRecord[]): QAuditRecord[] {
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
    const detailId = values['auditDetail.id']
    if (detailId !== null && detailId !== undefined) {
      entry.fieldChanges.push({
        fieldName: String(values['auditDetail.fieldName'] ?? ''),
        oldValue: values['auditDetail.oldValue'] ?? null,
        newValue: values['auditDetail.newValue'] ?? null,
        message: typeof values['auditDetail.message'] === 'string' ? values['auditDetail.message'] as string : undefined,
      })
    }
  }
  return [...entries.values()]
}
