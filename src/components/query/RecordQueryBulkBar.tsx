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
 * @file RecordQueryBulkBar — bulk action bar wrapper for the RecordQuery page.
 */

'use client'

import type { QTableMetaData, QProcessMetaData, QQueryFilter } from '@/types'

import { BulkActionBar } from './BulkActionBar'

/**
 * Props for the RecordQueryBulkBar component.
 */
export interface RecordQueryBulkBarProps {
  /** Full table metadata from the QQQ backend. */
  tableMetaData: QTableMetaData
  /** Optional list of processes available for bulk execution. */
  processes?: QProcessMetaData[]
  /** IDs of all currently selected rows. */
  selectedRecordIds: (string | number)[]
  /** Total number of records matching the active filter. */
  totalCount: number
  /** Callback to deselect all selected rows. */
  onClearSelection: () => void
  /** Callback to navigate to a process with the selected record IDs as params. */
  handleRunProcess?: (processName: string) => void
  /** The fully assembled effective filter (for bulk process context). */
  effectiveFilter: QQueryFilter
}

/**
 * Thin wrapper around `BulkActionBar` for the RecordQuery page.
 *
 * All state is passed in as props — this component holds no state of its own.
 *
 * @param props - Component properties.
 * @returns The rendered bulk action bar, or null when no rows are selected.
 */
export function RecordQueryBulkBar({
  tableMetaData,
  processes,
  selectedRecordIds,
  totalCount,
  onClearSelection,
  handleRunProcess,
  effectiveFilter,
}: RecordQueryBulkBarProps) {
  return (
    <BulkActionBar
      tableMetaData={tableMetaData}
      selectedCount={selectedRecordIds.length}
      totalCount={totalCount}
      onClearSelection={onClearSelection}
      onRunProcess={processes && processes.length > 0 ? handleRunProcess : undefined}
      processes={processes}
      selectedRecordIds={selectedRecordIds}
      currentFilter={effectiveFilter}
    />
  )
}
