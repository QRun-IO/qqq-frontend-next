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
 * @file RecordQueryToolbar — toolbar for the RecordQuery page: search, filter toggle, density, view-mode, column config, refresh, saved views, export, Go To, process launcher.
 */

'use client'

import React from 'react'
import {
  Plus,
  Columns,
  Search,
  X,
  ChevronDown,
  RefreshCw,
  Filter,
  LayoutList,
  LayoutGrid,
  Table2,
  Tag,
} from 'lucide-react'

import type { QTableMetaData, QProcessMetaData, QQueryFilter } from '@/types'
import type { Density } from '@/lib/hooks/use-record-query'
import type { TableVariant } from '@/lib/api/tables'

import { GotoRecordButton } from '@/components/records/GotoRecordDialog'

import { ColumnConfig } from './ColumnConfig'
import { ExportButton } from './ExportButton'
import { ProcessLauncherMenu } from './ProcessLauncherMenu'

// ─── Local subcomponents ──────────────────────────────────────────────────────

/** Display mode for the record list — either a tabular grid or a card layout. */
type ViewMode = 'grid' | 'card'

/** Static list of available row density options presented in the DensitySelector dropdown. */
const DENSITY_OPTIONS: { value: Density; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'standard', label: 'Standard' },
  { value: 'comfortable', label: 'Comfortable' },
]

/**
 * Toolbar button that opens a listbox for selecting the row density of the data grid.
 *
 * @param props - Component properties.
 * @returns The rendered density selector dropdown.
 */
function DensitySelector({
  density,
  onSelect,
}: {
  density: Density
  onSelect: (d: Density) => void
}) {
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    /**
     * Closes the dropdown when a click occurs outside the container.
     * @param e - The native mousedown event.
     */
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="relative" ref={containerRef}>
      {/* min-h/min-w 44px for HIGH-5 touch target compliance */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="Select display density"
        aria-haspopup="listbox"
        aria-expanded={open}
        data-qqq-id="button-density"
      >
        <LayoutList className="h-4 w-4" aria-hidden="true" />
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open && (
        <div
          className="absolute right-0 z-[150] mt-1 w-36 rounded-xl border border-border bg-popover shadow-sm"
          role="listbox"
          aria-label="Display density"
        >
          {DENSITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={density === opt.value}
              onClick={() => {
                onSelect(opt.value)
                setOpen(false)
              }}
              className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring ${
                density === opt.value
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-popover-foreground hover:bg-accent'
              }`}
              data-qqq-id={`density-option-${opt.value}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Paired toggle buttons for switching between the tabular grid view and the card view.
 *
 * @param props - Component properties.
 * @returns The rendered view mode toggle button pair.
 */
function ViewModeToggle({
  viewMode,
  onChange,
}: {
  viewMode: ViewMode
  onChange: (mode: ViewMode) => void
}) {
  return (
    <div className="flex items-center rounded border border-input" data-qqq-id="view-mode-toggle">
      {/* min-h/min-w 44px for HIGH-5 touch target compliance */}
      <button
        type="button"
        onClick={() => onChange('grid')}
        className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-l transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
          viewMode === 'grid'
            ? 'bg-primary/10 text-primary'
            : 'bg-background text-muted-foreground hover:bg-accent'
        }`}
        aria-label="Table view"
        aria-pressed={viewMode === 'grid'}
        data-qqq-id="view-mode-grid"
      >
        <Table2 className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onChange('card')}
        className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-r border-l border-input transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
          viewMode === 'card'
            ? 'bg-primary/10 text-primary'
            : 'bg-background text-muted-foreground hover:bg-accent'
        }`}
        aria-label="Card view"
        aria-pressed={viewMode === 'card'}
        data-qqq-id="view-mode-card"
      >
        <LayoutGrid className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

/**
 * Props for the RecordQueryToolbar component.
 */
export interface RecordQueryToolbarProps {
  /** The backend table name used in API calls and URL routing. */
  tableName: string
  /** Full table metadata from the QQQ backend. */
  tableMetaData: QTableMetaData
  /** Optional list of processes available for launch from the toolbar. */
  processes?: QProcessMetaData[]
  /** Whether the current user has permission to create records. */
  canCreate: boolean
  /** Callback to navigate to the create-record route. */
  handleCreateRecord: () => void
  /** Current value of the quick-search input (controlled by RecordQuery). */
  localSearchTerm: string
  /** Ref forwarded to the quick-search input element. */
  quickSearchRef: React.RefObject<HTMLInputElement | null>
  /** The Filter button, where focus returns when the phone filter sheet closes. */
  filterButtonRef?: React.Ref<HTMLButtonElement>
  /** Callback for quick-search input changes (debounces propagation internally). */
  handleSearchChange: (value: string) => void
  /** Setter for the local search term (used by the clear button). */
  setLocalSearchTerm: (value: string) => void
  /** Clears the quick-search term in the record query hook. */
  clearQuickSearch: () => void
  /** Whether the desktop filter panel is open. */
  filterPanelOpen: boolean
  /** Whether the mobile filter bottom-sheet is open. */
  mobileFilterOpen: boolean
  /** Number of active filter criteria (drives badge + button highlight). */
  activeFilterCount: number
  /** Callback to toggle the filter panel (desktop or mobile). */
  handleFilterToggle: () => void
  /** Every process in the instance (the table's hidden bulk processes are found here). */
  allProcesses: Record<string, QProcessMetaData>
  /** How many records the current selection covers. */
  selectionCount: number
  /** Launches a process with the current selection. */
  onLaunchProcess: (process: QProcessMetaData) => void
  /** Reports why a process was not launched. */
  onProcessBlocked: (message: string) => void
  /** Filter and sort for exports (paging ignored). */
  exportFilter: QQueryFilter
  /** Visible column names in order, for exports. */
  exportColumns: string[]
  /** Matching record count, or null when the table cannot count. */
  totalCount: number | null
  /** Selected backend variant (for exports). */
  tableVariant?: TableVariant | null
  /** Saved views menu, rendered by the page. */
  savedViewsMenu?: React.ReactNode
  /** Selection menu, rendered by the page. */
  selectionMenu?: React.ReactNode
  /** Current column visibility map. */
  columnVisibility: Record<string, boolean>
  /** Ordered list of column field names. */
  columnOrder: string[]
  /** Whether the column-config panel is open. */
  columnConfigOpen: boolean
  /** Callback to toggle the column-config panel. */
  toggleColumnConfig: () => void
  /** Callback to explicitly set the column-config panel open state. */
  setColumnConfigOpen: (open: boolean) => void
  /** Callback to update the column visibility map. */
  setColumnVisibility: (visibility: Record<string, boolean>) => void
  /** Callback to update the column order. */
  setColumnOrder: (order: string[]) => void
  /** Currently active row density for the data grid. */
  density: Density
  /** Callback to change the row density. */
  setDensity: (d: Density) => void
  /** Currently active view mode (grid or card). */
  viewMode: ViewMode
  /** Callback to switch the view mode. */
  setViewMode: (mode: ViewMode) => void
  /** Whether the data grid is currently fetching (drives the refresh spinner). */
  isFetching: boolean
  /** Callback to invalidate and refresh the records query. */
  handleRefresh: () => void
  /** The currently selected variant ID (null when no variant is selected). Only relevant when `tableMetaData.usesVariants` is true. */
  selectedVariantId?: string | number | null
  /** The human-readable label for the currently selected variant, shown in the chip. */
  selectedVariantLabel?: string | null
  /** Callback invoked when the variant chip is clicked (should open the VariantPicker). */
  onVariantChipClick?: () => void
}

/** Screen position and height limit of the fixed column-config panel. */
export interface ColumnConfigPosition {
  top: number
  right: number
  maxHeight: number
}

/** Gap between the column-config button and its panel, and the panel's margin from the viewport bottom. */
const COLUMN_CONFIG_GAP = 4
const COLUMN_CONFIG_MARGIN = 8
/** Width of the column configuration panel (w-80), capped to the viewport in ColumnConfig. */
const COLUMN_CONFIG_WIDTH = 320

/**
 * Place the column-config panel under its button, limited to the viewport height below it.
 * The panel is fixed, so anything past the viewport bottom could never be scrolled into view.
 *
 * @param button - Bounding rectangle of the column-config button.
 * @param viewportWidth - `window.innerWidth`.
 * @param viewportHeight - `window.innerHeight`.
 * @returns The panel's fixed position and maximum height.
 */
export function columnConfigPosition(button: Pick<DOMRect, 'bottom' | 'right'>, viewportWidth: number, viewportHeight: number): ColumnConfigPosition {
  const top = button.bottom + COLUMN_CONFIG_GAP
  // Keep the whole panel on screen: on a phone the button may sit near the left edge (wrapped toolbar)
  const widest = Math.max(COLUMN_CONFIG_MARGIN, viewportWidth - COLUMN_CONFIG_WIDTH - COLUMN_CONFIG_MARGIN)
  const right = Math.min(Math.max(COLUMN_CONFIG_MARGIN, viewportWidth - button.right), widest)
  return { top, right, maxHeight: Math.max(0, viewportHeight - top - COLUMN_CONFIG_MARGIN) }
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Toolbar for the RecordQuery page.
 *
 * Contains: create button, quick-search input, filter toggle, process launcher,
 * saved views menu, export button, view-mode toggle, density selector, column-config
 * toggle, and refresh button. All state is passed in as props — this component holds
 * no state of its own.
 *
 * @param props - Component properties.
 * @returns The rendered toolbar.
 */
export function RecordQueryToolbar({
  tableName,
  tableMetaData,
  processes,
  canCreate,
  handleCreateRecord,
  localSearchTerm,
  quickSearchRef,
  filterButtonRef,
  handleSearchChange,
  setLocalSearchTerm,
  clearQuickSearch,
  filterPanelOpen,
  mobileFilterOpen,
  activeFilterCount,
  handleFilterToggle,
  allProcesses,
  selectionCount,
  onLaunchProcess,
  onProcessBlocked,
  exportFilter,
  exportColumns,
  totalCount,
  tableVariant,
  savedViewsMenu,
  selectionMenu,
  columnVisibility,
  columnOrder,
  columnConfigOpen,
  toggleColumnConfig,
  setColumnConfigOpen,
  setColumnVisibility,
  setColumnOrder,
  density,
  setDensity,
  viewMode,
  setViewMode,
  isFetching,
  handleRefresh,
  selectedVariantId,
  selectedVariantLabel,
  onVariantChipClick,
}: RecordQueryToolbarProps) {
  const columnConfigRef = React.useRef<HTMLDivElement>(null)
  const columnConfigBtnRef = React.useRef<HTMLButtonElement>(null)
  const [columnConfigPos, setColumnConfigPos] = React.useState<ColumnConfigPosition | null>(null)

  React.useEffect(() => {
    if (!columnConfigOpen) { setColumnConfigPos(null); return }
    if (columnConfigBtnRef.current) {
      setColumnConfigPos(columnConfigPosition(columnConfigBtnRef.current.getBoundingClientRect(), window.innerWidth, window.innerHeight))
    }
    /**
     * Closes the column-config panel when a click occurs outside the container.
     * @param e - The native mousedown event.
     */
    function handleClickOutside(e: MouseEvent) {
      if (columnConfigRef.current && !columnConfigRef.current.contains(e.target as Node)) {
        setColumnConfigOpen(false)
      }
    }
    /**
     * Closes the column panel on Escape and returns focus to its button.
     *
     * @param e - The key event.
     */
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setColumnConfigOpen(false)
        columnConfigBtnRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [columnConfigOpen, setColumnConfigOpen])

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Create button */}
      {canCreate && (
        <button
          type="button"
          onClick={handleCreateRecord}
          className="flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
          aria-label={`Create new ${tableMetaData.label} record`}
          data-qqq-id="button-create"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create
        </button>
      )}

      {/* Variant selector chip — only when the table uses variants */}
      {tableMetaData.usesVariants && onVariantChipClick && (
        <button
          type="button"
          onClick={onVariantChipClick}
          className={`flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
            selectedVariantId != null
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-input bg-background text-foreground hover:bg-accent'
          }`}
          aria-label={
            selectedVariantId != null
              ? `Current variant: ${selectedVariantLabel ?? String(selectedVariantId)}. Click to change.`
              : `Select ${tableMetaData.variantTableLabel}`
          }
          data-qqq-id="button-variant-picker"
        >
          <Tag className="h-4 w-4" aria-hidden="true" />
          <span className="max-w-[140px] truncate">
            {selectedVariantId != null
              ? (selectedVariantLabel ?? String(selectedVariantId))
              : `Select ${tableMetaData.variantTableLabel}`}
          </span>
        </button>
      )}

      {/* Quick search */}
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <label htmlFor="quick-search" className="sr-only">
          Search {tableMetaData.label}
        </label>
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          ref={quickSearchRef}
          id="quick-search"
          type="search"
          value={localSearchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder={`Search ${tableMetaData.label}...`}
          className="w-full rounded border border-input bg-background py-1.5 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label={`Quick search ${tableMetaData.label}`}
          data-qqq-id="quick-search"
        />
        {localSearchTerm && (
          <button
            type="button"
            onClick={() => {
              setLocalSearchTerm('')
              clearQuickSearch()
              quickSearchRef.current?.focus()
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
            aria-label="Clear search"
            data-qqq-id="quick-search-clear"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Advanced filter toggle — min 44px touch target (HIGH-5) */}
      <button
        ref={filterButtonRef}
        type="button"
        onClick={handleFilterToggle}
        className={`flex min-h-[44px] items-center gap-1.5 rounded border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
          filterPanelOpen || mobileFilterOpen || activeFilterCount > 0
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-input bg-background text-foreground hover:bg-accent'
        }`}
        aria-label="Toggle advanced filter panel"
        aria-expanded={filterPanelOpen || mobileFilterOpen}
        data-qqq-id="button-filter"
      >
        <Filter className="h-4 w-4" aria-hidden="true" />
        Filter
        {activeFilterCount > 0 && (
          <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* Selection menu (this page / full query result / first N) */}
      {selectionMenu}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Go To a record by its key (tables with Material gotoFieldNames) */}
      <GotoRecordButton tableMetaData={tableMetaData} tableVariant={tableVariant} />

      {/* Actions: bulk processes, table processes and processes added to every screen */}
      <ProcessLauncherMenu
        tableMetaData={tableMetaData}
        allProcesses={allProcesses}
        processes={processes ?? []}
        selectionCount={selectionCount}
        onLaunch={onLaunchProcess}
        onBlocked={onProcessBlocked}
      />

      {/* Saved views */}
      {savedViewsMenu}

      {/* Export */}
      <ExportButton
        tableName={tableName}
        tableMetaData={tableMetaData}
        exportFilter={exportFilter}
        columnNames={exportColumns}
        totalCount={totalCount}
        tableVariant={tableVariant}
      />

      {/* View mode toggle: grid / card */}
      <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />

      {/* Density selector */}
      <DensitySelector density={density} onSelect={setDensity} />

      {/* Column config toggle — min 44px touch target (HIGH-5) */}
      <div ref={columnConfigRef}>
        <button
          ref={columnConfigBtnRef}
          type="button"
          onClick={toggleColumnConfig}
          className={`flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
            columnConfigOpen
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-input bg-background text-foreground hover:bg-accent'
          }`}
          aria-label="Configure columns"
          aria-expanded={columnConfigOpen}
          data-qqq-id="button-column-config"
        >
          <Columns className="h-4 w-4" aria-hidden="true" />
        </button>

        {columnConfigOpen && columnConfigPos && (
          <div
            style={{ position: 'fixed', top: columnConfigPos.top, right: columnConfigPos.right, zIndex: 200 }}
          >
            <ColumnConfig
              maxHeight={columnConfigPos.maxHeight}
              tableMetaData={tableMetaData}
              columnVisibility={columnVisibility}
              columnOrder={columnOrder}
              onVisibilityChange={setColumnVisibility}
              onOrderChange={setColumnOrder}
              onClose={() => setColumnConfigOpen(false)}
            />
          </div>
        )}
      </div>

      {/* Refresh — min 44px touch target (HIGH-5) */}
      <button
        type="button"
        onClick={handleRefresh}
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded border border-input bg-background text-muted-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="Refresh data"
        data-qqq-id="button-refresh"
      >
        <RefreshCw
          className={`h-4 w-4 ${isFetching ? 'animate-spin text-primary' : ''}`}
          aria-hidden="true"
        />
      </button>
    </div>
  )
}
