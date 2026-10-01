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

/** @file Basic-mode quick filters for a metadata-driven record query. */

'use client'

import { useState } from 'react'

import type { QFilterCriteria, QQueryFilter } from '@/types'
import { useFilterSettings } from '@/lib/context/filter-settings-context'
import { changeCriterionOperator, getOperatorOptions, newCriterionForField, selectedOperatorOption, validateCriterion } from '@/lib/utils/filter-utils'
import { chipHidesOperator, criterionOperatorLabel, criterionValuesString } from '@/lib/utils/filter-display-utils'
import { defaultQuickFilterOperator, quickFilterCriterion, removeQuickFilterCriterion, setQuickFilterCriterion } from '@/lib/utils/quick-filter-utils'

import { FilterValueInput, type FilterField } from './FilterBuilder'
import { HintTooltip } from './HintTooltip'

interface QuickFilterBarProps {
  fields: FilterField[]
  allFields: FilterField[]
  defaultFieldNames: string[]
  customFieldNames: string[]
  filter: QQueryFilter
  onChange: (filter: QQueryFilter) => void
  onCustomFieldsChange: (fields: string[]) => void
  onOpenAdvanced: () => void
}

/**
 * Basic-mode filters share the advanced builder's operator catalog and typed value controls.
 *
 * @param props - Metadata, filter state, and update callbacks.
 * @returns The quick-filter chips and active editor.
 */
export function QuickFilterBar(props: QuickFilterBarProps) {
  const { fields, allFields, defaultFieldNames, customFieldNames, filter, onChange, onCustomFieldsChange, onOpenAdvanced } = props
  const { weekday } = useFilterSettings()
  const [openField, setOpenField] = useState<string | null>(null)
  const current = fields.find((field) => field.name === openField)
  const available = allFields.filter((field) => !fields.some((visible) => visible.name === field.name))

  return (
    <div className="space-y-2" data-qqq-id="quick-filter-bar">
      <div className="flex flex-wrap items-center gap-2">
        {fields.map((field) => {
          const state = quickFilterCriterion(filter, field.name, field, { weekday })
          const values = state.kind === 'criterion' ? criterionValuesString(field, state.criterion, undefined, 1, '+N') : ''
          const operator = state.kind === 'criterion' && !chipHidesOperator(state.criterion)
            ? criterionOperatorLabel(field, state.criterion, { weekday }) : ''
          const summary = [operator, values].filter(Boolean).join(' ')
          const isDefault = defaultFieldNames.includes(field.name)
          const canDismiss = state.kind === 'criterion' || !isDefault
          return (
            <HintTooltip key={field.name} content={state.kind === 'tooComplex' ? 'This condition needs Advanced mode.' : ''}
              data-qqq-id={`quick-filter-hint-${field.name}`}>
              <span className="group inline-flex min-h-11 items-center rounded-full border border-input text-sm text-foreground hover:bg-accent focus-within:ring-2 focus-within:ring-ring">
                <button type="button" aria-expanded={openField === field.name}
                  onClick={() => setOpenField(openField === field.name ? null : field.name)}
                  className="min-h-11 rounded-full px-3 py-1.5 focus:outline-none"
                  data-qqq-id={`quick-filter-${field.name}`}>
                  {field.label}{summary ? `: ${summary}` : ''}
                </button>
                {canDismiss && (
                  <button type="button" aria-label={isDefault ? `Clear ${field.label} quick filter` : `Remove ${field.label} quick filter`}
                    onClick={() => {
                      onChange(removeQuickFilterCriterion(filter, field.name))
                      if (!isDefault) onCustomFieldsChange(customFieldNames.filter((name) => name !== field.name))
                      if (openField === field.name) setOpenField(null)
                    }}
                    className="mr-1.5 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus:opacity-100 focus:outline-none group-hover:opacity-100"
                    data-qqq-id={`quick-filter-dismiss-${field.name}`}>
                    <span aria-hidden="true">×</span>
                  </button>
                )}
              </span>
            </HintTooltip>
          )
        })}
        {available.length > 0 && (
          <select aria-label="Add quick filter" value=""
            onChange={(event) => {
              const fieldName = event.target.value
              if (!fieldName) return
              onCustomFieldsChange([...customFieldNames, fieldName])
              setOpenField(fieldName)
            }}
            className="min-h-11 rounded border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            data-qqq-id="quick-filter-add">
            <option value="">Add quick filter</option>
            {available.map((field) => <option key={field.name} value={field.name}>{field.label}</option>)}
          </select>
        )}
      </div>
      {current && (
        <QuickFilterEditor key={current.name} field={current} filter={filter}
          onApply={(criterion) => { onChange(setQuickFilterCriterion(filter, criterion)); setOpenField(null) }}
          onClear={() => { onChange(removeQuickFilterCriterion(filter, current.name)); setOpenField(null) }}
          onRemove={!defaultFieldNames.includes(current.name) ? () => {
            onChange(removeQuickFilterCriterion(filter, current.name))
            onCustomFieldsChange(customFieldNames.filter((name) => name !== current.name))
            setOpenField(null)
          } : undefined}
          onOpenAdvanced={onOpenAdvanced}
          onClose={() => setOpenField(null)} />
      )}
    </div>
  )
}

interface QuickFilterEditorProps {
  field: FilterField
  filter: QQueryFilter
  onApply: (criterion: QFilterCriteria) => void
  onClear: () => void
  onRemove?: () => void
  onOpenAdvanced: () => void
  onClose: () => void
}

/**
 * Edits one quick filter before applying its complete criterion.
 *
 * @param props - Field metadata, current filter, and editor actions.
 * @returns The editor controls.
 */
function QuickFilterEditor(props: QuickFilterEditorProps) {
  const { field, filter, onApply, onClear, onRemove, onOpenAdvanced, onClose } = props
  const { weekday } = useFilterSettings()
  const existing = quickFilterCriterion(filter, field.name, field, { weekday })
  const [draft, setDraft] = useState<QFilterCriteria>(() => {
    if (existing.kind === 'criterion') return existing.criterion
    const first = newCriterionForField(field.name, field)
    const preferred = defaultQuickFilterOperator(field, { weekday })
    return preferred ? changeCriterionOperator(first, undefined, preferred) : first
  })
  const [booleanChosen, setBooleanChosen] = useState(field.type !== 'BOOLEAN' || existing.kind === 'criterion')
  const options = getOperatorOptions(field, { weekday })
  const selected = selectedOperatorOption(options, draft)
  const valid = validateCriterion(draft)

  if (existing.kind === 'tooComplex') return (
    <div className="rounded-lg border border-border bg-card p-3 text-sm" data-qqq-id={`quick-filter-editor-${field.name}`}>
      This condition needs Advanced mode.
      <button type="button" onClick={onOpenAdvanced} className="ml-2 underline">Open Advanced</button>
    </div>
  )

  return (
    <div role="group" aria-label={`${field.label} quick filter`} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3"
      data-qqq-id={`quick-filter-editor-${field.name}`}>
      <span className="text-sm font-medium">{field.label}</span>
      <select aria-label={`Operator for ${field.label}`} value={booleanChosen ? selected.id : ''}
        onChange={(event) => {
          const next = options.find((option) => option.id === event.target.value)
          if (next) {
            setDraft(changeCriterionOperator(draft, booleanChosen ? selected : undefined, next))
            setBooleanChosen(true)
          }
        }}
        className="min-h-11 rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        data-qqq-id={`quick-filter-operator-${field.name}`}>
        {field.type === 'BOOLEAN' && <option value="" disabled>Select condition</option>}
        {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
      {selected.valueMode !== 'none' && !selected.implicitValues && (
        <FilterValueInput field={field} valueMode={selected.valueMode} values={draft.values}
          onChange={(values) => setDraft({ ...draft, values })} depth={3} index={0} />
      )}
      <button type="button" disabled={!valid.valid || !booleanChosen} onClick={() => onApply(draft)}
        className="min-h-11 rounded bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50"
        data-qqq-id={`quick-filter-apply-${field.name}`}>Apply quick filter</button>
      {existing.kind === 'criterion' && <button type="button" onClick={onClear} className="min-h-11 px-2 text-sm underline">Clear filter</button>}
      {onRemove && <button type="button" onClick={onRemove} className="min-h-11 px-2 text-sm underline">Remove quick filter</button>}
      <button type="button" onClick={onClose} className="min-h-11 px-2 text-sm underline">Cancel</button>
    </div>
  )
}
