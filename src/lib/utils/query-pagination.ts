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

/** @file Strict metadata for authorization-filtered native query pages. */
import type { QTableMetaData } from '@/types'

/**
 * Server-owned opt-in; truthy strings do not opt in.
 * @param table - Current native table metadata, absent while loading.
 * @returns Whether page completeness is unknown after authorization filtering.
 */
export function authorizationFilteredPagination(table: QTableMetaData | undefined): boolean {
  const value = table?.supplementalMetaData?.queryPagination
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const policy = value as Record<string, unknown>
  return policy.authorizationFiltered === true
}

/**
 * Navigation uses only readable, visible tables already returned in current metadata.
 * @param tables - Current authorized metadata response.
 * @returns Source tables offering their ordinary record picker and Files tab.
 */
export function paginationSourceTables(tables: Record<string, QTableMetaData>): QTableMetaData[] {
  return Object.values(tables).filter((table) => {
    if (table.readPermission !== true || table.isHidden || typeof table.name !== 'string' || !/^[A-Za-z][A-Za-z0-9_]{0,127}$/.test(table.name)) return false
    const policy = table.supplementalMetaData?.queryPagination
    return !!policy && typeof policy === 'object' && !Array.isArray(policy) && (policy as Record<string, unknown>).sourceBrowser === true
  })
}
