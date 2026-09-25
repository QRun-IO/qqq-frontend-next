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
 * @file AppHome — home page of a QQQ app: widgets, sections of actions/reports/data, and child apps.
 */

'use client'

import React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'

import type { QAppMetaData, QAppSection, QAppTreeNode, QIcon, QInstance, QWidgetMetaData } from '@/types'
import { countRecords } from '@/lib/api/tables'
import { queryKeys } from '@/lib/query-client'
import { isHiddenNode } from '@/lib/hooks/use-routes'
import { canAccessProcess, canReadRecords, canRunReport } from '@/lib/auth/permissions'
import { MetadataIcon, type MetadataIconKind } from '@/components/layout/MetadataIcon'
import { ConnectedWidget } from './ConnectedWidget'
import { widgetColumnClasses } from './widget-utils'

/** Props accepted by the AppHome component. */
interface AppHomeProps {
  /** Full metadata for the app whose home page is being rendered. */
  appMetaData: QAppMetaData
  /** Instance metadata, used to resolve section entries (labels, hidden flags, capabilities). */
  instance: QInstance
  /** Map of all known widget metadata objects, keyed by widget name. */
  widgetRegistry: Record<string, QWidgetMetaData>
}

/** One resolved link on the app home. */
interface HomeEntry {
  /** Backend name. */
  name: string
  /** Metadata label. */
  label: string
  /** Icon declared for the entry (falls back to the app icon, as Material Dashboard does). */
  icon?: QIcon
  /** Listed but denied to the user (DenyBehavior.DISABLED): shown as a disabled card, not a link. */
  disabled?: boolean
}

/**
 * Returns the icon of an app or tree node, accepting the legacy `iconName`.
 *
 * @param node - App or tree node.
 * @returns Its icon, or `undefined`.
 */
function iconOf(node: { icon?: QIcon; iconName?: string } | undefined): QIcon | undefined {
  if (node?.icon?.name || node?.icon?.path) return node.icon
  return node?.iconName ? { name: node.iconName } : undefined
}

/**
 * Resolves the section entries of one kind to visible, permitted links.
 *
 * Entries missing from the instance metadata (not permitted) or marked hidden are dropped;
 * entries listed with their permission flag false (DenyBehavior.DISABLED) are marked disabled.
 *
 * @param names - Entry names listed by the section.
 * @param type - App-tree node type of the entries.
 * @param app - The app (its `childMap` supplies labels and icons).
 * @param instance - Instance metadata.
 * @returns Links to render, in section order.
 */
function resolveEntries(names: string[] | undefined, type: QAppTreeNode['type'], app: QAppMetaData, instance: QInstance): HomeEntry[] {
  const appIcon = iconOf(app)
  return (names ?? []).flatMap((name) => {
    const child = app.childMap?.[name] ?? app.children?.find((node) => node.name === name)
    const object = type === 'TABLE' ? instance.tables?.[name] : type === 'PROCESS' ? instance.processes?.[name] : instance.reports?.[name]
    // Reports are absent from v1 instance metadata; the app child is then the source of truth.
    if (!object && !(type === 'REPORT' && !instance.reports && child)) return []
    if (isHiddenNode({ name, label: '', type }, instance)) return []
    const objectIcon = object && 'icon' in object ? iconOf(object) : undefined
    const disabled = type === 'TABLE' ? !canReadRecords(instance.tables?.[name])
      : type === 'PROCESS' ? !canAccessProcess(instance.processes?.[name])
        : Boolean(object) && !canRunReport(instance.reports?.[name])
    return [{ name, label: child?.label ?? object?.label ?? name, icon: iconOf(child) ?? objectIcon ?? appIcon, disabled }]
  })
}

/**
 * Renders "N total records" for a table, counted by the backend.
 *
 * Tables without the `TABLE_COUNT` capability or read permission show a dash.
 *
 * @param props - Component properties.
 * @param props.tableName - Table to count.
 * @param props.instance - Instance metadata.
 * @returns The count text.
 */
function TableCount({ tableName, instance }: { tableName: string; instance: QInstance }) {
  const table = instance.tables?.[tableName]
  const countable = Boolean(table?.readPermission && table.capabilities?.includes('TABLE_COUNT'))
  const { data, isError, isPending } = useQuery({
    queryKey: queryKeys.tableCount(tableName, '{}'),
    queryFn: () => countRecords(tableName, { filter: {} }),
    enabled: countable,
  })

  let text = '–'
  if (countable && isPending) text = '…'
  else if (countable && !isError && data) text = `${data.count.toLocaleString()} ${data.count === 1 ? 'total record' : 'total records'}`
  return (
    <span className="text-xs text-muted-foreground" data-qqq-id={`app-section-table-count-${tableName}`}>
      {text}
    </span>
  )
}

/** Card link used for every app-home entry. */
const CARD_CLASS = 'flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-accent hover:text-primary focus:outline-none focus:ring-2 focus:ring-ring'

/**
 * Renders one group ("Actions", "Reports", "Data" or "Apps") of entry cards.
 *
 * @param props - Component properties.
 * @returns The group, or `null` when it has no entries.
 */
function EntryGroup({ title, showTitle = true, idPrefix, kind, entries, instance }: {
  title: string
  showTitle?: boolean
  idPrefix: string
  kind: MetadataIconKind
  entries: HomeEntry[]
  instance?: QInstance
}) {
  if (entries.length === 0) return null
  return (
    <div>
      {showTitle && <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>}
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label={title}>
        {entries.map((entry) => (
          <li key={entry.name}>
            {entry.disabled ? (
              <span
                aria-disabled="true"
                title="You do not have permission to open this"
                className="flex cursor-not-allowed items-center gap-3 rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm font-medium text-muted-foreground"
                data-qqq-id={`${idPrefix}-${entry.name}`}
              >
                <MetadataIcon icon={entry.icon} kind={kind} className="h-5 w-5" />
                <span className="truncate">{entry.label}</span>
              </span>
            ) : (
              <Link href={`/app/${entry.name}`} className={CARD_CLASS} data-qqq-id={`${idPrefix}-${entry.name}`}>
                <MetadataIcon icon={entry.icon} kind={kind} className="h-5 w-5 text-primary" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{entry.label}</span>
                  {kind === 'table' && instance && <TableCount tableName={entry.name} instance={instance} />}
                </span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Renders the home page of a QQQ app.
 *
 * Layout follows Material Dashboard's app home: the app label, the app's
 * widgets, then one card per section listing its processes ("Actions"),
 * reports ("Reports") and tables ("Data", with record counts), and the app's
 * child apps ("Apps"). Entries use metadata labels and icons; hidden or
 * unpermitted entries are omitted. An app with none of these shows an empty state.
 *
 * @param props - Component properties.
 * @returns The rendered app home.
 */
export function AppHome({ appMetaData, instance, widgetRegistry }: AppHomeProps) {
  const { name, label, widgets: widgetNames = [], children = [] } = appMetaData

  // Widgets in declared order. Widgets hidden from the user are absent from the registry; denied
  // (DenyBehavior.DISABLED) ones render their permission state without loading data (ConnectedWidget).
  const widgetItems = (widgetNames ?? []).flatMap((wName) => {
    const meta = widgetRegistry[wName]
    return meta ? [meta] : []
  })

  // Apps without explicit sections list their leaf children as one section
  const sections: QAppSection[] = appMetaData.sections ?? (children.some((child) => child.type !== 'APP')
    ? [{
      name,
      label,
      tables: children.filter((child) => child.type === 'TABLE').map((child) => child.name),
      processes: children.filter((child) => child.type === 'PROCESS').map((child) => child.name),
      reports: children.filter((child) => child.type === 'REPORT').map((child) => child.name),
    }]
    : [])

  const resolvedSections = sections.map((section) => ({
    section,
    processes: resolveEntries(section.processes, 'PROCESS', appMetaData, instance),
    reports: resolveEntries(section.reports, 'REPORT', appMetaData, instance),
    tables: resolveEntries(section.tables, 'TABLE', appMetaData, instance),
  })).filter(({ processes, reports, tables }) => processes.length + reports.length + tables.length > 0)

  const childApps: HomeEntry[] = children
    .filter((child) => child.type === 'APP')
    .map((child) => ({ name: child.name, label: child.label, icon: iconOf(child) ?? iconOf(instance.apps?.[child.name]) }))

  const isEmpty = widgetItems.length === 0 && resolvedSections.length === 0 && childApps.length === 0

  return (
    <div className="space-y-6" data-qqq-id={`app-home-${name}`}>
      {/* App heading */}
      <div className="flex items-center gap-3">
        <MetadataIcon icon={iconOf(appMetaData)} kind="app" className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{label}</h1>
      </div>

      {/* Widget grid: QQQ sizes widgets in twelfths (gridColumns), full width on small screens */}
      {widgetItems.length > 0 && (
        <section aria-label="Dashboard widgets" className="grid grid-cols-12 gap-5" data-qqq-id="widget-grid">
          {widgetItems.map((meta) => (
            <div key={meta.name} className={widgetColumnClasses(meta.gridColumns)} data-qqq-id={`widget-grid-item-${meta.name}`}>
              <ConnectedWidget widgetMetaData={meta} widgetRegistry={widgetRegistry} />
            </div>
          ))}
        </section>
      )}

      {/* Sections: actions, reports, data */}
      {resolvedSections.map(({ section, processes, reports, tables }) => (
        <section
          key={section.name}
          aria-labelledby={`app-section-heading-${section.name}`}
          className="space-y-4 rounded-xl border border-border bg-card/50 p-5"
          data-qqq-id={`app-section-${section.name}`}
        >
          <h2 id={`app-section-heading-${section.name}`} className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <MetadataIcon icon={section.icon} kind="section" className="h-5 w-5 text-muted-foreground" />
            {section.label}
          </h2>
          <EntryGroup title="Actions" idPrefix="app-section-process" kind="process" entries={processes} />
          <EntryGroup title="Reports" idPrefix="app-section-report" kind="report" entries={reports} />
          <EntryGroup title="Data" idPrefix="app-section-table" kind="table" entries={tables} instance={instance} />
        </section>
      ))}

      {/* Child apps */}
      {childApps.length > 0 && (
        <section aria-labelledby={`app-children-heading-${name}`} className="space-y-4 rounded-xl border border-border bg-card/50 p-5" data-qqq-id={`app-children-${name}`}>
          <h2 id={`app-children-heading-${name}`} className="text-lg font-semibold text-foreground">Apps</h2>
          <EntryGroup title="Apps" showTitle={false} idPrefix="app-child" kind="app" entries={childApps} />
        </section>
      )}

      {/* Empty state when the app declares nothing to show */}
      {isEmpty && (
        <div
          className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 py-16 text-center"
          data-qqq-id={`app-home-empty-${name}`}
        >
          <p className="text-muted-foreground">
            No dashboard content configured for this app
          </p>
        </div>
      )}
    </div>
  )
}
