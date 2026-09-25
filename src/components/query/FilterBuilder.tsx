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
 * @file FilterBuilder — advanced filter UI with recursive AND/OR group support. Offers base-table
 * and exposed-join fields, Material's per-type operator lists, typed value inputs, relative date
 * expressions and async possible-value comboboxes.
 */

'use client'

import React, { useState, useCallback, useRef, useMemo, useId } from 'react'
import { Plus, Trash2, PlusCircle, Check, ChevronDown, Loader2, X, CalendarClock } from 'lucide-react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { useQuery } from '@tanstack/react-query'

import type {
  QTableMetaData,
  QQueryFilter,
  QFilterCriteria,
  QFieldMetaData,
  QPossibleValue,
  ExpressionTimeUnit,
} from '@/types'
import {
  emptyFilter,
  getOperatorOptions,
  selectedOperatorOption,
  newCriterionForField,
  isFilterExpression,
  describeExpression,
  utcToLocalDateTimeInput,
  type CriteriaValue,
  type FilterExpression,
  type OperatorOption,
} from '@/lib/utils/filter-utils'
import { fetchTablePossibleValues } from '@/lib/api/possible-values'
import { useAsyncCombobox } from '@/lib/hooks/use-async-combobox'
import { queryKeys } from '@/lib/query-client'

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

/** A field offered in the filter's field selector (base table or exposed join). */
export interface FilterField {
  /** Name used in criteria: `field` or `joinTable.field`. */
  name: string
  /** Label shown in the selector; join fields read "Join: Field". */
  label: string
  /** Field type. */
  type: QFieldMetaData['type']
  /** Possible value source, when the field has one. */
  possibleValueSourceName?: string
  /** Table that owns the field (for possible-value lookups). */
  tableName: string
  /** Field name within its owning table. */
  tableFieldName: string
  /** Group heading, "{Table} Fields". */
  group: string
}

/**
 * Lists the filterable fields for a table: visible base fields, then the fields of each
 * readable exposed join, as Material's field autocomplete offers them.
 *
 * @param tableMetaData - The base table.
 * @returns Filterable fields in display order.
 */
export function buildFilterFields(tableMetaData: QTableMetaData): FilterField[] {
  const usable = (f: QFieldMetaData) => !f.isHidden && (!f.isHeavy || f.type === 'BLOB')
  const byLabel = (a: QFieldMetaData, b: QFieldMetaData) => a.label.localeCompare(b.label)
  const fields: FilterField[] = Object.values(tableMetaData.fields)
    .filter(usable)
    .sort(byLabel)
    .map((f) => ({
      name: f.name, label: f.label, type: f.type, possibleValueSourceName: f.possibleValueSourceName,
      tableName: tableMetaData.name, tableFieldName: f.name, group: `${tableMetaData.label} Fields`,
    }))
  for (const join of tableMetaData.exposedJoins ?? []) {
    const joinTable = join.joinTable
    if (!joinTable?.fields || joinTable.readPermission === false) continue
    const joinLabel = join.label || joinTable.label
    for (const f of Object.values(joinTable.fields).filter(usable).sort(byLabel)) {
      fields.push({
        name: `${joinTable.name}.${f.name}`, label: `${joinLabel}: ${f.label}`, type: f.type,
        possibleValueSourceName: f.possibleValueSourceName, tableName: joinTable.name, tableFieldName: f.name,
        group: `${joinTable.label} Fields`,
      })
    }
  }
  return fields
}

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
 * @param props - Component properties.
 * @returns The rendered filter builder panel.
 */
export function FilterBuilder({ tableMetaData, filter, onChange, onClose }: FilterBuilderProps) {
  const fields = useMemo(() => buildFilterFields(tableMetaData), [tableMetaData])

  return (
    <div className="flex flex-col gap-3 p-4" data-qqq-id="filter-builder">
      <FilterGroup filter={filter} fields={fields} onChange={onChange} depth={0} />

      <div className="flex items-center justify-between border-t border-border pt-3">
        <button
          type="button"
          onClick={() => onChange({ ...emptyFilter(filter.limit), orderBys: filter.orderBys })}
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
  /** The filter state for this group. */
  filter: QQueryFilter
  /** Available filterable fields. */
  fields: FilterField[]
  /** Callback invoked when this group's filter state changes. */
  onChange: (updated: QQueryFilter) => void
  /** Nesting depth (0 = root group). Sub-groups are capped at depth 2. */
  depth: number
}

/**
 * Renders one AND/OR group of filter criteria with nested sub-group support.
 */
const FilterGroup = React.memo(function FilterGroup({ filter, fields, onChange, depth }: FilterGroupProps) {
  const indent = depth > 0 ? 'ml-4 border-l-2 border-primary/20 pl-3' : ''

  const criteriaIdCounterRef = useRef(0)
  const criteriaIdMapRef = useRef(new WeakMap<QFilterCriteria, string>())
  /**
   * Stable React key per criterion object.
   *
   * @param criterion - The criterion.
   * @returns Its key.
   */
  const getCriterionKey = useCallback((criterion: QFilterCriteria): string => {
    const existing = criteriaIdMapRef.current.get(criterion)
    if (existing) return existing
    const id = `criterion-${depth}-${criteriaIdCounterRef.current++}`
    criteriaIdMapRef.current.set(criterion, id)
    return id
  }, [depth])

  const subFilterIdCounterRef = useRef(0)
  const subFilterIdMapRef = useRef(new WeakMap<QQueryFilter, string>())
  /**
   * Stable React key per sub-filter object.
   *
   * @param subFilter - The sub-filter.
   * @returns Its key.
   */
  const getSubFilterKey = useCallback((subFilter: QQueryFilter): string => {
    const existing = subFilterIdMapRef.current.get(subFilter)
    if (existing) return existing
    const id = `subfilter-${depth}-${subFilterIdCounterRef.current++}`
    subFilterIdMapRef.current.set(subFilter, id)
    return id
  }, [depth])

  const addCriterion = useCallback(() => {
    const firstField = fields[0]
    if (!firstField) return
    onChange({ ...filter, criteria: [...filter.criteria, newCriterionForField(firstField.name, firstField)] })
  }, [fields, filter, onChange])

  const addSubFilter = useCallback(() => {
    const sub: QQueryFilter = { criteria: [], orderBys: [], subFilters: [], booleanOperator: 'AND', skip: 0, limit: 0 }
    onChange({ ...filter, subFilters: [...(filter.subFilters ?? []), sub] })
  }, [filter, onChange])

  const updateCriterion = useCallback((index: number, updated: QFilterCriteria) => {
    const criteria = [...filter.criteria]
    // keep the row's React key, so editing a value does not remount the row (and lose focus)
    criteriaIdMapRef.current.set(updated, getCriterionKey(criteria[index]))
    criteria[index] = updated
    onChange({ ...filter, criteria })
  }, [filter, onChange, getCriterionKey])

  const removeCriterion = useCallback((index: number) => {
    onChange({ ...filter, criteria: filter.criteria.filter((_, i) => i !== index) })
  }, [filter, onChange])

  const updateSubFilter = useCallback((index: number, updated: QQueryFilter) => {
    const subFilters = [...(filter.subFilters ?? [])]
    subFilterIdMapRef.current.set(updated, getSubFilterKey(subFilters[index]))
    subFilters[index] = updated
    onChange({ ...filter, subFilters })
  }, [filter, onChange, getSubFilterKey])

  const removeSubFilter = useCallback((index: number) => {
    onChange({ ...filter, subFilters: (filter.subFilters ?? []).filter((_, i) => i !== index) })
  }, [filter, onChange])

  return (
    <div className={`flex flex-col gap-2 ${indent}`} data-qqq-id={`filter-group-${depth}`}>
      {(filter.criteria.length > 1 || (filter.subFilters ?? []).length > 0) && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Match</span>
          <select
            value={filter.booleanOperator}
            onChange={(e) => {
              const op = e.target.value
              if (op === 'AND' || op === 'OR') onChange({ ...filter, booleanOperator: op })
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

      {filter.criteria.map((criterion, idx) => (
        <CriteriaRow
          key={getCriterionKey(criterion)}
          index={idx}
          criterion={criterion}
          fields={fields}
          onChange={(updated) => updateCriterion(idx, updated)}
          onRemove={() => removeCriterion(idx)}
          depth={depth}
        />
      ))}

      {(filter.subFilters ?? []).map((sub, idx) => (
        <div key={getSubFilterKey(sub)} className="relative">
          <FilterGroup filter={sub} fields={fields} onChange={(updated) => updateSubFilter(idx, updated)} depth={depth + 1} />
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
  /** Display index of this row within its group. */
  index: number
  /** The criterion this row represents. */
  criterion: QFilterCriteria
  /** Available filterable fields. */
  fields: FilterField[]
  /** Callback invoked when the criterion changes. */
  onChange: (updated: QFilterCriteria) => void
  /** Callback invoked when the user removes the row. */
  onRemove: () => void
  /** Nesting depth, used in data-qqq-id attributes. */
  depth: number
}

/**
 * Number of values an operator option keeps when switching to it.
 *
 * @param option - The option.
 * @returns The count, or undefined for "any number".
 */
function requiredValueCount(option: OperatorOption): number | undefined {
  return option.valueMode === 'none' ? 0 : option.valueMode === 'single' ? 1 : option.valueMode === 'double' ? 2 : undefined
}

/**
 * A single filter condition row: field, operator, value input(s) and a remove button.
 * Changing to a field of a different type (or possible value source) resets the operator
 * and values, as in Material; otherwise the operator and values are kept.
 */
export const CriteriaRow = React.memo(function CriteriaRow({ index, criterion, fields, onChange, onRemove, depth }: CriteriaRowProps) {
  const selectedField = fields.find((f) => f.name === criterion.fieldName)
  const options = selectedField ? getOperatorOptions(selectedField) : []
  const selected = selectedOperatorOption(options, criterion)
  const allOptions = options.some((o) => o.id === selected.id) ? options : [...options, selected]
  const groups = useMemo(() => {
    const byGroup = new Map<string, FilterField[]>()
    for (const f of fields) byGroup.set(f.group, [...(byGroup.get(f.group) ?? []), f])
    return [...byGroup.entries()]
  }, [fields])

  const handleFieldChange = (fieldName: string) => {
    const field = fields.find((f) => f.name === fieldName)
    if (!field) return
    const sameKind = selectedField && selectedField.type === field.type && selectedField.possibleValueSourceName === field.possibleValueSourceName
      && selectedField.tableName === field.tableName
    onChange(sameKind ? { ...criterion, fieldName } : newCriterionForField(fieldName, field))
  }

  const handleOperatorChange = (optionId: string) => {
    const next = allOptions.find((o) => o.id === optionId)
    if (!next) return
    let values: CriteriaValue[] = next.implicitValues ? [...next.implicitValues] : selected.implicitValues ? [] : criterion.values.filter((v) => v !== null)
    const count = next.implicitValues ? undefined : requiredValueCount(next)
    if (count !== undefined && values.length > count) values = values.slice(0, count)
    onChange({ ...criterion, operator: next.operator, values })
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-qqq-id={`filter-row-${depth}-${index}`}>
      <select
        value={selectedField ? criterion.fieldName : ''}
        onChange={(e) => handleFieldChange(e.target.value)}
        className="min-w-[140px] rounded border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
        aria-label="Filter field"
        data-qqq-id={`filter-field-${depth}-${index}`}
      >
        {!selectedField && <option value="">{criterion.fieldName} (unavailable)</option>}
        {groups.length === 1
          ? groups[0][1].map((f) => <option key={f.name} value={f.name}>{f.label}</option>)
          : groups.map(([group, groupFields]) => (
            <optgroup key={group} label={group}>
              {groupFields.map((f) => <option key={f.name} value={f.name}>{f.label}</option>)}
            </optgroup>
          ))}
      </select>

      <select
        value={selected.id}
        onChange={(e) => handleOperatorChange(e.target.value)}
        className="min-w-[160px] rounded border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
        aria-label="Filter operator"
        data-qqq-id={`filter-operator-${depth}-${index}`}
      >
        {allOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>

      {selectedField && selected.valueMode !== 'none' && !selected.implicitValues && (
        <FilterValueInput
          field={selectedField}
          valueMode={selected.valueMode}
          values={criterion.values}
          onChange={(values) => onChange({ ...criterion, values })}
          depth={depth}
          index={index}
        />
      )}

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
// ------------------------------------------------------------------

/**
 * Props for the FilterValueInput component.
 */
interface FilterValueInputProps {
  /** The field being filtered. */
  field: FilterField
  /** The operator option's value mode. */
  valueMode: OperatorOption['valueMode']
  /** Current values for this criterion. */
  values: CriteriaValue[]
  /** Callback invoked when the value(s) change. */
  onChange: (values: CriteriaValue[]) => void
  /** Nesting depth, used in data-qqq-id construction. */
  depth: number
  /** Row index within the group, used in data-qqq-id construction. */
  index: number
}

/**
 * Renders the value input widget(s) for a criterion.
 */
const FilterValueInput = React.memo(function FilterValueInput({ field, valueMode, values, onChange, depth, index }: FilterValueInputProps) {
  const hasPossibleValues = Boolean(field.possibleValueSourceName)
  const at = (i: number): CriteriaValue => values[i] ?? ''

  if (valueMode === 'double') {
    return (
      <div className="flex items-center gap-1">
        <SingleValueInput field={field} value={at(0)} onChange={(v) => onChange([v, at(1)])} placeholder="From"
          ariaLabel={`Filter value from for ${field.label}`} dataId={`filter-value-from-${depth}-${index}`} />
        <span className="text-sm text-muted-foreground">and</span>
        <SingleValueInput field={field} value={at(1)} onChange={(v) => onChange([at(0), v])} placeholder="To"
          ariaLabel={`Filter value to for ${field.label}`} dataId={`filter-value-to-${depth}-${index}`} />
      </div>
    )
  }

  if (valueMode === 'multi') {
    const scalars = values.filter((v) => !isFilterExpression(v)).map((v) => String(v))
    if (hasPossibleValues) {
      return (
        <PossibleValueMultiSelect tableName={field.tableName} fieldName={field.tableFieldName} fieldLabel={field.label}
          values={scalars} onChange={onChange} data-qqq-id={`filter-value-${depth}-${index}`} />
      )
    }
    return (
      <TagInput values={scalars} onChange={onChange} placeholder="Add values..."
        aria-label={`Filter values for ${field.label}`} data-qqq-id={`filter-value-${depth}-${index}`} />
    )
  }

  if (hasPossibleValues) {
    return (
      <PossibleValueSingleSelect tableName={field.tableName} fieldName={field.tableFieldName} fieldLabel={field.label}
        value={String(at(0) ?? '')} onChange={(v) => onChange([v])} data-qqq-id={`filter-value-${depth}-${index}`} />
    )
  }

  return (
    <SingleValueInput field={field} value={at(0)} onChange={(v) => onChange([v])} placeholder="Value..."
      ariaLabel={`Filter value for ${field.label}`} dataId={`filter-value-${depth}-${index}`} />
  )
})

// ------------------------------------------------------------------
// SingleValueInput — typed input, with relative expressions for dates
// ------------------------------------------------------------------

/**
 * Props for SingleValueInput.
 */
interface SingleValueInputProps {
  /** The field being filtered. */
  field: FilterField
  /** Current value. */
  value: CriteriaValue
  /** Change callback. */
  onChange: (value: CriteriaValue) => void
  /** Placeholder text. */
  placeholder: string
  /** Accessible label. */
  ariaLabel: string
  /** data-qqq-id for the input. */
  dataId: string
}

/**
 * One typed value. DATE and DATE_TIME fields also accept a relative expression (Material's
 * "Custom Date Filter Condition"), shown as a chip that can be edited or cleared.
 *
 * @param root0 - Component properties.
 * @returns The value input.
 */
function SingleValueInput({ field, value, onChange, placeholder, ariaLabel, dataId }: SingleValueInputProps) {
  const isDate = field.type === 'DATE' || field.type === 'DATE_TIME'
  if (isDate && isFilterExpression(value)) {
    return (
      <span className="flex items-center gap-1 rounded border border-primary/30 bg-primary/5 px-2 py-1 text-sm text-primary" data-qqq-id={`${dataId}-expression`}>
        <span>{describeExpression(value, field.type)}</span>
        <ExpressionEditor fieldType={field.type} fieldLabel={field.label} expression={value} onApply={onChange} dataId={dataId} />
        <button type="button" onClick={() => onChange('')} aria-label={`Clear relative value for ${field.label}`}
          className="rounded p-0.5 hover:text-destructive focus:outline-none focus:ring-1 focus:ring-ring" data-qqq-id={`${dataId}-expression-clear`}>
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      </span>
    )
  }
  const text = isFilterExpression(value) ? '' : String(value ?? '')
  return (
    <span className="flex items-center gap-1">
      <TypedInput
        fieldType={field.type}
        value={field.type === 'DATE_TIME' ? utcToLocalDateTimeInput(text) : text}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={ariaLabel}
        data-qqq-id={dataId}
      />
      {isDate && <ExpressionEditor fieldType={field.type} fieldLabel={field.label} onApply={onChange} dataId={dataId} />}
    </span>
  )
}

/** Expression kinds offered by the relative-date editor. */
type ExpressionKind = 'Now' | 'NowWithOffset' | 'ThisOrLastPeriod'

/**
 * Popover editor for relative date/date-time values: now (today), N units ago/from now,
 * or the start of this/last period. Units follow Material (hours and smaller only for date-times).
 *
 * @param root0 - Component properties.
 * @param root0.fieldType - Field type (DATE or DATE_TIME).
 * @param root0.fieldLabel - Field label.
 * @param root0.expression - Current expression, if any.
 * @param root0.onApply - Receives the chosen expression.
 * @param root0.dataId - data-qqq-id prefix.
 * @returns The editor trigger and popover.
 */
function ExpressionEditor({ fieldType, fieldLabel, expression, onApply, dataId }: {
  fieldType: QFieldMetaData['type']
  fieldLabel: string
  expression?: FilterExpression
  onApply: (expression: FilterExpression) => void
  dataId: string
}) {
  const [open, setOpen] = useState(false)
  const initialKind: ExpressionKind = expression && expression.type !== 'FilterVariableExpression' ? expression.type : 'NowWithOffset'
  const [kind, setKind] = useState<ExpressionKind>(initialKind)
  const [amount, setAmount] = useState(expression?.type === 'NowWithOffset' ? expression.amount : 1)
  const [offsetUnit, setOffsetUnit] = useState<ExpressionTimeUnit>(expression?.type === 'NowWithOffset' ? expression.timeUnit : 'DAYS')
  const [direction, setDirection] = useState<'MINUS' | 'PLUS'>(expression?.type === 'NowWithOffset' ? expression.operator : 'MINUS')
  const [period, setPeriod] = useState<'THIS' | 'LAST'>(expression?.type === 'ThisOrLastPeriod' ? expression.operator : 'THIS')
  const [periodUnit, setPeriodUnit] = useState<ExpressionTimeUnit>(expression?.type === 'ThisOrLastPeriod' ? expression.timeUnit : 'DAYS')
  const isDateTime = fieldType === 'DATE_TIME'
  const plural = amount === 1 ? '' : 's'
  const offsetUnits: ExpressionTimeUnit[] = [...(isDateTime ? ['SECONDS', 'MINUTES', 'HOURS'] as ExpressionTimeUnit[] : []), 'DAYS', 'WEEKS', 'MONTHS', 'YEARS']
  const periodUnits: ExpressionTimeUnit[] = [...(isDateTime ? ['HOURS'] as ExpressionTimeUnit[] : []), 'DAYS', 'WEEKS', 'MONTHS', 'YEARS']
  const unitLabel = (unit: ExpressionTimeUnit, suffix: string) => unit.charAt(0) + unit.slice(1, -1).toLowerCase() + suffix
  const selectClass = 'rounded border border-input bg-background px-2 py-1 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring'

  const apply = () => {
    if (kind === 'Now') onApply({ type: 'Now' })
    else if (kind === 'NowWithOffset') onApply({ type: 'NowWithOffset', operator: direction, amount: Math.max(0, Math.trunc(amount) || 0), timeUnit: offsetUnit })
    else onApply({ type: 'ThisOrLastPeriod', operator: period, timeUnit: periodUnit })
    setOpen(false)
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button type="button" aria-label={`Relative ${isDateTime ? 'date-time' : 'date'} for ${fieldLabel}`}
          className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          data-qqq-id={`${dataId}-relative`}>
          <CalendarClock className="h-4 w-4" aria-hidden="true" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align="start" sideOffset={4} className="z-[200] w-80 rounded-lg border border-border bg-popover p-4 text-sm shadow-md"
          role="dialog" aria-label="Custom date filter condition" data-qqq-id="filter-expression-editor">
          <p className="mb-3 font-semibold text-foreground">Custom {isDateTime ? 'date-time' : 'date'} condition</p>
          <fieldset className="space-y-3">
            <legend className="sr-only">Expression type</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name={`${dataId}-kind`} checked={kind === 'Now'} onChange={() => setKind('Now')} />
              {isDateTime ? 'Now' : 'Today'}
            </label>
            <div>
              <label className="flex items-center gap-2">
                <input type="radio" name={`${dataId}-kind`} checked={kind === 'NowWithOffset'} onChange={() => setKind('NowWithOffset')} />
                Relative expression
              </label>
              <div className="mt-1 flex items-center gap-1 pl-6">
                <input type="number" min={0} value={amount} onChange={(e) => { setAmount(Number(e.target.value)); setKind('NowWithOffset') }}
                  className={`${selectClass} w-16`} aria-label="Amount" />
                <select value={offsetUnit} onChange={(e) => { setOffsetUnit(e.target.value as ExpressionTimeUnit); setKind('NowWithOffset') }} className={selectClass} aria-label="Offset unit">
                  {offsetUnits.map((u) => <option key={u} value={u}>{unitLabel(u, plural)}</option>)}
                </select>
                <select value={direction} onChange={(e) => { setDirection(e.target.value as 'MINUS' | 'PLUS'); setKind('NowWithOffset') }} className={selectClass} aria-label="Direction">
                  <option value="MINUS">ago</option>
                  <option value="PLUS">from now</option>
                </select>
              </div>
            </div>
            <div>
              <label className="flex items-center gap-2">
                <input type="radio" name={`${dataId}-kind`} checked={kind === 'ThisOrLastPeriod'} onChange={() => setKind('ThisOrLastPeriod')} />
                {isDateTime ? 'Start of this or last...' : 'This or last...'}
              </label>
              <div className="mt-1 flex items-center gap-1 pl-6">
                <select value={period} onChange={(e) => { setPeriod(e.target.value as 'THIS' | 'LAST'); setKind('ThisOrLastPeriod') }} className={selectClass} aria-label="This or last">
                  <option value="THIS">This</option>
                  <option value="LAST">Last</option>
                </select>
                <select value={periodUnit} onChange={(e) => { setPeriodUnit(e.target.value as ExpressionTimeUnit); setKind('ThisOrLastPeriod') }} className={selectClass} aria-label="Period unit">
                  {periodUnits.map((u) => <option key={u} value={u}>{unitLabel(u, '')}</option>)}
                </select>
              </div>
            </div>
          </fieldset>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded border border-input px-3 py-1 hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring"
              data-qqq-id="filter-expression-cancel">Cancel</button>
            <button type="button" onClick={apply} className="rounded bg-primary px-3 py-1 font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
              data-qqq-id="filter-expression-apply">Apply</button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

// ------------------------------------------------------------------
// Possible value comboboxes
// ------------------------------------------------------------------

/**
 * Resolves labels for already-selected possible value ids (from a URL or saved view).
 *
 * @param tableName - Table owning the field.
 * @param fieldName - Field with the possible value source.
 * @param ids - Selected ids.
 * @returns A map from id to label.
 */
function useSelectedLabels(tableName: string, fieldName: string, ids: string[]): Record<string, string> {
  const key = ids.filter(Boolean).join(',')
  const { data } = useQuery({
    queryKey: [...queryKeys.tablePossibleValues(tableName, fieldName), 'ids', key],
    queryFn: () => fetchTablePossibleValues(tableName, fieldName, { ids: key }),
    enabled: key.length > 0,
    staleTime: 5 * 60 * 1000,
  })
  return useMemo(() => Object.fromEntries((data ?? []).map((o) => [String(o.id), o.label])), [data])
}

/**
 * Props for the PossibleValueSingleSelect component.
 */
interface PossibleValueSingleSelectProps {
  tableName: string
  fieldName: string
  fieldLabel: string
  value: string
  onChange: (value: string) => void
  'data-qqq-id'?: string
}

/**
 * Async searchable combobox for single-value criteria on possible-value fields.
 *
 * @param root0 - Component properties.
 * @returns The combobox.
 */
function PossibleValueSingleSelect({ tableName, fieldName, fieldLabel, value, onChange, 'data-qqq-id': dataId }: PossibleValueSingleSelectProps) {
  const [selectedLabel, setSelectedLabel] = useState<string>('')
  const listboxId = useId()
  const resolved = useSelectedLabels(tableName, fieldName, value ? [value] : [])
  const { isOpen, setIsOpen, searchTerm, setSearchTerm, options, isLoading, containerRef, inputRef, debouncedFetch } = useAsyncCombobox({ tableName, fieldName })

  const handleSelect = (option: QPossibleValue) => {
    onChange(String(option.id))
    setSelectedLabel(option.label)
    setIsOpen(false)
    setSearchTerm('')
  }

  const displayText = (value && (selectedLabel || resolved[value])) || (value ? String(value) : '')

  return (
    <div ref={containerRef} className="relative" data-qqq-id={dataId}>
      <div
        role="combobox"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Filter value for ${fieldLabel}`}
        aria-controls={listboxId}
        onClick={() => {
          setIsOpen((o) => !o)
          if (!isOpen) setTimeout(() => inputRef.current?.focus(), 50)
        }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 50) } }}
        className="flex min-w-[180px] cursor-pointer items-center justify-between rounded border border-input bg-background px-2 py-1.5 text-sm focus-within:border-primary focus-within:ring-1 focus-within:ring-ring focus:outline-none focus:ring-1 focus:ring-ring"
        data-qqq-id={dataId ? `${dataId}-combobox` : undefined}
      >
        <span className={`flex-1 truncate ${displayText ? 'text-foreground' : 'text-muted-foreground'}`}>{displayText || 'Select...'}</span>
        <div className="flex items-center gap-0.5">
          {displayText && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onChange(''); setSelectedLabel(''); setSearchTerm('') }}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground focus:outline-none" aria-label={`Clear ${fieldLabel} filter value`}>
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        </div>
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 min-w-[220px] rounded border border-border bg-popover shadow-sm">
          <div className="border-b border-border p-1.5">
            <input ref={inputRef} type="text" value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); debouncedFetch(e.target.value) }}
              placeholder="Search..."
              className="w-full rounded border border-border bg-muted px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label={`Search ${fieldLabel} options`} />
          </div>
          <ul id={listboxId} role="listbox" aria-label={`${fieldLabel} options`} className="max-h-44 overflow-y-auto">
            {isLoading ? (
              <li className="flex items-center justify-center py-3 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />Loading...</li>
            ) : options.length === 0 ? (
              <li className="py-3 text-center text-sm text-muted-foreground">No options found</li>
            ) : (
              options.map((option) => {
                const isSelected = String(value) === String(option.id)
                return (
                  <li key={String(option.id)} role="option" aria-selected={isSelected} onClick={() => handleSelect(option)}
                    className={`flex cursor-pointer items-center justify-between px-3 py-1.5 text-sm hover:bg-accent ${isSelected ? 'bg-primary/5 text-primary' : 'text-popover-foreground'}`}>
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

/**
 * Props for the PossibleValueMultiSelect component.
 */
interface PossibleValueMultiSelectProps {
  tableName: string
  fieldName: string
  fieldLabel: string
  values: string[]
  onChange: (values: string[]) => void
  'data-qqq-id'?: string
}

/**
 * Async searchable multi-select combobox for "is any of" / "is none of" on possible-value fields.
 *
 * @param root0 - Component properties.
 * @returns The combobox.
 */
function PossibleValueMultiSelect({ tableName, fieldName, fieldLabel, values, onChange, 'data-qqq-id': dataId }: PossibleValueMultiSelectProps) {
  const [labelMap, setLabelMap] = useState<Record<string, string>>({})
  const listboxId = useId()
  const resolved = useSelectedLabels(tableName, fieldName, values)
  const { isOpen, setIsOpen, searchTerm, setSearchTerm, options, isLoading, containerRef, inputRef, debouncedFetch } = useAsyncCombobox({
    tableName,
    fieldName,
    onOptionsFetched: (results) => {
      setLabelMap((prev) => {
        const next = { ...prev }
        for (const opt of results) next[String(opt.id)] = opt.label
        return next
      })
    },
  })
  const labelOf = (id: string) => labelMap[id] ?? resolved[id] ?? id

  const handleToggleValue = (option: QPossibleValue) => {
    const id = String(option.id)
    setLabelMap((prev) => ({ ...prev, [id]: option.label }))
    onChange(values.includes(id) ? values.filter((v) => v !== id) : [...values, id])
  }

  return (
    <div ref={containerRef} className="relative" data-qqq-id={dataId}>
      <div
        className="flex min-w-[200px] cursor-pointer flex-wrap items-center gap-1 rounded border border-input bg-background p-1 focus-within:border-primary focus-within:ring-1 focus-within:ring-ring focus:outline-none focus:ring-1 focus:ring-ring"
        onClick={() => { setIsOpen((o) => !o); if (!isOpen) setTimeout(() => inputRef.current?.focus(), 50) }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 50) } }}
        role="combobox"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Filter values for ${fieldLabel}`}
        aria-controls={listboxId}
      >
        {values.map((val) => (
          <span key={val} className="flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary" data-qqq-id="filter-value-chip">
            {labelOf(val)}
            <button type="button" onClick={(e) => { e.stopPropagation(); onChange(values.filter((v) => v !== val)) }}
              className="text-primary hover:text-primary/70 focus:outline-none" aria-label={`Remove ${labelOf(val)}`}>
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        ))}
        {values.length === 0 && <span className="px-1 text-sm text-muted-foreground">Select values...</span>}
        <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 min-w-[220px] rounded border border-border bg-popover shadow-sm">
          <div className="border-b border-border p-1.5">
            <input ref={inputRef} type="text" value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); debouncedFetch(e.target.value) }}
              placeholder="Search..."
              className="w-full rounded border border-border bg-muted px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label={`Search ${fieldLabel} options`} onClick={(e) => e.stopPropagation()} />
          </div>
          <ul id={listboxId} role="listbox" aria-label={`${fieldLabel} options`} aria-multiselectable="true" className="max-h-44 overflow-y-auto">
            {isLoading ? (
              <li className="flex items-center justify-center py-3 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />Loading...</li>
            ) : options.length === 0 ? (
              <li className="py-3 text-center text-sm text-muted-foreground">No options found</li>
            ) : (
              options.map((option) => {
                const isSelected = values.includes(String(option.id))
                return (
                  <li key={String(option.id)} role="option" aria-selected={isSelected}
                    onClick={(e) => { e.stopPropagation(); handleToggleValue(option) }}
                    className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent ${isSelected ? 'bg-primary/5' : ''}`}>
                    <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background'}`}>
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
  fieldType: QFieldMetaData['type']
  value: string
  onChange: (value: string) => void
  placeholder?: string
  'aria-label'?: string
  'data-qqq-id'?: string
}

/**
 * Renders the HTML input for a QQQ field type (date, datetime-local, time, number or text).
 *
 * @param root0 - Component properties.
 * @returns The input.
 */
function TypedInput({ fieldType, value, onChange, placeholder, 'aria-label': ariaLabel, 'data-qqq-id': dataId }: TypedInputProps) {
  const baseClass = 'rounded border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring'
  const common = { value, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value), placeholder, 'aria-label': ariaLabel, 'data-qqq-id': dataId }
  if (fieldType === 'DATE') return <input type="date" {...common} className={`${baseClass} w-36`} />
  if (fieldType === 'DATE_TIME') return <input type="datetime-local" {...common} className={`${baseClass} w-48`} />
  if (fieldType === 'TIME') return <input type="time" {...common} className={`${baseClass} w-28`} />
  if (fieldType === 'INTEGER' || fieldType === 'LONG' || fieldType === 'DECIMAL') {
    return <input type="number" step={fieldType === 'DECIMAL' ? 'any' : 1} {...common} className={`${baseClass} w-32`} />
  }
  return <input type="text" {...common} className={`${baseClass} min-w-[160px]`} />
}

// ------------------------------------------------------------------
// TagInput — comma-separated multi-value input
// ------------------------------------------------------------------

/**
 * Props for the TagInput component.
 */
interface TagInputProps {
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  'aria-label'?: string
  'data-qqq-id'?: string
}

/**
 * Inline tag input for multi-value criteria without a possible value source. Enter or comma
 * adds a value; pasting several lines or comma-separated values adds each one.
 *
 * @param root0 - Component properties.
 * @returns The tag input.
 */
function TagInput({ values, onChange, placeholder, 'aria-label': ariaLabel, 'data-qqq-id': dataId }: TagInputProps) {
  const [inputValue, setInputValue] = useState('')

  const addTags = (raw: string) => {
    const next = [...values]
    for (const piece of raw.split(/[\n,]/)) {
      const trimmed = piece.trim()
      if (trimmed && !next.includes(trimmed)) next.push(trimmed)
    }
    if (next.length !== values.length) onChange(next)
    setInputValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTags(inputValue)
    } else if (e.key === 'Backspace' && !inputValue && values.length > 0) {
      onChange(values.slice(0, -1))
    }
  }

  return (
    <div className="flex min-w-[200px] flex-wrap items-center gap-1 rounded border border-input bg-background p-1 focus-within:border-primary focus-within:ring-1 focus-within:ring-ring" data-qqq-id={dataId}>
      {values.map((tag, i) => (
        <span key={`${tag}-${i}`} className="flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary" data-qqq-id="filter-value-chip">
          {tag}
          <button type="button" onClick={() => onChange(values.filter((_, idx) => idx !== i))} className="text-primary hover:text-primary/70 focus:outline-none" aria-label={`Remove ${tag}`}>
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={(e) => {
          const text = e.clipboardData.getData('text')
          if (/[\n,]/.test(text)) { e.preventDefault(); addTags(text) }
        }}
        onBlur={() => inputValue && addTags(inputValue)}
        placeholder={values.length === 0 ? placeholder : 'Add more...'}
        className="min-w-[80px] flex-1 bg-transparent text-sm outline-none"
        aria-label={ariaLabel}
      />
    </div>
  )
}
