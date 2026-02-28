/**
 * RecordViewTabs — pill-style tab bar and all tab-panel content for the tabs view mode.
 *
 * Renders the "tabs" view mode of the record detail page: the pill tab strip and
 * each tab panel (Overview, individual T2/T3 section panels, and the Related panel
 * for many-to-many joins).
 */
'use client'

import React from 'react'
import type { QTableMetaData, QRecord, QWidgetMetaData } from '@/types'
import { cn } from '@/lib/utils/cn'

import { RecordViewSection } from './RecordViewSection'
import { AssociatedRecords } from './AssociatedRecords'

/**
 * A single tab descriptor used in the tab strip.
 */
interface TabDef {
  /** Stable, unique identifier for this tab (used in URL param and aria). */
  id: string
  /** Human-readable label rendered inside the tab button. */
  label: string
}

/**
 * Props for the {@link RecordViewTabs} component.
 */
interface RecordViewTabsProps {
  /** Table metadata used by child section and associated-record components. */
  tableMetaData: QTableMetaData
  /** The record being displayed. */
  record: QRecord
  /** Ordered list of tab descriptors used to build the tab strip. */
  tabs: TabDef[]
  /** The id of the currently active tab. */
  activeTab: string
  /** Callback invoked when the user clicks a tab. */
  setActiveTab: (tabId: string) => void
  /** T2 sections rendered in the Overview panel and as individual section tabs. */
  secondarySections: QTableMetaData['sections']
  /** T3 content sections rendered as individual section tabs. */
  tertiarySections: QTableMetaData['sections']
  /** Many-to-many join definitions rendered in the Related tab. */
  manyJoins: QTableMetaData['exposedJoins']
  /** Widget metadata map forwarded to RecordViewSection for widget-backed sections. */
  widgetMetaDataMap?: Record<string, QWidgetMetaData>
  /** Full table metadata map forwarded for possibleValueSource link rendering. */
  allTables?: Record<string, QTableMetaData>
  /** Navigation context used to build outgoing record links with a back reference. */
  navigateFrom: { path: string; label: string }
  /** Primary key value of the parent record (forwarded to AssociatedRecords). */
  parentPk: string | number
  /** Callback invoked after a new associated record is created (triggers parent refetch). */
  onRefetch?: () => void
}

/**
 * Renders the tab bar and all tab-panel content for the "tabs" view mode.
 *
 * This component is only mounted when {@link RecordViewContent} is in tabs mode
 * and there is at least one tab defined.  Each tab maps to a panel:
 * - `overview` — a 2-column card grid of all T2 sections
 * - `section-{name}` — a focused single-section panel for each T2 or T3 section
 * - `related` — a stacked list of many-to-many AssociatedRecords panels
 *
 * @param props - See {@link RecordViewTabsProps}.
 */
export function RecordViewTabs({
  tableMetaData,
  record,
  tabs,
  activeTab,
  setActiveTab,
  secondarySections,
  tertiarySections,
  manyJoins,
  widgetMetaDataMap,
  allTables,
  navigateFrom,
  parentPk,
  onRefetch,
}: RecordViewTabsProps) {
  return (
    <>
      {/* Tab bar — pill-style */}
      <div
        className="flex rounded-xl border border-border bg-muted/50 p-1"
        role="tablist"
        data-qqq-id="record-view-tabs"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            data-qqq-id={`record-tab-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content: Overview — all T2 sections in 2-column card grid */}
      {activeTab === 'overview' && (
        <div
          className="grid grid-cols-1 gap-6 lg:grid-cols-2"
          role="tabpanel"
          data-qqq-id="record-tab-panel-overview"
        >
          {secondarySections.map((section) => (
            <div
              key={section.name}
              className={cn(
                'rounded-xl border border-border bg-card p-6 shadow-sm',
                (section.gridColumns ?? 0) >= 3 ? 'lg:col-span-2' : undefined
              )}
            >
              <RecordViewSection
                section={section}
                tableMetaData={tableMetaData}
                record={record}
                widgetMetaDataMap={widgetMetaDataMap}
                allTables={allTables}
                navigateFrom={navigateFrom}
                stacked
              />
            </div>
          ))}
        </div>
      )}

      {/* Tab content: Individual T2 section tabs */}
      {secondarySections.map((section) => (
        activeTab === `section-${section.name}` && (
          <div
            key={section.name}
            role="tabpanel"
            data-qqq-id={`record-tab-panel-${section.name}`}
          >
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <RecordViewSection
                section={section}
                tableMetaData={tableMetaData}
                record={record}
                widgetMetaDataMap={widgetMetaDataMap}
                allTables={allTables}
                navigateFrom={navigateFrom}
              />
            </div>
          </div>
        )
      ))}

      {/* Tab content: Individual T3 section tabs (supplementary: notes, audit, etc.) */}
      {tertiarySections.map((section) => (
        activeTab === `section-${section.name}` && (
          <div
            key={section.name}
            role="tabpanel"
            data-qqq-id={`record-tab-panel-${section.name}`}
          >
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <RecordViewSection
                section={section}
                tableMetaData={tableMetaData}
                record={record}
                widgetMetaDataMap={widgetMetaDataMap}
                allTables={allTables}
                navigateFrom={navigateFrom}
              />
            </div>
          </div>
        )
      ))}

      {/* Tab content: Related (many-to-many / one-to-many) */}
      {activeTab === 'related' && (
        <div className="space-y-6" role="tabpanel" data-qqq-id="record-tab-panel-related">
          {manyJoins.map((join) => {
            const assocRecords = record.associatedRecords?.[join.joinTable!.name] ?? []
            return (
              <div key={join.label} className="rounded-xl border border-border bg-card p-6 shadow-sm">
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
        </div>
      )}
    </>
  )
}
