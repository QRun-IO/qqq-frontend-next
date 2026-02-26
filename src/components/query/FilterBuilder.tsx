'use client'

// FilterBuilder — advanced filter UI with recursive group support

import React, { useState, useCallback } from 'react'
import { Plus, Trash2, PlusCircle } from 'lucide-react'

import type {
  QTableMetaData,
  QQueryFilter,
  QFilterCriteria,
  QCriteriaOperator,
  QFieldType,
} from '@/types'
import {
  OPERATOR_CONFIG,
  getOperatorsForFieldType,
  getDefaultOperatorForFieldType,
  emptyFilter,
} from '@/lib/utils/filter-utils'

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

interface FilterBuilderProps {
  tableMetaData: QTableMetaData
  filter: QQueryFilter
  onChange: (filter: QQueryFilter) => void
  onClose?: () => void
}

// ------------------------------------------------------------------
// Main component
// ------------------------------------------------------------------

export function FilterBuilder({ tableMetaData, filter, onChange, onClose }: FilterBuilderProps) {
  const fields = Object.values(tableMetaData.fields).filter((f) => !f.isHidden && !f.isHeavy)

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

      <div className="flex items-center justify-between border-t border-gray-200 pt-3 dark:border-gray-700">
        <button
          type="button"
          onClick={() => {
            onChange(emptyFilter(filter.limit))
          }}
          className="text-sm text-gray-500 underline hover:text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          data-qqq-id="button-clear-filter"
        >
          Clear all
        </button>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

interface FilterGroupProps {
  filter: QQueryFilter
  fields: ReturnType<typeof Object.values<{ name: string; label: string; type: QFieldType }>>
  onChange: (updated: QQueryFilter) => void
  depth: number
  tableName: string
}

function FilterGroup({ filter, fields, onChange, depth }: FilterGroupProps) {
  const indent = depth > 0 ? 'ml-4 border-l-2 border-blue-200 pl-3' : ''

  const addCriterion = () => {
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
  }

  const addSubFilter = () => {
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
  }

  const updateCriterion = (index: number, updated: QFilterCriteria) => {
    const criteria = [...filter.criteria]
    criteria[index] = updated
    onChange({ ...filter, criteria })
  }

  const removeCriterion = (index: number) => {
    const criteria = filter.criteria.filter((_, i) => i !== index)
    onChange({ ...filter, criteria })
  }

  const updateSubFilter = (index: number, updated: QQueryFilter) => {
    const subs = [...(filter.subFilters ?? [])]
    subs[index] = updated
    onChange({ ...filter, subFilters: subs })
  }

  const removeSubFilter = (index: number) => {
    const subs = (filter.subFilters ?? []).filter((_, i) => i !== index)
    onChange({ ...filter, subFilters: subs })
  }

  return (
    <div className={`flex flex-col gap-2 ${indent}`}>
      {/* Boolean operator selector */}
      {(filter.criteria.length > 1 || (filter.subFilters ?? []).length > 0) && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Match</span>
          <select
            value={filter.booleanOperator}
            onChange={(e) =>
              onChange({ ...filter, booleanOperator: e.target.value as 'AND' | 'OR' })
            }
            className="rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
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
          key={idx}
          index={idx}
          criterion={criterion}
          fields={fields}
          onChange={(updated) => updateCriterion(idx, updated)}
          onRemove={() => removeCriterion(idx)}
          depth={depth}
        />
      ))}

      {/* Sub-filter groups */}
      {(filter.subFilters ?? []).map((sub, idx) => (
        <div key={idx} className="relative">
          <FilterGroup
            filter={sub}
            fields={fields}
            onChange={(updated) => updateSubFilter(idx, updated)}
            depth={depth + 1}
            tableName=""
          />
          <button
            type="button"
            onClick={() => removeSubFilter(idx)}
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-gray-400 shadow hover:text-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:bg-gray-900"
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
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          data-qqq-id={`filter-add-criterion-${depth}`}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add condition
        </button>

        {depth < 2 && (
          <button
            type="button"
            onClick={addSubFilter}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            data-qqq-id={`filter-add-group-${depth}`}
          >
            <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
            Add group
          </button>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------
// CriteriaRow — single filter condition row
// ------------------------------------------------------------------

interface CriteriaRowProps {
  index: number
  criterion: QFilterCriteria
  fields: ReturnType<typeof Object.values<{ name: string; label: string; type: QFieldType }>>
  onChange: (updated: QFilterCriteria) => void
  onRemove: () => void
  depth: number
}

function CriteriaRow({ index, criterion, fields, onChange, onRemove, depth }: CriteriaRowProps) {
  const selectedField = fields.find((f) => f.name === criterion.fieldName) ?? fields[0]
  const fieldType = selectedField?.type ?? 'STRING'
  const availableOps = getOperatorsForFieldType(fieldType)

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
        className="min-w-[140px] rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
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
        className="min-w-[160px] rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
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
          values={criterion.values as string[]}
          onChange={(values) => onChange({ ...criterion, values })}
          depth={depth}
          index={index}
        />
      )}

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        className="flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        aria-label={`Remove filter condition ${index + 1}`}
        data-qqq-id={`filter-remove-${depth}-${index}`}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}

// ------------------------------------------------------------------
// FilterValueInput — type-appropriate value input
// ------------------------------------------------------------------

interface FilterValueInputProps {
  field: { name: string; label: string; type: QFieldType }
  operator: QCriteriaOperator
  values: string[]
  onChange: (values: string[]) => void
  depth: number
  index: number
}

function FilterValueInput({ field, operator, values, onChange, depth, index }: FilterValueInputProps) {
  const config = OPERATOR_CONFIG[operator]

  if (config.valueCount === 'none') return null

  // BETWEEN / NOT_BETWEEN: two inputs
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
        <span className="text-sm text-gray-500">and</span>
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

  // IN / NOT_IN: tag-style multi-value input
  if (config.valueCount === 'multiple') {
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

  // Boolean: select True/False
  if (field.type === 'BOOLEAN') {
    return (
      <select
        value={values[0] ?? ''}
        onChange={(e) => onChange([e.target.value])}
        className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
        aria-label={`Filter value for ${field.label}`}
        data-qqq-id={`filter-value-${depth}-${index}`}
      >
        <option value="">Select...</option>
        <option value="true">True</option>
        <option value="false">False</option>
      </select>
    )
  }

  // Single value
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
}

// ------------------------------------------------------------------
// TypedInput — renders appropriate <input> based on field type
// ------------------------------------------------------------------

interface TypedInputProps {
  fieldType: QFieldType
  value: string
  onChange: (value: string) => void
  placeholder?: string
  'aria-label'?: string
  'data-qqq-id'?: string
}

function TypedInput({
  fieldType,
  value,
  onChange,
  placeholder,
  'aria-label': ariaLabel,
  'data-qqq-id': dataId,
}: TypedInputProps) {
  const baseClass =
    'rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800'

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

interface TagInputProps {
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  'aria-label'?: string
  'data-qqq-id'?: string
}

function TagInput({
  values,
  onChange,
  placeholder,
  'aria-label': ariaLabel,
  'data-qqq-id': dataId,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('')

  const addTag = (raw: string) => {
    const trimmed = raw.trim()
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed])
    }
    setInputValue('')
  }

  const removeTag = (index: number) => {
    onChange(values.filter((_, i) => i !== index))
  }

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
      className="flex min-w-[200px] flex-wrap items-center gap-1 rounded border border-gray-300 bg-white p-1 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
      data-qqq-id={dataId}
    >
      {values.map((tag, i) => (
        <span
          key={i}
          className="flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-200"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(i)}
            className="text-blue-600 hover:text-blue-900 focus:outline-none"
            aria-label={`Remove ${tag}`}
          >
            ×
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
