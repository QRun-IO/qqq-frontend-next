'use client'

// FilterBuilder — advanced filter UI with recursive group support
// Supports possible value fields via async combobox search

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
import { fetchTablePossibleValues } from '@/lib/api/possible-values'

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

/** Subset of QFieldMetaData used throughout FilterBuilder */
type FilterField = Pick<QFieldMetaData, 'name' | 'label' | 'type' | 'possibleValueSourceName'>

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
  const fields: FilterField[] = Object.values(tableMetaData.fields)
    .filter((f) => !f.isHidden && !f.isHeavy)
    .map((f) => ({
      name: f.name,
      label: f.label,
      type: f.type,
      possibleValueSourceName: f.possibleValueSourceName,
    }))

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
  fields: FilterField[]
  onChange: (updated: QQueryFilter) => void
  depth: number
  tableName: string
}

function FilterGroup({ filter, fields, onChange, depth, tableName }: FilterGroupProps) {
  const indent = depth > 0 ? 'ml-4 border-l-2 border-blue-200 pl-3' : ''

  // Stable ID generation for criteria rows to avoid React reconciliation bugs with index keys
  const criteriaIdCounterRef = useRef(0)
  const criteriaIdMapRef = useRef(new WeakMap<QFilterCriteria, string>())

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

  const getSubFilterKey = useCallback((subFilter: QQueryFilter): string => {
    const existing = subFilterIdMapRef.current.get(subFilter)
    if (existing) return existing
    const id = `subfilter-${depth}-${subFilterIdCounterRef.current++}`
    subFilterIdMapRef.current.set(subFilter, id)
    return id
  }, [depth])

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
  fields: FilterField[]
  onChange: (updated: QFilterCriteria) => void
  onRemove: () => void
  depth: number
  tableName: string
}

function CriteriaRow({ index, criterion, fields, onChange, onRemove, depth, tableName }: CriteriaRowProps) {
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
// Detects possibleValueSourceName and renders a combobox when present
// ------------------------------------------------------------------

interface FilterValueInputProps {
  field: FilterField
  operator: QCriteriaOperator
  values: string[]
  onChange: (values: string[]) => void
  depth: number
  index: number
  tableName: string
}

function FilterValueInput({ field, operator, values, onChange, depth, index, tableName }: FilterValueInputProps) {
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
}

// ------------------------------------------------------------------
// PossibleValueSingleSelect — async combobox for single-value filter
// ------------------------------------------------------------------

interface PossibleValueSingleSelectProps {
  tableName: string
  fieldName: string
  fieldLabel: string
  value: string
  onChange: (value: string) => void
  'data-qqq-id'?: string
}

function PossibleValueSingleSelect({
  tableName,
  fieldName,
  fieldLabel,
  value,
  onChange,
  'data-qqq-id': dataId,
}: PossibleValueSingleSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [options, setOptions] = useState<QPossibleValue[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState<string>('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchOptions = useCallback(
    async (term: string) => {
      // Abort any in-flight request to prevent stale responses from overwriting newer results
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      const controller = new AbortController()
      abortControllerRef.current = controller

      setIsLoading(true)
      try {
        const results = await fetchTablePossibleValues(tableName, fieldName, {
          searchTerm: term || undefined,
        })
        // Only apply results if this request was not aborted
        if (!controller.signal.aborted) {
          setOptions(results)
        }
      } catch {
        if (!controller.signal.aborted) {
          setOptions([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    },
    [tableName, fieldName]
  )

  const debouncedFetch = useCallback(
    (term: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => fetchOptions(term), 300)
    },
    [fetchOptions]
  )

  // Fetch on open
  useEffect(() => {
    if (isOpen) {
      fetchOptions(searchTerm)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Clean up debounce and abort controller on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (abortControllerRef.current) abortControllerRef.current.abort()
    }
  }, [])

  const handleSelect = (option: QPossibleValue) => {
    onChange(String(option.id))
    setSelectedLabel(option.label)
    setIsOpen(false)
    setSearchTerm('')
  }

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
        className="flex min-w-[180px] cursor-pointer items-center justify-between rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
        data-qqq-id={dataId ? `${dataId}-combobox` : undefined}
      >
        <span className={`flex-1 truncate ${displayText ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>
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
              className="rounded p-0.5 text-gray-400 hover:text-gray-600 focus:outline-none"
              aria-label={`Clear ${fieldLabel} filter value`}
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
        </div>
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 min-w-[220px] rounded border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="border-b border-gray-200 p-1.5 dark:border-gray-700">
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                debouncedFetch(e.target.value)
              }}
              placeholder="Search..."
              className="w-full rounded border border-gray-200 bg-gray-50 px-2 py-1 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              aria-label={`Search ${fieldLabel} options`}
            />
          </div>
          <ul
            role="listbox"
            aria-label={`${fieldLabel} options`}
            className="max-h-44 overflow-y-auto"
          >
            {isLoading ? (
              <li className="flex items-center justify-center py-3 text-sm text-gray-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Loading...
              </li>
            ) : options.length === 0 ? (
              <li className="py-3 text-center text-sm text-gray-500 dark:text-gray-400">
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
                    className={`flex cursor-pointer items-center justify-between px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      isSelected ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-blue-600" aria-hidden="true" />}
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

interface PossibleValueMultiSelectProps {
  tableName: string
  fieldName: string
  fieldLabel: string
  values: string[]
  onChange: (values: string[]) => void
  'data-qqq-id'?: string
}

function PossibleValueMultiSelect({
  tableName,
  fieldName,
  fieldLabel,
  values,
  onChange,
  'data-qqq-id': dataId,
}: PossibleValueMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [options, setOptions] = useState<QPossibleValue[]>([])
  const [isLoading, setIsLoading] = useState(false)
  // Map of value id -> label for display in tags
  const [labelMap, setLabelMap] = useState<Record<string, string>>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchOptions = useCallback(
    async (term: string) => {
      // Abort any in-flight request to prevent stale responses from overwriting newer results
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      const controller = new AbortController()
      abortControllerRef.current = controller

      setIsLoading(true)
      try {
        const results = await fetchTablePossibleValues(tableName, fieldName, {
          searchTerm: term || undefined,
        })
        // Only apply results if this request was not aborted
        if (!controller.signal.aborted) {
          setOptions(results)
          // Update label map with fetched options
          setLabelMap((prev) => {
            const next = { ...prev }
            for (const opt of results) {
              next[String(opt.id)] = opt.label
            }
            return next
          })
        }
      } catch {
        if (!controller.signal.aborted) {
          setOptions([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    },
    [tableName, fieldName]
  )

  const debouncedFetch = useCallback(
    (term: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => fetchOptions(term), 300)
    },
    [fetchOptions]
  )

  // Fetch on open
  useEffect(() => {
    if (isOpen) {
      fetchOptions(searchTerm)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Clean up debounce and abort controller on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (abortControllerRef.current) abortControllerRef.current.abort()
    }
  }, [])

  const handleToggleValue = (option: QPossibleValue) => {
    const id = String(option.id)
    setLabelMap((prev) => ({ ...prev, [id]: option.label }))
    if (values.includes(id)) {
      onChange(values.filter((v) => v !== id))
    } else {
      onChange([...values, id])
    }
  }

  const handleRemoveValue = (id: string) => {
    onChange(values.filter((v) => v !== id))
  }

  return (
    <div ref={containerRef} className="relative" data-qqq-id={dataId}>
      <div
        className="flex min-w-[200px] flex-wrap items-center gap-1 rounded border border-gray-300 bg-white p-1 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 cursor-pointer"
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
            className="flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-200"
          >
            {labelMap[val] ?? val}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleRemoveValue(val)
              }}
              className="text-blue-600 hover:text-blue-900 focus:outline-none"
              aria-label={`Remove ${labelMap[val] ?? val}`}
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        ))}
        {values.length === 0 && (
          <span className="px-1 text-sm text-gray-400">Select values...</span>
        )}
        <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 min-w-[220px] rounded border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="border-b border-gray-200 p-1.5 dark:border-gray-700">
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                debouncedFetch(e.target.value)
              }}
              placeholder="Search..."
              className="w-full rounded border border-gray-200 bg-gray-50 px-2 py-1 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
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
              <li className="flex items-center justify-center py-3 text-sm text-gray-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Loading...
              </li>
            ) : options.length === 0 ? (
              <li className="py-3 text-center text-sm text-gray-500 dark:text-gray-400">
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
                    className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      isSelected ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                    }`}
                  >
                    <div
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        isSelected
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" aria-hidden="true" />}
                    </div>
                    <span className="truncate text-gray-700 dark:text-gray-300">{option.label}</span>
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
