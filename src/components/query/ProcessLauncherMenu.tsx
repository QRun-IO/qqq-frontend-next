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
 * @file ProcessLauncherMenu — the query screen's Actions menu (Material's QueryScreenActionMenu):
 * Bulk Load/Edit/Edit With File/Delete when the table's capabilities, the user's permissions and
 * the `{table}.bulk*` processes allow them, then the table's own processes. Launching is
 * delegated to the caller, which passes the current selection to the process.
 */

'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Play, ChevronDown, FilePlus2, Pencil, FilePenLine, Trash2 } from 'lucide-react'

import type { QProcessMetaData, QTableMetaData } from '@/types'
import { hasCapability } from '@/lib/utils/query-columns'

/** Bulk actions offered by the menu, in Material's order. */
const BULK_ACTIONS = [
  { suffix: 'bulkInsert', label: 'Bulk Load', capability: 'TABLE_INSERT', permission: 'insertPermission', needsSelection: false, Icon: FilePlus2 },
  { suffix: 'bulkEdit', label: 'Bulk Edit', capability: 'TABLE_UPDATE', permission: 'editPermission', needsSelection: true, Icon: Pencil },
  { suffix: 'bulkEditWithFile', label: 'Bulk Edit With File', capability: 'TABLE_UPDATE', permission: 'editPermission', needsSelection: false, Icon: FilePenLine },
  { suffix: 'bulkDelete', label: 'Bulk Delete', capability: 'TABLE_DELETE', permission: 'deletePermission', needsSelection: true, Icon: Trash2 },
] as const

/**
 * Props for the ProcessLauncherMenu component.
 */
interface ProcessLauncherMenuProps {
  /** Table the query screen shows. */
  tableMetaData: QTableMetaData
  /** Every process in the instance (bulk processes are hidden, so they come from here). */
  allProcesses: Record<string, QProcessMetaData>
  /** The table's visible processes. */
  processes: QProcessMetaData[]
  /** How many records the current selection covers. */
  selectionCount: number
  /** Launches a process with the current selection. */
  onLaunch: (process: QProcessMetaData) => void
  /** Reports why a process was not launched (for example, nothing selected). */
  onBlocked: (message: string) => void
}

/** One entry in the actions menu. */
interface MenuEntry {
  key: string
  label: string
  process: QProcessMetaData
  Icon: typeof Play
  blockedMessage?: string
}

/**
 * Builds the menu entries: permitted bulk actions, then table processes sorted by label.
 *
 * @param props - The menu props.
 * @returns Bulk entries and process entries.
 */
export function buildActionEntries({ tableMetaData, allProcesses, processes, selectionCount }: Omit<ProcessLauncherMenuProps, 'onLaunch' | 'onBlocked'>): { bulk: MenuEntry[]; table: MenuEntry[] } {
  const bulk: MenuEntry[] = []
  for (const action of BULK_ACTIONS) {
    const process = allProcesses[`${tableMetaData.name}.${action.suffix}`]
    if (!process || process.hasPermission === false) continue
    if (!hasCapability(tableMetaData, action.capability) || !tableMetaData[action.permission]) continue
    bulk.push({
      key: action.suffix,
      label: action.label,
      process,
      Icon: action.Icon,
      blockedMessage: action.needsSelection && selectionCount === 0 ? `No records were selected to ${action.label}.` : undefined,
    })
  }
  const table = processes
    .filter((p) => !p.isHidden && p.hasPermission !== false)
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((process): MenuEntry => {
      let blockedMessage: string | undefined
      const min = process.minInputRecords
      const max = process.maxInputRecords
      if (min != null && min > 0 && selectionCount === 0) blockedMessage = `No records were selected for the process: ${process.label}`
      else if (min != null && selectionCount < min) blockedMessage = `Too few records were selected for the process: ${process.label}.  A minimum of ${min} is required.`
      else if (max != null && selectionCount > max) blockedMessage = `Too many records were selected for the process: ${process.label}.  A maximum of ${max} is allowed.`
      return { key: process.name, label: process.label, process, Icon: Play, blockedMessage }
    })
  return { bulk, table }
}

/**
 * Dropdown "Actions" menu for the record query page.
 *
 * @param props - Component properties.
 * @returns The menu, or null when there is nothing to offer.
 */
export function ProcessLauncherMenu(props: ProcessLauncherMenuProps) {
  const { onLaunch, onBlocked } = props
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen])

  const { bulk, table } = buildActionEntries(props)
  if (bulk.length === 0 && table.length === 0) return null

  const choose = (entry: MenuEntry) => {
    setIsOpen(false)
    if (entry.blockedMessage) onBlocked(entry.blockedMessage)
    else onLaunch(entry.process)
  }

  const item = (entry: MenuEntry) => (
    <button
      key={entry.key}
      type="button"
      role="menuitem"
      onClick={() => choose(entry)}
      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-popover-foreground transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
      data-qqq-id={`process-launcher-item-${entry.process.name}`}
    >
      <entry.Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="truncate">{entry.label}</span>
    </button>
  )

  return (
    <div ref={containerRef} className="relative" data-qqq-id="process-launcher-menu">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="Actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        data-qqq-id="process-launcher-trigger"
      >
        <Play className="h-4 w-4" aria-hidden="true" />
        Actions
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-20 mt-1 w-60 rounded-xl border border-border bg-popover shadow-sm" role="menu" aria-label="Actions">
          <div className="max-h-72 overflow-y-auto py-1">
            {bulk.map(item)}
            {bulk.length > 0 && table.length > 0 && <div role="separator" className="my-1 border-t border-border" />}
            {table.map(item)}
          </div>
        </div>
      )}
    </div>
  )
}
