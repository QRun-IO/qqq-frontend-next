/**
 * RecordViewAssociated — list of many-to-many related-record panels.
 *
 * Renders one {@link AssociatedRecords} card per many-join in the "list" view
 * mode of the record detail page.  The same join data is shown in the "Related"
 * tab when the view mode is "tabs" (handled by {@link RecordViewTabs}).
 */
'use client'

import React from 'react'
import type { QTableMetaData, QRecord } from '@/types'

import { AssociatedRecords } from './AssociatedRecords'

/**
 * Props for the {@link RecordViewAssociated} component.
 */
interface RecordViewAssociatedProps {
  /** Table metadata for the parent record (forwarded to AssociatedRecords). */
  tableMetaData: QTableMetaData
  /** The parent record — used to extract associated record arrays. */
  record: QRecord
  /** Many-to-many join definitions; one card is rendered per join. */
  manyJoins: QTableMetaData['exposedJoins']
  /** Primary key value of the parent record. */
  parentPk: string | number
  /** Full table metadata map forwarded to AssociatedRecords for field lookups. */
  allTables?: Record<string, QTableMetaData>
  /** Navigation context used to build back-reference links in child components. */
  navigateFrom: { path: string; label: string }
  /** Callback invoked after a new associated record is created (triggers parent refetch). */
  onRefetch?: () => void
}

/**
 * Renders a stacked list of many-to-many related-record grids in list view mode.
 *
 * Each {@link AssociatedRecords} panel is wrapped in a card with a border and
 * shadow matching the style of the section cards in the same view.
 *
 * @param props - See {@link RecordViewAssociatedProps}.
 */
export function RecordViewAssociated({
  tableMetaData,
  record,
  manyJoins,
  parentPk,
  allTables,
  navigateFrom,
  onRefetch,
}: RecordViewAssociatedProps) {
  return (
    <>
      {manyJoins.map((join) => {
        const assocRecords = record.associatedRecords?.[join.joinTable!.name] ?? []
        return (
          <div key={join.label} className="rounded-xl border border-border bg-card px-6 py-4 shadow-sm">
            <AssociatedRecords
              join={join}
              records={assocRecords}
              parentTableMetaData={tableMetaData}
              parentPrimaryKey={parentPk}
              allTables={allTables}
              navigateFrom={navigateFrom}
              onRecordCreated={onRefetch}
            />
          </div>
        )
      })}
    </>
  )
}
