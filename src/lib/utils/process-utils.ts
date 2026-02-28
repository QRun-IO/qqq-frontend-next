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

// Utility functions for filtering and categorizing processes

import type { QInstance, QProcessMetaData } from '@/types'

/**
 * Returns all visible, permitted processes that belong to a given table.
 */
export function getProcessesForTable(
  metaData: QInstance,
  tableName: string
): QProcessMetaData[] {
  return Object.values(metaData.processes ?? {}).filter(
    (p) => p.tableName === tableName && !p.isHidden && p.hasPermission !== false
  )
}

/**
 * Returns processes that can run against a single record (maxInputRecords >= 1).
 */
export function getSingleRecordProcesses(
  processes: QProcessMetaData[]
): QProcessMetaData[] {
  return processes.filter(
    (p) => (p.maxInputRecords ?? Infinity) >= 1
  )
}

/**
 * Returns processes that can run against multiple records (maxInputRecords > 1 or unlimited).
 */
export function getBulkProcesses(
  processes: QProcessMetaData[]
): QProcessMetaData[] {
  return processes.filter(
    (p) => (p.maxInputRecords ?? Infinity) > 1 || p.maxInputRecords === 0
  )
}
