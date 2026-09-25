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

/**
 * Loads the audit history of one record, newest first.
 *
 * @param source - How to read audits (see {@link auditSource}).
 * @param tableName - The audited table.
 * @param primaryKey - The record's primary key.
 * @returns Audit entries, each with its field-level details.
 */
export async function getAuditRecords(source: Exclude<AuditSource, null>, tableName: string, primaryKey: string | number): Promise<QAuditRecord[]> {
  if (source === 'process') {
    const formData = new FormData()
    formData.append('values', JSON.stringify({ tableName, recordId: String(primaryKey), isSortAscending: false, limit: AUDIT_LIMIT }))
    const response = await apiClient.post<ProcessCompleteResponse>(`/processes/${AUDIT_PROCESS_NAME}/init`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    if (response?.type === 'ERROR' || (response?.type !== 'COMPLETE' && !response?.values)) {
      throw new Error(response?.userFacingError || response?.error || 'Error loading audits')
    }
    const audits = response.values?.audits
    if (!Array.isArray(audits)) throw new Error('Invalid audit response')
    return groupAuditRows(audits as QRecord[])
  }

  const response = await apiClient.post<{ records?: QRecord[] }>(`/table/${AUDIT_TABLE_NAME}/query`, {
    filter: {
      criteria: [
        { fieldName: 'auditTable.name', operator: 'EQUALS', values: [tableName] },
        { fieldName: 'recordId', operator: 'EQUALS', values: [String(primaryKey)] },
      ],
      orderBys: [
        { fieldName: 'timestamp', isAscending: false },
        { fieldName: 'id', isAscending: false },
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
  return groupAuditRows(response.records)
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
