/** RecordQueryToolbar — toolbar for the RecordQuery page: search, filter toggle, density, view-mode, column config, refresh, saved views, export, process launcher */
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
import type { Density, SavedView } from '@/lib/hooks/use-record-query'

import { ColumnConfig } from './ColumnConfig'
import { SavedViewsMenu } from './SavedViewsMenu'
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
 * @param density - The currently active density value.
 * @param onSelect - Callback invoked when the user picks a new density option.
 */
function DensitySelector({
  density,
  onSelect,
}: {
  density: Density
  onSelect: (d: Density) => void
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="relative">
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
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            className="absolute right-0 z-20 mt-1 w-36 rounded-xl border border-border bg-popover shadow-sm"
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
        </>
      )}
    </div>
  )
}

/**
 * Paired toggle buttons for switching between the tabular grid view and the card view.
 *
 * @param viewMode - The currently active view mode.
 * @param onChange - Callback invoked when the user selects a different view mode.
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
  /** IDs of all currently selected rows (for ProcessLauncherMenu and ExportButton). */
  selectedRecordIds: (string | number)[]
  /** The fully assembled effective filter (for export and process launcher). */
  effectiveFilter: QQueryFilter
  /** Current saved views list. */
  savedViews: SavedView[]
  /** Callback to save the current view under a given name. */
  onSaveView: (name: string) => SavedView
  /** Callback to load a previously saved view. */
  onLoadView: (view: SavedView) => void
  /** Callback to delete a saved view by ID. */
  onDeleteView: (id: string) => void
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

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Toolbar for the RecordQuery page.
 *
 * Contains: create button, quick-search input, filter toggle, process launcher,
 * saved views menu, export button, view-mode toggle, density selector, column-config
 * toggle, and refresh button. All state is passed in as props — this component holds
 * no state of its own.
 */
export function RecordQueryToolbar({
  tableName,
  tableMetaData,
  processes,
  canCreate,
  handleCreateRecord,
  localSearchTerm,
  quickSearchRef,
  handleSearchChange,
  setLocalSearchTerm,
  clearQuickSearch,
  filterPanelOpen,
  mobileFilterOpen,
  activeFilterCount,
  handleFilterToggle,
  selectedRecordIds,
  effectiveFilter,
  savedViews,
  onSaveView,
  onLoadView,
  onDeleteView,
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

      {/* Spacer */}
      <div className="flex-1" />

      {/* Process launcher */}
      {processes && processes.length > 0 && (
        <ProcessLauncherMenu
          processes={processes}
          selectedRecordIds={selectedRecordIds}
          tableName={tableName}
          currentFilter={effectiveFilter}
        />
      )}

      {/* Saved views */}
      <SavedViewsMenu
        savedViews={savedViews}
        onSave={onSaveView}
        onLoad={onLoadView}
        onDelete={onDeleteView}
      />

      {/* Export */}
      <ExportButton
        tableName={tableName}
        tableMetaData={tableMetaData}
        currentFilter={effectiveFilter}
        columnVisibility={columnVisibility}
        columnOrder={columnOrder}
        selectedRecordIds={selectedRecordIds}
      />

      {/* View mode toggle: grid / card */}
      <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />

      {/* Density selector */}
      <DensitySelector density={density} onSelect={setDensity} />

      {/* Column config toggle — min 44px touch target (HIGH-5) */}
      <div className="relative">
        <button
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

        {columnConfigOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setColumnConfigOpen(false)}
              aria-hidden="true"
            />
            <div className="absolute right-0 z-20 mt-1">
              <ColumnConfig
                tableMetaData={tableMetaData}
                columnVisibility={columnVisibility}
                columnOrder={columnOrder}
                onVisibilityChange={setColumnVisibility}
                onOrderChange={setColumnOrder}
                onClose={() => setColumnConfigOpen(false)}
              />
            </div>
          </>
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
