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
