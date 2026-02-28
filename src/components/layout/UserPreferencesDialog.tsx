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

'use client'

/** UserPreferencesDialog — modal dialog for editing user display preferences stored in localStorage. */

import React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X, RotateCcw } from 'lucide-react'

import { cn } from '@/lib/utils/cn'
import { useUserPreferences } from '@/lib/hooks/use-user-preferences'

/**
 * Props for the UserPreferencesDialog component.
 */
interface UserPreferencesDialogProps {
  /** Whether the dialog is currently open. */
  open: boolean
  /** Called when the open state should change (e.g. after a close action). */
  onOpenChange: (open: boolean) => void
}

/** Available records-per-page options displayed as toggle chips. */
const PAGE_SIZE_OPTIONS = [
  { value: 10, label: '10 records' },
  { value: 25, label: '25 records' },
  { value: 50, label: '50 records' },
  { value: 100, label: '100 records' },
] as const

/** Available display-density options shown as radio buttons. */
const DENSITY_OPTIONS = [
  { value: 'compact', label: 'Compact', description: 'Tighter spacing, more data visible' },
  { value: 'standard', label: 'Standard', description: 'Balanced spacing and readability' },
  { value: 'comfortable', label: 'Comfortable', description: 'More spacing, easier scanning' },
] as const

/** Available table view-mode options (grid vs. card). */
const TABLE_VIEW_OPTIONS = [
  { value: 'grid', label: 'Table', description: 'Rows and columns data grid' },
  { value: 'card', label: 'Cards', description: 'Card layout for each record' },
] as const

/** Available record view-mode options (tabs vs. single-page). */
const RECORD_VIEW_OPTIONS = [
  { value: 'tabs', label: 'Tabbed', description: 'Sections organized into tabs' },
  { value: 'list', label: 'Single Page', description: 'All sections on one scrollable page' },
] as const

/**
 * Modal dialog for editing user display preferences persisted in localStorage.
 *
 * Sections cover: records-per-page, display density, table view mode, and
 * record view mode. A "Reset to Defaults" button is enabled only when at
 * least one preference differs from its default value.
 *
 * @param open - Whether the dialog is currently visible.
 * @param onOpenChange - Callback invoked when the dialog open state changes.
 * @returns A Radix Dialog root with overlay and content panels.
 */
export function UserPreferencesDialog({ open, onOpenChange }: UserPreferencesDialogProps) {
  const { preferences, updatePreference, resetPreferences, defaults } = useUserPreferences()

  const isDefault = (
    preferences.tableDefaultPageSize === defaults.tableDefaultPageSize &&
    preferences.tableDefaultDensity === defaults.tableDefaultDensity &&
    preferences.tableDefaultViewMode === defaults.tableDefaultViewMode &&
    preferences.recordDefaultViewMode === defaults.recordDefaultViewMode
  )

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/50',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0'
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            'w-full max-w-lg max-h-[85vh] flex flex-col',
            'rounded-xl border border-border bg-card shadow-lg',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95'
          )}
          aria-describedby={undefined}
          data-qqq-id="dialog-user-preferences"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <DialogPrimitive.Title className="text-lg font-semibold tracking-tight text-foreground">
              Preferences
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              className={cn(
                'rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-accent',
                'focus:outline-none focus:ring-2 focus:ring-ring'
              )}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {/* Table / Query Defaults */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Table View Defaults</h3>

              {/* Records per page */}
              <OptionGroup label="Records per page">
                <div className="flex flex-wrap gap-2">
                  {PAGE_SIZE_OPTIONS.map((opt) => (
                    <ToggleChip
                      key={opt.value}
                      selected={preferences.tableDefaultPageSize === opt.value}
                      onClick={() => updatePreference('tableDefaultPageSize', opt.value)}
                      data-qqq-id={`pref-pagesize-${opt.value}`}
                    >
                      {opt.label}
                    </ToggleChip>
                  ))}
                </div>
              </OptionGroup>

              {/* Density */}
              <OptionGroup label="Display density">
                <div className="space-y-1.5">
                  {DENSITY_OPTIONS.map((opt) => (
                    <RadioOption
                      key={opt.value}
                      selected={preferences.tableDefaultDensity === opt.value}
                      onClick={() => updatePreference('tableDefaultDensity', opt.value)}
                      label={opt.label}
                      description={opt.description}
                      data-qqq-id={`pref-density-${opt.value}`}
                    />
                  ))}
                </div>
              </OptionGroup>

              {/* View mode */}
              <OptionGroup label="Default view">
                <div className="flex gap-2">
                  {TABLE_VIEW_OPTIONS.map((opt) => (
                    <ToggleCard
                      key={opt.value}
                      selected={preferences.tableDefaultViewMode === opt.value}
                      onClick={() => updatePreference('tableDefaultViewMode', opt.value)}
                      label={opt.label}
                      description={opt.description}
                      data-qqq-id={`pref-table-view-${opt.value}`}
                    />
                  ))}
                </div>
              </OptionGroup>
            </div>

            <div className="border-t border-border" />

            {/* Record Screen Defaults */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Record View Defaults</h3>

              <OptionGroup label="Default layout">
                <div className="flex gap-2">
                  {RECORD_VIEW_OPTIONS.map((opt) => (
                    <ToggleCard
                      key={opt.value}
                      selected={preferences.recordDefaultViewMode === opt.value}
                      onClick={() => updatePreference('recordDefaultViewMode', opt.value)}
                      label={opt.label}
                      description={opt.description}
                      data-qqq-id={`pref-record-view-${opt.value}`}
                    />
                  ))}
                </div>
              </OptionGroup>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border px-6 py-3">
            <button
              type="button"
              onClick={resetPreferences}
              disabled={isDefault}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                'text-muted-foreground hover:text-foreground hover:bg-accent',
                'focus:outline-none focus:ring-2 focus:ring-ring',
                'disabled:opacity-40 disabled:pointer-events-none'
              )}
              data-qqq-id="button-reset-preferences"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Reset to Defaults
            </button>
            <DialogPrimitive.Close
              className={cn(
                'rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground',
                'hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1'
              )}
              data-qqq-id="button-close-preferences"
            >
              Done
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

// --- Sub-components ---

/**
 * Renders a labeled group container for a set of preference controls.
 *
 * @param label - The human-readable section label displayed above the controls.
 * @param children - The control elements (chips, radio buttons, toggle cards).
 * @returns A `<div>` with a `<label>` header and slotted children.
 */
function OptionGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

/**
 * A pill-shaped toggle button for selecting a single option from a set.
 *
 * Applies a filled primary style when selected, and a bordered outline style otherwise.
 *
 * @param selected - Whether this chip is the currently selected option.
 * @param onClick - Called when the chip is clicked to select it.
 * @param children - The chip label content.
 * @returns A `<button>` styled as a pill toggle chip.
 */
function ToggleChip({
  selected,
  onClick,
  children,
  ...rest
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
  'data-qqq-id'?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-ring',
        selected
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'border border-border bg-card text-foreground hover:bg-accent'
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

/**
 * A full-width radio-style option row with a custom circle indicator.
 *
 * Renders a label and a supporting description string alongside a filled
 * circle when selected, and an empty circle otherwise.
 *
 * @param selected - Whether this option is the currently selected value.
 * @param onClick - Called when the row is clicked to select it.
 * @param label - The primary option label.
 * @param description - A brief description shown after the label.
 * @returns A `<button>` styled as a radio option row.
 */
function RadioOption({
  selected,
  onClick,
  label,
  description,
  ...rest
}: {
  selected: boolean
  onClick: () => void
  label: string
  description: string
  'data-qqq-id'?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-ring',
        selected
          ? 'bg-primary/10 border border-primary/30'
          : 'border border-transparent hover:bg-accent'
      )}
      {...rest}
    >
      <div
        className={cn(
          'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          selected ? 'border-primary' : 'border-muted-foreground/40'
        )}
      >
        {selected && <div className="h-2 w-2 rounded-full bg-primary" />}
      </div>
      <div className="flex-1 min-w-0">
        <span className={cn('text-sm font-medium', selected ? 'text-foreground' : 'text-foreground')}>
          {label}
        </span>
        <span className="ml-2 text-xs text-muted-foreground">{description}</span>
      </div>
    </button>
  )
}

/**
 * A card-style toggle button used for selecting between two mutually exclusive view modes.
 *
 * Displays a bold label and a muted description. Applies a highlighted border
 * with primary tinting when selected, and a neutral border otherwise.
 *
 * @param selected - Whether this card is the currently selected option.
 * @param onClick - Called when the card is clicked to select it.
 * @param label - The card's primary label (e.g. "Table", "Cards").
 * @param description - A short description of the view mode.
 * @returns A `<button>` styled as a selectable card.
 */
function ToggleCard({
  selected,
  onClick,
  label,
  description,
  ...rest
}: {
  selected: boolean
  onClick: () => void
  label: string
  description: string
  'data-qqq-id'?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 rounded-lg px-4 py-3 text-left transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-ring',
        selected
          ? 'bg-primary/10 border-2 border-primary/40'
          : 'border-2 border-border hover:bg-accent'
      )}
      {...rest}
    >
      <div className="text-sm font-medium text-foreground">{label}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
    </button>
  )
}
