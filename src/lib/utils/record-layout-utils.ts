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
 * @file record-layout-utils — record view layout settings from metadata, as the Material dashboard
 * reads them: RECORD_VIEW section alternatives, collapsible sections and their stored open state,
 * the record sidebar (`showRecordSidebar`), where the actions go (`recordViewActionsPlacement`),
 * and 12-column grid spans (`gridColumns`).
 */

import type { QFieldMetaData, QInstance, QTableMetaData, QTableSection, QueryJoin, QWidgetMetaData } from '@/types'
import { MATERIAL_DASHBOARD_TYPE, materialDashboardTableMetaData } from './goto-utils'
import { withReadableExposedJoins } from './query-columns'

/** Section alternative type for the record view screen. */
export const RECORD_VIEW_ALTERNATIVE = 'RECORD_VIEW'

/** Where the record view puts its actions. */
export type RecordViewActionsPlacement = 'IN_IDENTITY_SECTION' | 'INLINE_WITH_PAGE_TITLE'

/**
 * The table's sections as the record view shows them: each section with a RECORD_VIEW
 * alternative is replaced by it (Material `section.alternatives.get("RECORD_VIEW")`).
 *
 * @param table - Table metadata.
 * @returns The sections, in metadata order.
 */
export function recordViewSections(table: QTableMetaData): QTableSection[] {
  return (table.sections ?? []).map((section) => section.alternatives?.[RECORD_VIEW_ALTERNATIVE] ?? section)
}

/**
 * Resolves alternatives before filtering hidden or empty record-view sections.
 *
 * @param table - Table metadata.
 * @param allTables - Visible table registry for qualified join fields.
 * @returns Renderable sections in metadata order.
 */
export function visibleRecordViewSections(table: QTableMetaData, allTables?: Record<string, QTableMetaData>): QTableSection[] {
  return recordViewSections(table).filter((section) => {
    if (section.isHidden || section.hidden) return false
    if (section.widgetName) return true
    return section.fieldNames.some((name) => {
      const field = recordSectionField(table, allTables, name)
      return field && !field.isHidden
    })
  })
}

/**
 * Resolve a record section's base or qualified join field. A joined field retains its
 * `table.field` name because the record response uses that key for its value.
 *
 * @param table - Base table metadata.
 * @param allTables - Visible table registry used to check every join hop.
 * @param name - Section field name.
 * @returns Readable field metadata with the response key, or undefined.
 */
export function recordSectionField(table: QTableMetaData, allTables: Record<string, QTableMetaData> | undefined, name: string): QFieldMetaData | undefined {
  if (table.fields[name]) return table.fields[name]
  const dot = name.indexOf('.')
  if (dot < 1 || !allTables) return undefined
  const joinName = name.slice(0, dot)
  const fieldName = name.slice(dot + 1)
  const join = withReadableExposedJoins(table, allTables).exposedJoins?.find(({ joinTable }) => joinTable?.name === joinName)
  const field = join?.joinTable?.fields[fieldName]
  return field ? { ...field, name } : undefined
}

/**
 * Join descriptors required by visible record sections, using the same shape as the query page.
 *
 * @param table - Base table metadata.
 * @param allTables - Visible table registry used to check join permissions.
 * @returns Joins selected for the record GET.
 */
export function recordSectionQueryJoins(table: QTableMetaData, allTables: Record<string, QTableMetaData>): QueryJoin[] {
  const names = new Set(visibleRecordViewSections(table, allTables).flatMap((section) =>
    (section.fieldNames ?? []).filter((name) => {
      const field = recordSectionField(table, allTables, name)
      return name.includes('.') && field && !field.isHidden
    }).map((name) => name.split('.')[0])
  ))
  return (withReadableExposedJoins(table, allTables).exposedJoins ?? [])
    .filter(({ joinTable }) => joinTable && names.has(joinTable.name))
    .map(({ joinTable, joinPath }): QueryJoin => ({
      joinTable: joinTable!.name,
      select: true,
      type: 'LEFT',
      ...(joinPath?.length === 1 && joinPath[0].name ? { joinName: joinPath[0].name } : {}),
    }))
}

/**
 * Whether the user may collapse a section.
 *
 * @param section - Section metadata.
 * @returns True when `collapsible.isCollapsible` is set.
 */
export function isCollapsibleSection(section: Pick<QTableSection, 'collapsible'>): boolean {
  return section.collapsible?.isCollapsible === true
}

/**
 * localStorage key of a collapsible section's open state (the Material dashboard's key, so the
 * two dashboards share the setting).
 *
 * @param tableName - The table.
 * @param sectionName - The section.
 * @returns The key.
 */
export function collapsibleSectionStorageKey(tableName: string, sectionName: string): string {
  return `qqq.recordView.collapsibleSectionOpenStates.${tableName}.${sectionName}`
}

/**
 * A collapsible section's initial open state: the stored choice, else `initiallyOpen`.
 * A section that is not collapsible is always open.
 *
 * @param tableName - The table.
 * @param section - Section metadata.
 * @returns Whether the section starts open.
 */
export function initialSectionOpen(tableName: string, section: Pick<QTableSection, 'name' | 'collapsible'>): boolean {
  if (!isCollapsibleSection(section)) return true
  try {
    const stored = window.localStorage.getItem(collapsibleSectionStorageKey(tableName, section.name))
    if (stored === 'true' || stored === 'false') return stored === 'true'
  } catch {
    // storage unavailable: use the metadata default
  }
  return section.collapsible?.initiallyOpen === true
}

/**
 * Remembers a collapsible section's open state; storage failures are ignored.
 *
 * @param tableName - The table.
 * @param sectionName - The section.
 * @param open - Whether it is open.
 */
export function storeSectionOpen(tableName: string, sectionName: string, open: boolean): void {
  try {
    window.localStorage.setItem(collapsibleSectionStorageKey(tableName, sectionName), String(open))
  } catch {
    // private mode or blocked storage: the choice is not remembered
  }
}

/**
 * Whether the record view shows its section sidebar. Next UI keeps its compact record layout
 * unless the table explicitly asks for section navigation.
 *
 * @param table - Table metadata.
 * @returns True only when the table sets `showRecordSidebar` to true.
 */
export function showRecordSidebar(table: QTableMetaData): boolean {
  return materialDashboardTableMetaData(table)?.showRecordSidebar === true
}

/**
 * Normalizes a placement value.
 *
 * @param value - Candidate.
 * @returns The placement, or undefined for anything else.
 */
function asPlacement(value: unknown): RecordViewActionsPlacement | undefined {
  return value === 'IN_IDENTITY_SECTION' || value === 'INLINE_WITH_PAGE_TITLE' ? value : undefined
}

/**
 * Where the record view puts its actions: the instance's setting overrides the table's, and
 * the default is the identity section (Material RecordView.tsx).
 *
 * @param instance - Instance metadata (v1 `supplementalInstanceMetaData.materialDashboard`).
 * @param table - Table metadata.
 * @returns The placement.
 */
export function recordViewActionsPlacement(instance: QInstance | undefined, table: QTableMetaData): RecordViewActionsPlacement {
  const settings = instance?.supplementalInstanceMetaData?.[MATERIAL_DASHBOARD_TYPE]
  const fromInstance = settings && typeof settings === 'object'
    ? asPlacement((settings as { recordViewActionsPlacement?: unknown }).recordViewActionsPlacement)
    : undefined
  return fromInstance ?? asPlacement(materialDashboardTableMetaData(table)?.recordViewActionsPlacement) ?? 'IN_IDENTITY_SECTION'
}

/** `lg:col-span-N` for each width of a 12-column grid (static, so Tailwind emits them). */
const LG_SPANS: Record<number, string> = {
  1: 'lg:col-span-1', 2: 'lg:col-span-2', 3: 'lg:col-span-3', 4: 'lg:col-span-4', 5: 'lg:col-span-5', 6: 'lg:col-span-6',
  7: 'lg:col-span-7', 8: 'lg:col-span-8', 9: 'lg:col-span-9', 10: 'lg:col-span-10', 11: 'lg:col-span-11', 12: 'lg:col-span-12',
}

/**
 * A metadata `gridColumns` value as a width in twelfths, or undefined when unset or invalid.
 *
 * @param gridColumns - Metadata value.
 * @returns 1 to 12, or undefined.
 */
export function twelfths(gridColumns: number | undefined | null): number | undefined {
  return typeof gridColumns === 'number' && gridColumns >= 1 && gridColumns <= 12 ? Math.round(gridColumns) : undefined
}

/**
 * Classes that size an item of a 12-column grid: full width below `lg`, `span` twelfths from `lg`.
 *
 * @param span - Width in twelfths.
 * @returns The classes.
 */
export function gridSpanClasses(span: number): string {
  return `col-span-12 min-w-0 ${LG_SPANS[twelfths(span) ?? 12]}`
}

/**
 * A widget section's card takes the widget width, otherwise the section width.
 *
 * @param section - Record-view section metadata.
 * @param widgets - Widgets available to the viewer.
 * @param defaultSpan - Card width when metadata omits it: half-width in an overview, full-width in a selected tab.
 * @returns Classes for a full mobile row and the declared desktop span.
 */
export function recordSectionGridSpan(section: QTableSection, widgets?: Record<string, QWidgetMetaData>, defaultSpan = 6): string {
  const width = section.widgetName ? widgets?.[section.widgetName]?.gridColumns : section.gridColumns
  return gridSpanClasses(twelfths(width) ?? defaultSpan)
}
