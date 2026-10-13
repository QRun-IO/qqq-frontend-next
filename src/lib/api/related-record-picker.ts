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
 * @file Typed client for the related-record picker routes of the QQQ UI API
 * (`POST /qqq/v1/table/{tableName}/relatedRecordPicker/{pickerName}/query|prepare|add|remove`).
 * The server applies the picker's filter, the user's permissions and record locks, and sets the
 * parent and target keys of new rows; the client only sends what the user chose.
 */

import type { QQueryFilter, QRecord } from '@/types'
import apiClient from './client'

/** Body of the picker's query route. */
export interface RelatedPickerQueryRequest {
  /** The parent record (MULTI_CHILD, LINK; SINGLE on an edit form). */
  primaryKey?: string | number
  /** Current form values (SINGLE on a create form), for the picker's `${input.x}` variables. */
  values?: Record<string, unknown>
  /** Contains-search over the target's search fields. */
  searchTerm?: string
  /** The user's filter on the target table (and its order). */
  filter?: Partial<QQueryFilter>
  /** Offset paging. */
  skip?: number
  /** Records per page (1 to 200). */
  limit?: number
}

/** Response of the picker's query route. */
export interface RelatedPickerQueryResponse {
  /** One page of target records. */
  records: QRecord[]
  /** More records follow. */
  hasMore: boolean
  /** Ids (as strings) of returned records the parent already has rows for. */
  linkedIds?: string[]
  /** The picker's default filter, resolved (first page only). */
  resolvedDefaultFilter?: Partial<QQueryFilter>
}

/** Response of the picker's prepare route. */
export interface RelatedPickerPrepareResponse {
  /** One unsaved child row per picked target. */
  records: QRecord[]
  /** Child fields to review per row (empty: add without review). */
  reviewFieldNames: string[]
}

/** Response of the picker's add route. */
export interface RelatedPickerAddResponse {
  /** The inserted rows. */
  records: QRecord[]
  /** Warnings from the inserts. */
  warnings?: string[]
}

const path = (tableName: string, pickerName: string, operation: string) =>
  `/table/${encodeURIComponent(tableName)}/relatedRecordPicker/${encodeURIComponent(pickerName)}/${operation}`

/**
 * One page of the records a picker offers.
 *
 * @param tableName - The table that declares the picker.
 * @param pickerName - The picker.
 * @param request - Parent, search, filter and paging.
 * @returns The page, whether more follow, and the already-linked ids.
 */
export async function queryRelatedPicker(tableName: string, pickerName: string, request: RelatedPickerQueryRequest): Promise<RelatedPickerQueryResponse> {
  const response = await apiClient.post<Partial<RelatedPickerQueryResponse>>(path(tableName, pickerName, 'query'), request)
  return { records: response?.records ?? [], hasMore: response?.hasMore === true, linkedIds: response?.linkedIds, resolvedDefaultFilter: response?.resolvedDefaultFilter }
}

/**
 * Unsaved child rows for picked targets, for the review step.
 *
 * @param tableName - The table that declares the picker.
 * @param pickerName - The picker.
 * @param primaryKey - The parent record.
 * @param targetIds - The picked targets.
 * @returns The rows and the fields to review.
 */
export async function prepareRelatedPicker(tableName: string, pickerName: string, primaryKey: string | number, targetIds: Array<string | number>): Promise<RelatedPickerPrepareResponse> {
  const response = await apiClient.post<Partial<RelatedPickerPrepareResponse>>(path(tableName, pickerName, 'prepare'), { primaryKey, targetIds })
  return { records: response?.records ?? [], reviewFieldNames: response?.reviewFieldNames ?? [] }
}

/**
 * Add child or join rows, all or nothing: by target ids, or as reviewed rows.
 *
 * @param tableName - The table that declares the picker.
 * @param pickerName - The picker.
 * @param primaryKey - The parent record.
 * @param rows - Target ids, or reviewed rows' values.
 * @returns The inserted rows.
 */
export async function addRelatedPicker(tableName: string, pickerName: string, primaryKey: string | number, rows: { targetIds: Array<string | number> } | { records: Array<Record<string, unknown>> }): Promise<RelatedPickerAddResponse> {
  const body = 'targetIds' in rows ? { primaryKey, targetIds: rows.targetIds } : { primaryKey, records: rows.records.map((values) => ({ values })) }
  const response = await apiClient.post<Partial<RelatedPickerAddResponse>>(path(tableName, pickerName, 'add'), body)
  return { records: response?.records ?? [], warnings: response?.warnings }
}

/**
 * Unlink targets (LINK pickers).
 *
 * @param tableName - The table that declares the picker.
 * @param pickerName - The picker.
 * @param primaryKey - The parent record.
 * @param targetIds - The targets to unlink.
 * @returns How many links were removed.
 */
export async function removeRelatedPicker(tableName: string, pickerName: string, primaryKey: string | number, targetIds: Array<string | number>): Promise<number> {
  const response = await apiClient.post<{ deletedCount?: number }>(path(tableName, pickerName, 'remove'), { primaryKey, targetIds })
  return response?.deletedCount ?? 0
}
