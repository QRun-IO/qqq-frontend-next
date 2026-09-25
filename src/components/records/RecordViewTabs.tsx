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
 * @file RecordViewTabs — pill-style tab bar and all tab-panel content for the tabs view mode.
 */

'use client'

import React, { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { QTableMetaData, QRecord, QWidgetMetaData, QAssociation } from '@/types'
import { cn } from '@/lib/utils/cn'

import { RecordViewSection } from './RecordViewSection'
import { RecordViewAssociated } from './RecordViewAssociated'

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
  /** Declared associations without an explicit section binding. */
  associations: QAssociation[]
  renderAssociation: (name: string, label?: string) => React.ReactNode
  /** Widget metadata map forwarded to RecordViewSection for widget-backed sections. */
  widgetMetaDataMap?: Record<string, QWidgetMetaData>
  /** Full table metadata map forwarded for possibleValueSource link rendering. */
  allTables?: Record<string, QTableMetaData>
  /** Navigation context used to build outgoing record links with a back reference. */
  navigateFrom: { path: string; label: string }
}

/**
 * A single collapsible accordion section for the mobile tab layout (MED-18).
 *
 * Manages its own open/closed state with `defaultOpen` controlling the initial
 * state. Used on viewports below the `md` breakpoint where the desktop pill
 * tab bar is hidden; each section becomes an independently toggleable panel.
 *
 * @param props - Component properties.
 * @returns A bordered `<div>` with a `<button>` trigger (chevron rotates 180°
 *   when open) and a conditionally rendered `role="region"` content panel.
 */
function AccordionSection({
  id,
  label,
  defaultOpen = false,
  openOnPhone = false,
  children,
}: {
  id: string
  label: string
  defaultOpen?: boolean
  /** Opens the section on a phone, where the URL's tab names it. */
  openOnPhone?: boolean
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  // On a phone (accordion layout) a deep link (?tab=...) naming this section opens it
  useEffect(() => {
    if (openOnPhone && typeof window !== 'undefined' && window.matchMedia?.('(max-width: 767px)')?.matches) setIsOpen(true)
  }, [openOnPhone])
  const panelId = `accordion-panel-${id}`
  const triggerId = `accordion-trigger-${id}`

  return (
    <div className="border border-border rounded-xl overflow-hidden" data-qqq-id={`accordion-section-${id}`}>
      <button
        id={triggerId}
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((o) => !o)}
        className={cn(
          'flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium',
          'bg-muted/50 hover:bg-muted transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring'
        )}
        data-qqq-id={`accordion-trigger-${id}`}
      >
        <span className="text-foreground">{label}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform duration-200',
            isOpen ? 'rotate-180' : ''
          )}
          aria-hidden="true"
        />
      </button>
      {isOpen && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={triggerId}
          className="bg-card p-5"
          data-qqq-id={panelId}
        >
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * RecordViewTabs — renders the tab bar and all tab-panel content for the "tabs" view mode.
 *
 * This component is only mounted when RecordViewContent is in tabs mode and there is
 * at least one tab defined. On desktop a pill-style tab bar is shown; on mobile the
 * same content is rendered as collapsible accordion sections.
 *
 * @param props - See {@link RecordViewTabsProps}.
 * @returns A React fragment containing two parallel layout trees: a desktop
 *   pill-style tab bar with `role="tablist"` (visible at `md+`) and the
 *   corresponding tab panels; and a stacked set of {@link AccordionSection}
 *   items (visible below `md`). Both trees render the same content so there
 *   is no hydration mismatch between server and client.
 */
export function RecordViewTabs({
  tableMetaData,
  record,
  tabs,
  activeTab,
  setActiveTab,
  secondarySections,
  tertiarySections,
  associations,
  renderAssociation,
  widgetMetaDataMap,
  allTables,
  navigateFrom,
}: RecordViewTabsProps) {
  return (
    <>
      {/* ============================================================
          Desktop layout: pill-style tab bar (hidden below md) — MED-18
      ============================================================ */}
      <div className="hidden md:contents">
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
                  renderAssociation={renderAssociation}
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
                  renderAssociation={renderAssociation}
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
                  renderAssociation={renderAssociation}
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

        {/* Tab content: unbound named associations */}
        {activeTab === 'related' && (
          <div className="space-y-6" role="tabpanel" data-qqq-id="record-tab-panel-related">
            <RecordViewAssociated associations={associations} renderAssociation={renderAssociation} />
          </div>
        )}
      </div>

      {/* ============================================================
          Mobile layout: collapsible accordion sections (shown below md) — MED-18
      ============================================================ */}
      <div className="flex flex-col gap-3 md:hidden" data-qqq-id="record-view-accordion">
        {/* T2 sections as individual accordion items; first open by default */}
        {secondarySections.map((section, idx) => (
          <AccordionSection
            key={section.name}
            id={`section-${section.name}`}
            label={section.label}
            defaultOpen={idx === 0}
            openOnPhone={activeTab === `section-${section.name}`}
          >
            <RecordViewSection
              section={section}
              renderAssociation={renderAssociation}
              tableMetaData={tableMetaData}
              record={record}
              widgetMetaDataMap={widgetMetaDataMap}
              allTables={allTables}
              navigateFrom={navigateFrom}
              stacked
            />
          </AccordionSection>
        ))}

        {/* T3 sections */}
        {tertiarySections.map((section) => (
          <AccordionSection
            key={section.name}
            id={`section-${section.name}`}
            label={section.label}
            openOnPhone={activeTab === `section-${section.name}`}
          >
            <RecordViewSection
              section={section}
              renderAssociation={renderAssociation}
              tableMetaData={tableMetaData}
              record={record}
              widgetMetaDataMap={widgetMetaDataMap}
              allTables={allTables}
              navigateFrom={navigateFrom}
            />
          </AccordionSection>
        ))}

        {/* Unbound named associations */}
        {associations.map((association) => (
          <AccordionSection key={association.name} id={`related-${encodeURIComponent(association.name)}`} label={association.name} openOnPhone={activeTab === 'related'}>
            {renderAssociation(association.name)}
          </AccordionSection>
        ))}
      </div>
    </>
  )
}
