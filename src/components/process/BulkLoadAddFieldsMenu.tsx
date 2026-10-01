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
 * @file BulkLoadAddFieldsMenu — the bulk load mapping screen's "Add Fields" menu, following the
 * Material dashboard's QHierarchyAutoComplete there: every field of the table, grouped by table
 * (the main table, then each associated child table), searchable, fields already mapped disabled
 * (child fields in a WIDE layout can be added again and again), each with a tooltip, and the
 * menu stays open to add several fields.
 */

'use client'

import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

import type { BulkLoadMapping, BulkLoadTableStructure } from './bulk-load-models'

/** Tooltip for a field that can be added once. */
export const ADD_SINGLE_FIELD_TOOLTIP = 'Click to add this field to your mapping.'
/** Tooltip for a WIDE-layout child field that can be added repeatedly. */
export const ADD_MANY_FIELD_TOOLTIP = 'Click to add this field to your mapping as many times as you need.'
/** Tooltip for a field that is already mapped. */
export const ALREADY_ADDED_FIELD_TOOLTIP = 'This field has already been added to your mapping.'

/** One field in the menu. */
export interface AddFieldOption {
  /** Qualified field name (`field` or `association.field`). */
  name: string
  label: string
  disabled: boolean
  tooltip: string
}

/** One table's fields in the menu. */
export interface AddFieldGroup {
  label: string
  /** Association path, or `''` for the main table. */
  path: string
  options: AddFieldOption[]
}

/**
 * The menu's groups for a mapping: every field of the main table and of each associated table
 * the layout allows (to-many child tables need a TALL or WIDE layout).
 * @param mapping - The mapping on screen.
 * @returns Groups in table-structure order.
 */
export function addFieldGroups(mapping: BulkLoadMapping): AddFieldGroup[] {
  const active = mapping.activeFields()
  const groups: AddFieldGroup[] = []
  const visit = (table: BulkLoadTableStructure) => {
    const path = table.isMain ? '' : table.associationPath ?? ''
    const allowed = table.isMain || !table.isMany || mapping.layout !== 'FLAT'
    if (allowed) {
      const options = (table.fields ?? []).map((field): AddFieldOption => {
        const name = path ? `${path}.${field.name}` : field.name
        const repeatable = mapping.layout === 'WIDE' && Boolean(table.isMany)
        const mapped = active.some((candidate) => candidate.getQualifiedName() === name)
        const disabled = mapped && !repeatable
        return { name, label: field.label ?? field.name, disabled, tooltip: disabled ? ALREADY_ADDED_FIELD_TOOLTIP : repeatable ? ADD_MANY_FIELD_TOOLTIP : ADD_SINGLE_FIELD_TOOLTIP }
      })
      if (options.length > 0) groups.push({ label: table.label, path, options })
    }
    for (const association of table.associations ?? []) visit(association)
  }
  visit(mapping.tableStructure)
  return groups
}

/** Props for {@link BulkLoadAddFieldsMenu}. */
export interface BulkLoadAddFieldsMenuProps {
  mapping: BulkLoadMapping
  disabled: boolean
  /** Add the field with this qualified name to the mapping. */
  onAdd: (qualifiedName: string) => void
}

/**
 * Render the Add Fields button and its searchable, grouped field list.
 * @param props - {@link BulkLoadAddFieldsMenuProps}
 * @returns The menu.
 */
export function BulkLoadAddFieldsMenu({ mapping, disabled, onAdd }: BulkLoadAddFieldsMenuProps) {
  const baseId = useId()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [activeName, setActiveName] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const groups = useMemo(() => addFieldGroups(mapping), [mapping])
  const term = search.trim().toLowerCase()
  const visibleGroups = useMemo(() => groups
    .map((group) => ({ ...group, options: group.options.filter((option) => !term || option.label.toLowerCase().includes(term) || group.label.toLowerCase().includes(term)) }))
    .filter((group) => group.options.length > 0), [groups, term])
  const enabledOptions = visibleGroups.flatMap((group) => group.options.filter((option) => !option.disabled))
  const showGroupHeaders = groups.length > 1
  const optionId = (name: string) => `${baseId}-option-${name.replace(/[^\w-]/g, '_')}`

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])

  /**
   * Add a field and keep the menu open for more.
   * @param option - The field.
   */
  const add = (option: AddFieldOption) => {
    if (option.disabled) return
    onAdd(option.name)
    setActiveName(option.name)
  }

  /**
   * Keyboard handling of the search field: arrows move through the enabled fields, Enter adds, Escape closes.
   * @param event - Key event.
   */
  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (enabledOptions.length === 0) return
      const index = enabledOptions.findIndex((option) => option.name === activeName)
      const next = event.key === 'ArrowDown' ? Math.min(index + 1, enabledOptions.length - 1) : Math.max(index - 1, 0)
      setActiveName(enabledOptions[index < 0 ? 0 : next].name)
      document.getElementById(optionId(enabledOptions[index < 0 ? 0 : next].name))?.scrollIntoView({ block: 'nearest' })
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const option = enabledOptions.find((candidate) => candidate.name === activeName) ?? (enabledOptions.length === 1 ? enabledOptions[0] : undefined)
      if (option) add(option)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      buttonRef.current?.focus()
    }
  }

  return (
    <div ref={containerRef} className="relative inline-block" data-qqq-id="bulk-load-add-fields">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => { setOpen((previous) => !previous); setSearch(''); setActiveName(null) }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        data-qqq-id="button-bulk-load-add-fields"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add Fields
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover p-2 shadow-sm" data-qqq-id="bulk-load-add-fields-menu">
          <label htmlFor={`${baseId}-search`} className="sr-only">Search fields</label>
          <input
            ref={searchRef}
            id={`${baseId}-search`}
            type="search"
            role="combobox"
            autoComplete="off"
            aria-expanded="true"
            aria-controls={`${baseId}-listbox`}
            aria-activedescendant={activeName ? optionId(activeName) : undefined}
            value={search}
            placeholder="Search Fields"
            onChange={(event) => { setSearch(event.target.value); setActiveName(null) }}
            onKeyDown={onSearchKeyDown}
            className="mb-2 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            data-qqq-id="input-bulk-load-add-fields-search"
          />
          <span id={`${baseId}-tip-single`} hidden>{ADD_SINGLE_FIELD_TOOLTIP}</span>
          <span id={`${baseId}-tip-many`} hidden>{ADD_MANY_FIELD_TOOLTIP}</span>
          <span id={`${baseId}-tip-added`} hidden>{ALREADY_ADDED_FIELD_TOOLTIP}</span>
          <div id={`${baseId}-listbox`} role="listbox" aria-label="Fields to add" className="max-h-72 overflow-y-auto">
            {visibleGroups.length === 0 && <p className="px-2 py-2 text-sm italic text-muted-foreground">No options found.</p>}
            {visibleGroups.map((group) => (
              <div key={group.path || 'main'} role="group" aria-labelledby={showGroupHeaders ? `${baseId}-group-${group.path || 'main'}` : undefined} aria-label={showGroupHeaders ? undefined : group.label}
                data-qqq-id={`bulk-load-add-fields-group-${group.path || 'main'}`}>
                {showGroupHeaders && (
                  <div id={`${baseId}-group-${group.path || 'main'}`} role="presentation" className="px-2 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{group.label}</div>
                )}
                {group.options.map((option) => (
                  <div
                    key={option.name}
                    id={optionId(option.name)}
                    role="option"
                    aria-selected={false}
                    aria-disabled={option.disabled || undefined}
                    aria-describedby={`${baseId}-tip-${option.disabled ? 'added' : option.tooltip === ADD_MANY_FIELD_TOOLTIP ? 'many' : 'single'}`}
                    title={option.tooltip}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => add(option)}
                    className={cn(
                      'flex cursor-pointer items-center rounded px-2 py-1.5 text-sm pointer-coarse:min-h-11',
                      showGroupHeaders && 'pl-5',
                      option.disabled ? 'cursor-default text-muted-foreground opacity-60' : 'text-popover-foreground hover:bg-accent',
                      activeName === option.name && !option.disabled && 'bg-accent ring-2 ring-inset ring-ring'
                    )}
                    data-qqq-id={`bulk-load-add-field-${option.name}`}
                  >
                    {option.label}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
