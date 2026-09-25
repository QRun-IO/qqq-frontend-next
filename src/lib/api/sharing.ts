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
 * @file Sharing API — list, add, change and remove shares of a shareable record.
 *
 * Uses the framework's sharing processes (getSharedRecords, insertSharedRecord,
 * editSharedRecord, deleteSharedRecord), which run entirely in their backend step,
 * so one init call completes each operation. The backend enforces that only the
 * record's owner may add, change or remove shares.
 */

import { AxiosError } from 'axios'

import type { QJobResponse } from '@/types'
import { processInit } from './processes'

/** Share scopes offered by the framework. */
export type ShareScope = 'READ_ONLY' | 'READ_WRITE'

/** One existing share of a record. */
export interface RecordShare {
  shareId: number
  scopeId: ShareScope | string
  audienceType: string
  audienceId: string
  audienceLabel: string
}

/** The sharing configuration a shareable table exposes in its metadata. */
export interface ShareableTableMetaData {
  sharedRecordTableName?: string
  assetIdFieldName?: string
  scopeFieldName?: string
  audiencePossibleValueSourceName?: string
  audienceTypesPossibleValueSourceName?: string
  thisTableOwnerIdFieldName?: string
  audienceTypes?: Record<string, { name?: string; fieldName?: string; sourceTableName?: string }>
}

/**
 * Runs one sharing process and returns its output values, raising the
 * backend's message on failure.
 *
 * @param processName - Sharing process name.
 * @param values - Process inputs.
 * @returns The output values.
 */
async function runSharingProcess(processName: string, values: Record<string, unknown>): Promise<Record<string, unknown>> {
  let response: QJobResponse
  try {
    response = await processInit(processName, { values })
  } catch (error) {
    if (error instanceof AxiosError) {
      const body = error.response?.data as { error?: unknown; userFacingError?: unknown } | undefined
      const message = typeof body?.userFacingError === 'string' && body.userFacingError ? body.userFacingError
        : typeof body?.error === 'string' ? body.error : error.message
      throw new Error(message)
    }
    throw error
  }
  const record = response as unknown as Record<string, unknown>
  if (typeof record.error === 'string') {
    throw new Error(typeof record.userFacingError === 'string' && record.userFacingError ? record.userFacingError : record.error)
  }
  return (record.values ?? {}) as Record<string, unknown>
}

/**
 * Lists the shares of a record.
 *
 * @param tableName - Shareable table.
 * @param recordId - Record primary key.
 * @returns The shares, oldest first.
 */
export async function getSharedRecords(tableName: string, recordId: string | number): Promise<RecordShare[]> {
  const values = await runSharingProcess('getSharedRecords', { tableName, recordId })
  const list = Array.isArray(values.resultList) ? values.resultList : []
  return list.flatMap((entry) => {
    const share = (entry as { values?: Record<string, unknown> })?.values
    if (!share) return []
    return [{
      shareId: Number(share.shareId),
      scopeId: String(share.scopeId ?? ''),
      audienceType: String(share.audienceType ?? ''),
      audienceId: String(share.audienceId ?? ''),
      audienceLabel: String(share.audienceLabel ?? share.audienceId ?? ''),
    }]
  })
}

/**
 * Shares a record with an audience.
 *
 * @param tableName - Shareable table.
 * @param recordId - Record primary key.
 * @param audienceType - Audience type name (e.g. `user`).
 * @param audienceId - Audience id within that type.
 * @param scopeId - Share scope.
 */
export async function insertSharedRecord(tableName: string, recordId: string | number, audienceType: string, audienceId: string, scopeId: ShareScope): Promise<void> {
  await runSharingProcess('insertSharedRecord', { tableName, recordId, audienceType, audienceId, scopeId })
}

/**
 * Changes the scope of an existing share.
 *
 * @param tableName - Shareable table.
 * @param recordId - Record primary key.
 * @param shareId - Share id.
 * @param scopeId - New scope.
 */
export async function editSharedRecord(tableName: string, recordId: string | number, shareId: number, scopeId: ShareScope): Promise<void> {
  await runSharingProcess('editSharedRecord', { tableName, recordId, shareId, scopeId })
}

/**
 * Removes a share.
 *
 * @param tableName - Shareable table.
 * @param recordId - Record primary key.
 * @param shareId - Share id.
 */
export async function deleteSharedRecord(tableName: string, recordId: string | number, shareId: number): Promise<void> {
  await runSharingProcess('deleteSharedRecord', { tableName, recordId, shareId })
}

/**
 * Splits an audience option id (`<type>:<id>`, where the id may itself contain
 * colons, e.g. `user:sample:bob`) into its type and id.
 *
 * @param optionId - Audience option id.
 * @returns The audience type and id, or null for an unrecognized value.
 */
export function splitAudienceOption(optionId: string): { audienceType: string; audienceId: string } | null {
  const index = optionId.indexOf(':')
  if (index <= 0 || index === optionId.length - 1) return null
  return { audienceType: optionId.slice(0, index), audienceId: optionId.slice(index + 1) }
}
