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
 * @file RecordQueryBulkBar — connects the query screen's selection to the BulkActionBar,
 * offering Bulk Edit and Bulk Delete shortcuts when the table allows them.
 */

'use client'

import type { QTableMetaData, QProcessMetaData } from '@/types'
import type { SelectionMode } from '@/lib/hooks/use-record-query'
import { BulkActionBar, type BulkAction } from './BulkActionBar'
import { buildActionEntries } from './ProcessLauncherMenu'
import { selectionBannerText } from './SelectionMenu'

/**
 * Props for RecordQueryBulkBar.
 */
export interface RecordQueryBulkBarProps {
  tableMetaData: QTableMetaData
  allProcesses: Record<string, QProcessMetaData>
  selectionMode: SelectionMode
  selectionCount: number
  pageRowCount: number
  allPageRowsSelected: boolean
  distinct: boolean
  onClearSelection: () => void
  onLaunch: (process: QProcessMetaData) => void
}

/**
 * Selection banner plus Bulk Edit / Bulk Delete shortcuts.
 *
 * @param props - Component properties.
 * @returns The bar (null when nothing is selected).
 */
export function RecordQueryBulkBar({ tableMetaData, allProcesses, selectionMode, selectionCount, pageRowCount, allPageRowsSelected, distinct, onClearSelection, onLaunch }: RecordQueryBulkBarProps) {
  const { bulk } = buildActionEntries({ tableMetaData, allProcesses, processes: [], selectionCount })
  const actions: BulkAction[] = bulk
    .filter((entry) => entry.key === 'bulkEdit' || entry.key === 'bulkDelete')
    .map((entry) => ({
      key: entry.key,
      label: entry.label,
      dataId: entry.key === 'bulkDelete' ? 'bulk-delete' : 'bulk-edit',
      destructive: entry.key === 'bulkDelete',
      onClick: () => onLaunch(entry.process),
    }))
  return (
    <BulkActionBar
      selectionCount={selectionCount}
      selectionText={selectionBannerText(selectionMode, selectionCount, pageRowCount, allPageRowsSelected, distinct)}
      onClearSelection={onClearSelection}
      actions={actions}
    />
  )
}
