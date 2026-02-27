/** Metadata API — Endpoints that return QQQ instance, table, and process metadata. */

import type { QInstance, QTableMetaData, QProcessMetaData } from '@/types'
import apiClient from './client'

/**
 * Fetches the top-level QQQ instance metadata from `GET /metaData`.
 *
 * The response describes the full application structure: registered apps, tables,
 * processes, and navigation. The `frontendName` and `frontendVersion` query params
 * are forwarded so the server can tailor the response to this frontend's capabilities.
 *
 * @returns The `QInstance` object containing all top-level application metadata.
 */
export async function loadMetaData(): Promise<QInstance> {
  return apiClient.get<QInstance>('/metaData', {
    params: {
      frontendName: 'qqq-frontend-next',
      frontendVersion: process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0',
    },
  })
}

/**
 * Fetches metadata for a single table from `GET /metaData/table/{tableName}`.
 *
 * The returned object describes every field, section, capability, and association
 * that the table exposes. Used to drive dynamic rendering of record query, view,
 * and edit pages.
 *
 * @param tableName - The backend-registered name of the table (e.g. `"person"`).
 * @returns Table metadata including fields, sections, capabilities, and associations.
 */
export async function loadTableMetaData(tableName: string): Promise<QTableMetaData> {
  return apiClient.get<QTableMetaData>(`/metaData/table/${encodeURIComponent(tableName)}`)
}

/**
 * Fetches metadata for a single process from `GET /metaData/process/{processName}`.
 *
 * The returned object describes each step, its input/output fields, and the
 * overall process configuration. Used to drive the step-wizard UI.
 *
 * @param processName - The backend-registered name of the process (e.g. `"bulkInsert"`).
 * @returns Process metadata including steps and their field definitions.
 */
export async function loadProcessMetaData(processName: string): Promise<QProcessMetaData> {
  return apiClient.get<QProcessMetaData>(`/metaData/process/${encodeURIComponent(processName)}`)
}
