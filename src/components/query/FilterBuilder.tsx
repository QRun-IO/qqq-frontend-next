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
 * @file FilterBuilder — advanced filter UI with recursive AND/OR group support. Renders filter criteria rows, nested sub-filter groups, and async possible-value comboboxes.
 */

'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Plus, Trash2, PlusCircle, Check, ChevronDown, Loader2, X } from 'lucide-react'

import type {
  QTableMetaData,
  QQueryFilter,
  QFilterCriteria,
  QCriteriaOperator,
  QFieldType,
  QFieldMetaData,
  QPossibleValue,
} from '@/types'
import {
  OPERATOR_CONFIG,
  getOperatorsForFieldType,
  getDefaultOperatorForFieldType,
  emptyFilter,
} from '@/lib/utils/filter-utils'
import { useAsyncCombobox } from '@/lib/hooks/use-async-combobox'

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

/** Subset of QFieldMetaData used throughout FilterBuilder — only the fields needed for building filter UI. */
type FilterField = Pick<QFieldMetaData, 'name' | 'label' | 'type' | 'possibleValueSourceName'>

/**
 * Props for the FilterBuilder component.
 */
interface FilterBuilderProps {
  /** Full table metadata providing the field list for filter field selectors. */
  tableMetaData: QTableMetaData
  /** The current filter state (criteria, sub-filters, boolean operator). */
  filter: QQueryFilter
  /** Callback invoked whenever the filter state changes. */
  onChange: (filter: QQueryFilter) => void
  /** Optional callback for the Apply button; when omitted the Apply button is hidden. */
  onClose?: () => void
}

// ------------------------------------------------------------------
// Main component
// ------------------------------------------------------------------

/**
 * Advanced filter builder panel for the QQQ Record Query page.
 *
 * Renders the root FilterGroup along with "Clear all" and "Apply" buttons.
 * Hidden and heavy fields are excluded from the field selector.
 *
 * @param props - Component properties.
 * @returns The rendered filter builder panel.
 */
export function FilterBuilder({ tableMetaData, filter, onChange, onClose }: FilterBuilderProps) {
  const fields: FilterField[] = Object.values(tableMetaData.fields)
    .filter((f) => !f.isHidden && !f.isHeavy)
    .map((f) => ({
      name: f.name,
      label: f.label,
      type: f.type,
      possibleValueSourceName: f.possibleValueSourceName,
    }))

  /**
   * Stable wrapper around `onChange` passed down to FilterGroup.
   *
   * @param updated - The new filter state produced by the child group.
   */
  const handleFilterChange = useCallback(
    (updated: QQueryFilter) => {
      onChange(updated)
    },
    [onChange]
  )

  return (
    <div className="flex flex-col gap-3 p-4" data-qqq-id="filter-builder">
      <FilterGroup
        filter={filter}
        fields={fields}
        onChange={handleFilterChange}
        depth={0}
        tableName={tableMetaData.name}
      />

      <div className="flex items-center justify-between border-t border-border pt-3">
        <button
          type="button"
          onClick={() => {
            onChange(emptyFilter(filter.limit))
          }}
          className="text-sm text-muted-foreground underline hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          data-qqq-id="button-clear-filter"
        >
          Clear all
        </button>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
            data-qqq-id="button-apply-filter"
          >
            Apply
          </button>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------
// FilterGroup — handles one AND/OR group of criteria + sub-groups
// ------------------------------------------------------------------

/**
 * Props for the FilterGroup component.
 */
interface FilterGroupProps {
  /** The filter state for this group (criteria, sub-filters, boolean operator). */
  filter: QQueryFilter
  /** Available filterable fields for this table. */
  fields: FilterField[]
  /** Callback invoked when this group's filter state changes. */
  onChange: (updated: QQueryFilter) => void
  /** Nesting depth (0 = root group). Sub-groups are indented and capped at depth 2. */
  depth: number
  /** Backend table name passed to async comboboxes for possible-value lookup. */
  tableName: string
}

/**
 * Renders one AND/OR group of filter criteria with nested sub-group support.
 *
 * Shows a boolean operator selector when there are multiple conditions, a list of
 * CriteriaRow items, zero or more nested FilterGroup sub-groups, and add/remove controls.
 * Stable keys for criteria and sub-filters are maintained via WeakMap refs to avoid
 * React reconciliation bugs with index-based keys.
 *
 * @param filter - Filter state for this group.
 * @param fields - Filterable fields to populate the field selector in each criterion row.
 * @param onChange - Callback invoked when this group's state changes.
 * @param depth - Nesting depth used for indentation and the "Add group" cap (max 2).
 * @param tableName - Passed to async comboboxes for possible-value searching.
 */
const FilterGroup = React.memo(function FilterGroup({ filter, fields, onChange, depth, tableName }: FilterGroupProps) {
  const indent = depth > 0 ? 'ml-4 border-l-2 border-primary/20 pl-3' : ''

  // Stable ID generation for criteria rows to avoid React reconciliation bugs with index keys
  const criteriaIdCounterRef = useRef(0)
  const criteriaIdMapRef = useRef(new WeakMap<QFilterCriteria, string>())

  /**
   * Returns a stable string key for a criterion object, creating one on first access.
   *
   * Uses a WeakMap to generate stable React `key` props for each criterion row.
   * This prevents React from reconciling array items by index when criteria are
   * inserted or deleted mid-edit, which would cause focus loss and incorrect
   * field-value associations in the rendered rows. Keys survive re-renders
   * without mutating the criterion objects themselves.
   *
   * @param criterion - The filter criterion to look up or register.
   * @returns A stable unique key string (e.g. `"criterion-0-3"`).
   */
  const getCriterionKey = useCallback((criterion: QFilterCriteria): string => {
    const existing = criteriaIdMapRef.current.get(criterion)
    if (existing) return existing
    const id = `criterion-${depth}-${criteriaIdCounterRef.current++}`
    criteriaIdMapRef.current.set(criterion, id)
    return id
  }, [depth])

  // Same for sub-filters
  const subFilterIdCounterRef = useRef(0)
  const subFilterIdMapRef = useRef(new WeakMap<QQueryFilter, string>())

  /**
   * Returns a stable string key for a sub-filter object, creating one on first access.
   *
   * @param subFilter - The nested QQueryFilter to look up or register.
   * @returns A stable unique key string.
   */
  const getSubFilterKey = useCallback((subFilter: QQueryFilter): string => {
    const existing = subFilterIdMapRef.current.get(subFilter)
    if (existing) return existing
    const id = `subfilter-${depth}-${subFilterIdCounterRef.current++}`
    subFilterIdMapRef.current.set(subFilter, id)
    return id
  }, [depth])

  /**
   * Appends a new blank criterion using the first available field and its default operator.
   */
  const addCriterion = useCallback(() => {
    const firstField = fields[0]
    if (!firstField) return
    const newCriterion: QFilterCriteria = {
      fieldName: firstField.name,
      operator: getDefaultOperatorForFieldType(firstField.type),
      values: [],
    }
    onChange({
      ...filter,
      criteria: [...filter.criteria, newCriterion],
    })
  }, [fields, filter, onChange])

  /**
   * Appends a new empty AND sub-filter group nested within this group.
   */
  const addSubFilter = useCallback(() => {
    const sub: QQueryFilter = {
      criteria: [],
      orderBys: [],
      subFilters: [],
      booleanOperator: 'AND',
      skip: 0,
      limit: 0,
    }
    onChange({
      ...filter,
      subFilters: [...(filter.subFilters ?? []), sub],
    })
  }, [filter, onChange])

  /**
   * Replaces the criterion at `index` with `updated` and propagates the change.
   *
   * @param index - Zero-based index of the criterion to replace.
   * @param updated - The new criterion value.
   */
  const updateCriterion = useCallback((index: number, updated: QFilterCriteria) => {
    const criteria = [...filter.criteria]
    criteria[index] = updated
    onChange({ ...filter, criteria })
  }, [filter, onChange])

  /**
   * Removes the criterion at `index` from this group.
   *
   * @param index - Zero-based index of the criterion to remove.
   */
  const removeCriterion = useCallback((index: number) => {
    const criteria = filter.criteria.filter((_, i) => i !== index)
    onChange({ ...filter, criteria })
  }, [filter, onChange])

  /**
   * Replaces the sub-filter at `index` with `updated` and propagates the change.
   *
   * @param index - Zero-based index of the sub-filter to replace.
   * @param updated - The new sub-filter value.
   */
  const updateSubFilter = useCallback((index: number, updated: QQueryFilter) => {
    const subFilters = [...(filter.subFilters ?? [])]
    subFilters[index] = updated
    onChange({ ...filter, subFilters })
  }, [filter, onChange])

  /**
   * Removes the sub-filter group at `index` from this group.
   *
   * @param index - Zero-based index of the sub-filter to remove.
   */
  const removeSubFilter = useCallback((index: number) => {
    const subFilters = (filter.subFilters ?? []).filter((_, i) => i !== index)
    onChange({ ...filter, subFilters })
  }, [filter, onChange])

  return (
    <div className={`flex flex-col gap-2 ${indent}`}>
      {/* Boolean operator selector */}
      {(filter.criteria.length > 1 || (filter.subFilters ?? []).length > 0) && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Match</span>
          <select
            value={filter.booleanOperator}
            onChange={(e) => {
              const op = e.target.value
              if (op === 'AND' || op === 'OR') {
                onChange({ ...filter, booleanOperator: op })
              }
            }}
            className="rounded border border-input bg-background px-2 py-1 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label="Boolean operator"
            data-qqq-id={`filter-boolean-op-${depth}`}
          >
            <option value="AND">ALL conditions (AND)</option>
            <option value="OR">ANY condition (OR)</option>
          </select>
        </div>
      )}

      {/* Criteria rows */}
      {filter.criteria.map((criterion, idx) => (
        <CriteriaRow
          key={getCriterionKey(criterion)}
          index={idx}
          criterion={criterion}
          fields={fields}
          onChange={(updated) => updateCriterion(idx, updated)}
          onRemove={() => removeCriterion(idx)}
          depth={depth}
          tableName={tableName}
        />
      ))}

      {/* Sub-filter groups */}
      {(filter.subFilters ?? []).map((sub, idx) => (
        <div key={getSubFilterKey(sub)} className="relative">
          <FilterGroup
            filter={sub}
            fields={fields}
            onChange={(updated) => updateSubFilter(idx, updated)}
            depth={depth + 1}
            tableName={tableName}
          />
          <button
            type="button"
            onClick={() => removeSubFilter(idx)}
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-card text-muted-foreground shadow hover:text-destructive focus:outline-none focus:ring-1 focus:ring-destructive"
            aria-label="Remove filter group"
            data-qqq-id={`filter-remove-group-${idx}`}
          >
            <Trash2 className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      ))}

      {/* Add controls */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={addCriterion}
          className="flex items-center gap-1 text-sm text-primary hover:text-primary/90 focus:outline-none focus:ring-1 focus:ring-ring"
          data-qqq-id={`filter-add-criterion-${depth}`}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add condition
        </button>

        {depth < 2 && (
          <button
            type="button"
            onClick={addSubFilter}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            data-qqq-id={`filter-add-group-${depth}`}
          >
            <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
            Add group
          </button>
        )}
      </div>
    </div>
  )
})

// ------------------------------------------------------------------
// CriteriaRow — single filter condition row
// ------------------------------------------------------------------

/**
 * Props for the CriteriaRow component.
 */
interface CriteriaRowProps {
  /** Display index of this row within its group (used for aria labels and data-qqq-id). */
  index: number
  /** The filter criterion state this row represents. */
  criterion: QFilterCriteria
  /** Available filterable fields for the field selector. */
  fields: FilterField[]
  /** Callback invoked when the criterion changes (field, operator, or values). */
  onChange: (updated: QFilterCriteria) => void
  /** Callback invoked when the user clicks the remove button. */
  onRemove: () => void
  /** Nesting depth, used in data-qqq-id attribute construction. */
  depth: number
  /** Backend table name passed through to the value input for possible-value lookups. */
  tableName: string
}

/**
 * A single filter condition row containing a field selector, operator selector, value input(s),
 * and a remove button. Memoized to prevent unnecessary re-renders when sibling rows change.
 *
 * When the selected field changes, the operator is reset to the field type's default and values
 * are cleared. When the operator changes, values are cleared if the new operator takes no values.
 */
const CriteriaRow = React.memo(function CriteriaRow({ index, criterion, fields, onChange, onRemove, depth, tableName }: CriteriaRowProps) {
  const selectedField = fields.find((f) => f.name === criterion.fieldName) ?? fields[0]
  const fieldType = selectedField?.type ?? 'STRING'
  const availableOps = getOperatorsForFieldType(fieldType)

  /**
   * Handles field selector changes by resetting the operator to the new field type's default
   * and clearing all values.
   *
   * @param fieldName - The newly selected field's backend name.
   */
  // When field changes, reset operator and values
  const handleFieldChange = (fieldName: string) => {
    const field = fields.find((f) => f.name === fieldName)
    if (!field) return
    onChange({
      fieldName,
      operator: getDefaultOperatorForFieldType(field.type),
      values: [],
    })
  }

  /**
   * Handles operator selector changes, clearing values when switching to a no-value operator.
   *
   * @param operator - The newly selected filter operator.
   */
  const handleOperatorChange = (operator: QCriteriaOperator) => {
    const config = OPERATOR_CONFIG[operator]
    // Clear values when switching to 'none' operators
    const values = config.valueCount === 'none' ? [] : criterion.values
    onChange({ ...criterion, operator, values })
  }

  const operatorConfig = OPERATOR_CONFIG[criterion.operator]

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-qqq-id={`filter-row-${depth}-${index}`}
    >
      {/* Field selector */}
      <select
        value={criterion.fieldName}
        onChange={(e) => handleFieldChange(e.target.value)}
        className="min-w-[140px] rounded border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
        aria-label="Filter field"
        data-qqq-id={`filter-field-${depth}-${index}`}
      >
        {fields.map((f) => (
          <option key={f.name} value={f.name}>
            {f.label}
          </option>
        ))}
      </select>

      {/* Operator selector */}
      <select
        value={criterion.operator}
        onChange={(e) => handleOperatorChange(e.target.value as QCriteriaOperator)}
        className="min-w-[160px] rounded border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
        aria-label="Filter operator"
        data-qqq-id={`filter-operator-${depth}-${index}`}
      >
        {availableOps.map((op) => (
          <option key={op} value={op}>
            {OPERATOR_CONFIG[op].label}
          </option>
        ))}
      </select>

      {/* Value input(s) */}
      {operatorConfig.valueCount !== 'none' && (
        <FilterValueInput
          field={selectedField ?? fields[0]}
          operator={criterion.operator}
          values={
            Array.isArray(criterion.values) && criterion.values.every((v): v is string => typeof v === 'string')
              ? criterion.values
              : (criterion.values ?? []).map((v) => String(v ?? ''))
          }
          onChange={(values) => onChange({ ...criterion, values })}
          depth={depth}
          index={index}
          tableName={tableName}
        />
      )}

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus:outline-none focus:ring-1 focus:ring-destructive"
        aria-label={`Remove filter condition ${index + 1}`}
        data-qqq-id={`filter-remove-${depth}-${index}`}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
})

// ------------------------------------------------------------------
// FilterValueInput — type-appropriate value input
// Detects possibleValueSourceName and renders a combobox when present
// ------------------------------------------------------------------

/**
 * Props for the FilterValueInput component.
 */
interface FilterValueInputProps {
  /** The field being filtered, used to determine value type and possible-value source. */
  field: FilterField
  /** The currently selected operator, used to determine value count (none/single/range/multiple). */
  operator: QCriteriaOperator
  /** Current string values for this criterion. */
  values: string[]
  /** Callback invoked when the value(s) change. */
  onChange: (values: string[]) => void
  /** Nesting depth, used in data-qqq-id construction. */
  depth: number
  /** Row index within the group, used in data-qqq-id construction. */
  index: number
  /** Backend table name passed to async comboboxes. */
  tableName: string
}

/**
 * Renders the appropriate value input widget for a filter criterion based on the selected operator
 * and field type.
 *
 * - `none` valueCount: renders nothing.
 * - `range` valueCount: two TypedInput widgets (From / To).
 * - `multiple` valueCount: PossibleValueMultiSelect if a possible-value source exists, else TagInput.
 * - BOOLEAN type: a True/False select.
 * - Single value with possible-value source: PossibleValueSingleSelect async combobox.
 * - Single value (all other types): TypedInput with the appropriate HTML input type.
 *
 * Memoized to avoid re-rendering all rows when only one criterion changes.
 */
const FilterValueInput = React.memo(function FilterValueInput({ field, operator, values, onChange, depth, index, tableName }: FilterValueInputProps) {
  const config = OPERATOR_CONFIG[operator]

  if (config.valueCount === 'none') return null

  const hasPossibleValues = Boolean(field.possibleValueSourceName)

  // BETWEEN / NOT_BETWEEN: two inputs (possible values not applicable for range)
  if (config.valueCount === 'range') {
    return (
      <div className="flex items-center gap-1">
        <TypedInput
          fieldType={field.type}
          value={values[0] ?? ''}
          onChange={(v) => onChange([v, values[1] ?? ''])}
          placeholder="From"
          aria-label={`Filter value from for ${field.label}`}
          data-qqq-id={`filter-value-from-${depth}-${index}`}
        />
        <span className="text-sm text-muted-foreground">and</span>
        <TypedInput
          fieldType={field.type}
          value={values[1] ?? ''}
          onChange={(v) => onChange([values[0] ?? '', v])}
          placeholder="To"
          aria-label={`Filter value to for ${field.label}`}
          data-qqq-id={`filter-value-to-${depth}-${index}`}
        />
      </div>
    )
  }

  // IN / NOT_IN: multi-value
  if (config.valueCount === 'multiple') {
    if (hasPossibleValues) {
      return (
        <PossibleValueMultiSelect
          tableName={tableName}
          fieldName={field.name}
          fieldLabel={field.label}
          values={values}
          onChange={onChange}
          data-qqq-id={`filter-value-${depth}-${index}`}
        />
      )
    }

    return (
      <TagInput
        values={values}
        onChange={onChange}
        placeholder={`Add values...`}
        aria-label={`Filter values for ${field.label}`}
        data-qqq-id={`filter-value-${depth}-${index}`}
      />
    )
  }

  // Boolean: select True/False (never uses possible values)
  if (field.type === 'BOOLEAN') {
    return (
      <select
        value={values[0] ?? ''}
        onChange={(e) => onChange([e.target.value])}
        className="rounded border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
        aria-label={`Filter value for ${field.label}`}
        data-qqq-id={`filter-value-${depth}-${index}`}
      >
        <option value="">Select...</option>
        <option value="true">True</option>
        <option value="false">False</option>
      </select>
    )
  }

  // Single value with possible values: combobox
  if (hasPossibleValues) {
    return (
      <PossibleValueSingleSelect
        tableName={tableName}
        fieldName={field.name}
        fieldLabel={field.label}
        value={values[0] ?? ''}
        onChange={(v) => onChange([v])}
        data-qqq-id={`filter-value-${depth}-${index}`}
      />
    )
  }

  // Single value: typed input
  return (
    <TypedInput
      fieldType={field.type}
      value={values[0] ?? ''}
      onChange={(v) => onChange([v])}
      placeholder={`Value...`}
      aria-label={`Filter value for ${field.label}`}
      data-qqq-id={`filter-value-${depth}-${index}`}
    />
  )
})

// ------------------------------------------------------------------
// PossibleValueSingleSelect — async combobox for single-value filter
// ------------------------------------------------------------------

/**
 * Props for the PossibleValueSingleSelect component.
 */
interface PossibleValueSingleSelectProps {
  /** Backend table name used for possible-value API calls. */
  tableName: string
  /** Backend field name used for possible-value API calls. */
  fieldName: string
  /** Human-readable field label for aria attributes and placeholders. */
  fieldLabel: string
  /** Currently selected value ID (as string). */
  value: string
  /** Callback invoked when the user selects a new option. */
  onChange: (value: string) => void
  /** Optional data-qqq-id attribute forwarded to the outer container. */
  'data-qqq-id'?: string
}

/**
 * Async searchable combobox for single-value filter criteria on possible-value fields.
 *
 * Fetches options from the possible-values API as the user types (debounced via
 * `useAsyncCombobox`). Displays the selected option's label using local state and
 * provides a clear button to reset the selection.
 *
 * @param props - Component properties.
 * @returns The rendered single-select combobox.
 */
function PossibleValueSingleSelect({
  tableName,
  fieldName,
  fieldLabel,
  value,
  onChange,
  'data-qqq-id': dataId,
}: PossibleValueSingleSelectProps) {
  const [selectedLabel, setSelectedLabel] = useState<string>('')
  const {
    isOpen,
    setIsOpen,
    searchTerm,
    setSearchTerm,
    options,
    isLoading,
    containerRef,
    inputRef,
    debouncedFetch,
  } = useAsyncCombobox({ tableName, fieldName })

  /**
   * Selects an option, updates the display label, and closes the dropdown.
   *
   * @param option - The chosen possible value.
   */
  const handleSelect = (option: QPossibleValue) => {
    onChange(String(option.id))
    setSelectedLabel(option.label)
    setIsOpen(false)
    setSearchTerm('')
  }

  /**
   * Clears the selected value, label, and search term.
   */
  const handleClear = () => {
    onChange('')
    setSelectedLabel('')
    setSearchTerm('')
  }

  const displayText = selectedLabel || (value ? String(value) : '')

  return (
    <div ref={containerRef} className="relative" data-qqq-id={dataId}>
      <div
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Filter value for ${fieldLabel}`}
        onClick={() => {
          setIsOpen((o) => !o)
          if (!isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50)
          }
        }}
        className="flex min-w-[180px] cursor-pointer items-center justify-between rounded border border-input bg-background px-2 py-1.5 text-sm focus-within:border-primary focus-within:ring-1 focus-within:ring-ring"
        data-qqq-id={dataId ? `${dataId}-combobox` : undefined}
      >
        <span className={`flex-1 truncate ${displayText ? 'text-foreground' : 'text-muted-foreground'}`}>
          {displayText || 'Select...'}
        </span>
        <div className="flex items-center gap-0.5">
          {displayText && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleClear()
              }}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground focus:outline-none"
              aria-label={`Clear ${fieldLabel} filter value`}
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        </div>
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 min-w-[220px] rounded border border-border bg-popover shadow-sm">
          <div className="border-b border-border p-1.5">
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                debouncedFetch(e.target.value)
              }}
              placeholder="Search..."
              className="w-full rounded border border-border bg-muted px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label={`Search ${fieldLabel} options`}
            />
          </div>
          <ul
            role="listbox"
            aria-label={`${fieldLabel} options`}
            className="max-h-44 overflow-y-auto"
          >
            {isLoading ? (
              <li className="flex items-center justify-center py-3 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Loading...
              </li>
            ) : options.length === 0 ? (
              <li className="py-3 text-center text-sm text-muted-foreground">
                No options found
              </li>
            ) : (
              options.map((option) => {
                const isSelected = String(value) === String(option.id)
                return (
                  <li
                    key={String(option.id)}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(option)}
                    className={`flex cursor-pointer items-center justify-between px-3 py-1.5 text-sm hover:bg-accent ${
                      isSelected ? 'bg-primary/5 text-primary' : 'text-popover-foreground'
                    }`}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />}
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------
// PossibleValueMultiSelect — async combobox for multi-value filter (IN/NOT_IN)
// ------------------------------------------------------------------

/**
 * Props for the PossibleValueMultiSelect component.
 */
interface PossibleValueMultiSelectProps {
  /** Backend table name used for possible-value API calls. */
  tableName: string
  /** Backend field name used for possible-value API calls. */
  fieldName: string
  /** Human-readable field label for aria attributes and placeholders. */
  fieldLabel: string
  /** Currently selected value IDs (as strings). */
  values: string[]
  /** Callback invoked when the selection changes. */
  onChange: (values: string[]) => void
  /** Optional data-qqq-id attribute forwarded to the outer container. */
  'data-qqq-id'?: string
}

/**
 * Async searchable multi-select combobox for IN / NOT_IN filter operators on possible-value fields.
 *
 * Displays selected values as removable chips and fetches options from the possible-values API
 * as the user types (debounced). A local `labelMap` caches option labels so chips can display
 * human-readable text after the dropdown is closed.
 *
 * @param props - Component properties.
 * @returns The rendered multi-select combobox.
 */
function PossibleValueMultiSelect({
  tableName,
  fieldName,
  fieldLabel,
  values,
  onChange,
  'data-qqq-id': dataId,
}: PossibleValueMultiSelectProps) {
  // Map of value id -> label for display in tags
  const [labelMap, setLabelMap] = useState<Record<string, string>>({})
  const {
    isOpen,
    setIsOpen,
    searchTerm,
    setSearchTerm,
    options,
    isLoading,
    containerRef,
    inputRef,
    debouncedFetch,
  } = useAsyncCombobox({
    tableName,
    fieldName,
    onOptionsFetched: (results) => {
      setLabelMap((prev) => {
        const next = { ...prev }
        for (const opt of results) {
          next[String(opt.id)] = opt.label
        }
        return next
      })
    },
  })

  /**
   * Toggles an option's membership in the selection and updates the local label cache.
   *
   * @param option - The possible value to add or remove.
   */
  const handleToggleValue = (option: QPossibleValue) => {
    const id = String(option.id)
    setLabelMap((prev) => ({ ...prev, [id]: option.label }))
    if (values.includes(id)) {
      onChange(values.filter((v) => v !== id))
    } else {
      onChange([...values, id])
    }
  }

  /**
   * Removes a single value from the selection by its ID.
   *
   * @param id - The string ID of the value to remove.
   */
  const handleRemoveValue = (id: string) => {
    onChange(values.filter((v) => v !== id))
  }

  return (
    <div ref={containerRef} className="relative" data-qqq-id={dataId}>
      <div
        className="flex min-w-[200px] flex-wrap items-center gap-1 rounded border border-input bg-background p-1 focus-within:border-primary focus-within:ring-1 focus-within:ring-ring cursor-pointer"
        onClick={() => {
          setIsOpen((o) => !o)
          if (!isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50)
          }
        }}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Filter values for ${fieldLabel}`}
      >
        {values.map((val) => (
          <span
            key={val}
            className="flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary"
          >
            {labelMap[val] ?? val}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleRemoveValue(val)
              }}
              className="text-primary hover:text-primary/70 focus:outline-none"
              aria-label={`Remove ${labelMap[val] ?? val}`}
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        ))}
        {values.length === 0 && (
          <span className="px-1 text-sm text-muted-foreground">Select values...</span>
        )}
        <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 min-w-[220px] rounded border border-border bg-popover shadow-sm">
          <div className="border-b border-border p-1.5">
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                debouncedFetch(e.target.value)
              }}
              placeholder="Search..."
              className="w-full rounded border border-border bg-muted px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label={`Search ${fieldLabel} options`}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <ul
            role="listbox"
            aria-label={`${fieldLabel} options`}
            aria-multiselectable="true"
            className="max-h-44 overflow-y-auto"
          >
            {isLoading ? (
              <li className="flex items-center justify-center py-3 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Loading...
              </li>
            ) : options.length === 0 ? (
              <li className="py-3 text-center text-sm text-muted-foreground">
                No options found
              </li>
            ) : (
              options.map((option) => {
                const isSelected = values.includes(String(option.id))
                return (
                  <li
                    key={String(option.id)}
                    role="option"
                    aria-selected={isSelected}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleValue(option)
                    }}
                    className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent ${
                      isSelected ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-input bg-background'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" aria-hidden="true" />}
                    </div>
                    <span className="truncate text-popover-foreground">{option.label}</span>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------
// TypedInput — renders appropriate <input> based on field type
// ------------------------------------------------------------------

/**
 * Props for the TypedInput component.
 */
interface TypedInputProps {
  /** The QQQ field type used to choose the appropriate HTML input type. */
  fieldType: QFieldType
  /** Current string value of the input. */
  value: string
  /** Callback invoked when the input value changes. */
  onChange: (value: string) => void
  /** Optional placeholder text. */
  placeholder?: string
  /** Accessible label forwarded to the input element. */
  'aria-label'?: string
  /** Optional data-qqq-id attribute forwarded to the input element. */
  'data-qqq-id'?: string
}

/**
 * Renders the appropriate HTML `<input>` element for a given QQQ field type.
 *
 * - DATE → `type="date"` (36px wide)
 * - DATE_TIME → `type="datetime-local"` (44px wide)
 * - TIME → `type="time"` (28px wide)
 * - INTEGER / LONG / DECIMAL → `type="number"` (32px wide)
 * - Everything else → `type="text"` (min 160px wide)
 *
 * @param props - Component properties.
 * @returns The rendered input element.
 */
function TypedInput({
  fieldType,
  value,
  onChange,
  placeholder,
  'aria-label': ariaLabel,
  'data-qqq-id': dataId,
}: TypedInputProps) {
  const baseClass =
    'rounded border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring'

  if (fieldType === 'DATE') {
    return (
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${baseClass} w-36`}
        placeholder={placeholder}
        aria-label={ariaLabel}
        data-qqq-id={dataId}
      />
    )
  }

  if (fieldType === 'DATE_TIME') {
    return (
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${baseClass} w-44`}
        placeholder={placeholder}
        aria-label={ariaLabel}
        data-qqq-id={dataId}
      />
    )
  }

  if (fieldType === 'TIME') {
    return (
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${baseClass} w-28`}
        placeholder={placeholder}
        aria-label={ariaLabel}
        data-qqq-id={dataId}
      />
    )
  }

  if (fieldType === 'INTEGER' || fieldType === 'LONG' || fieldType === 'DECIMAL') {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${baseClass} w-32`}
        placeholder={placeholder}
        aria-label={ariaLabel}
        data-qqq-id={dataId}
      />
    )
  }

  // STRING, TEXT, HTML, PASSWORD, etc.
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${baseClass} min-w-[160px]`}
      placeholder={placeholder}
      aria-label={ariaLabel}
      data-qqq-id={dataId}
    />
  )
}

// ------------------------------------------------------------------
// TagInput — comma-separated multi-value input
// ------------------------------------------------------------------

/**
 * Props for the TagInput component.
 */
interface TagInputProps {
  /** Currently selected tag values displayed as chips. */
  values: string[]
  /** Callback invoked when the set of tags changes. */
  onChange: (values: string[]) => void
  /** Placeholder shown on the text input when no tags are present. */
  placeholder?: string
  /** Accessible label forwarded to the underlying text input. */
  'aria-label'?: string
  /** Optional data-qqq-id forwarded to the outer container. */
  'data-qqq-id'?: string
}

/**
 * Inline tag input for multi-value filter criteria without a possible-value source.
 *
 * Values are displayed as removable chips. The user can add a new value by pressing
 * Enter or comma, or by blurring the input. Backspace removes the last tag when the
 * input is empty. Duplicate values are silently ignored.
 *
 * @param props - Component properties.
 * @returns The rendered tag input with chip display.
 */
function TagInput({
  values,
  onChange,
  placeholder,
  'aria-label': ariaLabel,
  'data-qqq-id': dataId,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('')

  /**
   * Trims and adds a raw string value as a new tag, then clears the input.
   * Duplicate or empty values are silently ignored.
   *
   * @param raw - The raw string typed by the user.
   */
  const addTag = (raw: string) => {
    const trimmed = raw.trim()
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed])
    }
    setInputValue('')
  }

  /**
   * Removes the tag at the given index.
   *
   * @param index - Zero-based index of the tag to remove.
   */
  const removeTag = (index: number) => {
    onChange(values.filter((_, i) => i !== index))
  }

  /**
   * Keyboard handler: Enter and comma commit the current input as a new tag;
   * Backspace removes the last tag when the input is empty.
   *
   * @param e - The keyboard event from the text input.
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(inputValue)
    } else if (e.key === 'Backspace' && !inputValue && values.length > 0) {
      onChange(values.slice(0, -1))
    }
  }

  return (
    <div
      className="flex min-w-[200px] flex-wrap items-center gap-1 rounded border border-input bg-background p-1 focus-within:border-primary focus-within:ring-1 focus-within:ring-ring"
      data-qqq-id={dataId}
    >
      {values.map((tag, i) => (
        <span
          key={i}
          className="flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(i)}
            className="text-primary hover:text-primary/70 focus:outline-none"
            aria-label={`Remove ${tag}`}
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => inputValue && addTag(inputValue)}
        placeholder={values.length === 0 ? placeholder : 'Add more...'}
        className="min-w-[80px] flex-1 bg-transparent text-sm outline-none"
        aria-label={ariaLabel}
      />
    </div>
  )
}
