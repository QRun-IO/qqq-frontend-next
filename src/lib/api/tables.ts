// Table data API functions

import { isAxiosError } from 'axios'

import type { QRecord, QQueryFilter, QueryJoin, QAuditRecord } from '@/types'
import apiClient from './client'

export interface QueryRecordsRequest {
  filter: Partial<QQueryFilter>
  joins?: QueryJoin[]
  tableVariant?: string
}

export interface QueryRecordsResponse {
  records: QRecord[]
}

export interface CountRecordsResponse {
  count: number
  distinctCount?: number
}

export interface DeleteRecordResponse {
  deletedCount: number
}

export async function queryRecords(
  tableName: string,
  request: QueryRecordsRequest
): Promise<QueryRecordsResponse> {
  return apiClient.post<QueryRecordsResponse>(
    `/table/${encodeURIComponent(tableName)}/query`,
    request
  )
}

export async function countRecords(
  tableName: string,
  request: QueryRecordsRequest,
  includeDistinct = false
): Promise<CountRecordsResponse> {
  return apiClient.post<CountRecordsResponse>(
    `/table/${encodeURIComponent(tableName)}/count`,
    request,
    { params: { includeDistinct } }
  )
}

export async function getRecord(
  tableName: string,
  primaryKey: string | number,
  options?: {
    tableVariant?: string
    includeAssociations?: boolean
    queryJoins?: string
  }
): Promise<QRecord> {
  return apiClient.get<QRecord>(`/table/${encodeURIComponent(tableName)}/${primaryKey}`, {
    params: options,
  })
}

export async function insertRecord(
  tableName: string,
  values: Record<string, unknown>
): Promise<QRecord> {
  const formData = new FormData()
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined) continue
    if (value instanceof File) {
      formData.append(key, value)
    } else if (Array.isArray(value)) {
      formData.append(key, JSON.stringify(value))
    } else {
      formData.append(key, String(value))
    }
  }
  return apiClient.post<QRecord>(`/table/${encodeURIComponent(tableName)}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export async function updateRecord(
  tableName: string,
  primaryKey: string | number,
  values: Record<string, unknown>
): Promise<QRecord> {
  const formData = new FormData()
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined) continue
    if (value instanceof File) {
      formData.append(key, value)
    } else if (Array.isArray(value)) {
      formData.append(key, JSON.stringify(value))
    } else {
      formData.append(key, String(value))
    }
  }
  return apiClient.put<QRecord>(
    `/table/${encodeURIComponent(tableName)}/${primaryKey}`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
}

export async function deleteRecord(
  tableName: string,
  primaryKey: string | number
): Promise<DeleteRecordResponse> {
  return apiClient.delete<DeleteRecordResponse>(
    `/table/${encodeURIComponent(tableName)}/${primaryKey}`
  )
}

export interface GlobalSearchResult {
  tableName: string
  tableLabel: string
  recordId: string
  recordLabel: string
}

/**
 * Global search across tables. Posts to /search endpoint.
 * Falls back to empty results if the endpoint returns 404.
 */
export async function globalSearch(
  searchTerm: string,
  tableNames: string[] = []
): Promise<GlobalSearchResult[]> {
  try {
    return await apiClient.post<GlobalSearchResult[]>('/search', {
      searchTerm,
      tableNames,
    })
  } catch (err) {
    // Only swallow 404 — the search endpoint is optional
    if (isAxiosError(err) && err.response?.status === 404) return []
    throw err
  }
}

export interface AuditRecordsResponse {
  records: QAuditRecord[]
}

export async function getAuditRecords(
  tableName: string,
  primaryKey: string | number
): Promise<QAuditRecord[]> {
  const response = await apiClient.get<AuditRecordsResponse>(
    `/table/${encodeURIComponent(tableName)}/${primaryKey}/audits`
  )
  return response.records
}
