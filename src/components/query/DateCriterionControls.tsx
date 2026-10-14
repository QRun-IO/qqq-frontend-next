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
 * @file DateCriterionControls — the date-first inputs of a filter condition on a DATE or DATE_TIME
 * field: a comparison (on, between, within, before, after), plain date pickers or a relative range
 * ("Last 7 days"), and an "Include time" switch to exact date-times. The pure rules are in
 * `date-range-utils`; the filter builder and the quick filters share these.
 */

'use client'

import { isRestricted } from '@/lib/utils/secured-data'
import React, { useMemo, useRef, useState } from 'react'
import { Globe } from 'lucide-react'

import type { QFieldType, QFilterCriteria } from '@/types'
import { changeCriterionOperator, getOperatorOptions, isCriterionComplete, isWeekdayFunction, type OperatorOptionSettings } from '@/lib/utils/filter-utils'
import {
  DATE_MODE_LABELS,
  RANGE_PRESETS,
  asLastRange,
  criteriaToDateCondition,
  dateConditionToCriteria,
  dateConditionToExactCriterion,
  defaultDateContext,
  describeDateCondition,
  emptyDateCondition,
  exactCriterionToDateCondition,
  formatYmdRange,
  isDateConditionComplete,
  lastRange,
  presetOf,
  rangeDays,
  timeZoneNote,
  type DateCondition,
  type DateContext,
  type DateMode,
  type LastUnit,
} from '@/lib/utils/date-range-utils'

import { HintTooltip } from './HintTooltip'

const RELATIVE_OPTION = 'relative'

const inputClass = 'rounded border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring'

/** The part of a filter field the date controls need. */
export interface DateField {
  accessTier?: 'FULL' | 'MASKED' | 'REVEALABLE'
  /** Name used in criteria. */
  name: string
  /** Label shown. */
  label: string
  /** The field type. */
  type: QFieldType
  /** Possible value source (a field with one is not a plain date). */
  possibleValueSourceName?: string
}

/**
 * Whether a field is filtered with dates.
 *
 * @param field - The field.
 * @returns True for DATE and DATE_TIME fields.
 */
export function isDateField(field: Pick<DateField, 'type' | 'accessTier'> | undefined): boolean {
  return !isRestricted(field) && (field?.type === 'DATE' || field?.type === 'DATE_TIME')
}

interface RowState {
  /** What was picked. */
  condition: DateCondition
  /** Whether the row is on exact date-times, or on something the date controls do not model (a weekday, a relative expression). */
  legacy: boolean
  /** Whether "Include time" is on. */
  includeTime: boolean
  /** The criteria this state corresponds to (to tell edits made here from changes made elsewhere). */
  key: string
}

/**
 * Reads a row's criteria into its date state.
 *
 * @param criteria - The row's criteria.
 * @param fieldType - DATE or DATE_TIME.
 * @param context - Zone and week start.
 * @returns The state: the dates when the criteria are whole days, else exact-value mode.
 */
function initialState(criteria: QFilterCriteria[], fieldType: QFieldType, context: DateContext): RowState {
  const key = JSON.stringify(criteria)
  const parsed = criteriaToDateCondition(criteria, fieldType, context)
  if (parsed) return { condition: parsed, legacy: false, includeTime: false, key }
  const weekday = criteria.some((criterion) => isWeekdayFunction(criterion.fieldFunction))
  return { condition: emptyDateCondition(), legacy: true, includeTime: fieldType === 'DATE_TIME' && !weekday, key }
}

/** What the date controls of one condition need and offer. */
export interface DateRow {
  /** Whether the field is filtered with dates at all. */
  isDate: boolean
  /** Whether the date controls (not the exact-value inputs) are shown. */
  dateMode: boolean
  /** Whether "Include time" applies (DATE_TIME fields, not weekday conditions). */
  canIncludeTime: boolean
  /** Whether "Include time" is on. */
  includeTime: boolean
  /** Switches "Include time". */
  setIncludeTime: (on: boolean) => void
  /** The picked dates. */
  condition: DateCondition
  /** Picks dates; emits the matching criteria. */
  setCondition: (condition: DateCondition) => void
  /** Emits criteria edited as exact values (the Include time and weekday inputs). */
  commitExact: (criteria: QFilterCriteria[]) => void
  /** Moves the row off the date controls onto exact-value inputs (a weekday or relative-expression condition). */
  switchToExact: (criteria: QFilterCriteria[]) => void
  /** Whether the row, off the date controls, can go back to them (a DATE field; DATE_TIME uses "Include time"). */
  canUseDatePicker: boolean
  /** Goes back to the date controls, keeping the dates when the condition has them. */
  useDatePicker: () => void
  /** Zone and week start dates are read with. */
  context: DateContext
  /** Whether the whole row is complete. */
  complete: boolean
}

/**
 * Holds the date-first state of one filter condition (one or two criteria) and keeps it in step
 * with the criteria: what is picked here is written out as criteria, and criteria that change
 * elsewhere (a saved view, a URL) are read back in.
 *
 * @param args - The field, the row's criteria and how to change them.
 * @param args.field - The field the condition is on.
 * @param args.criteria - The row's criteria: one, or a `>=` and a `<` bound.
 * @param args.onChange - Receives the row's new criteria.
 * @param args.enabled - False keeps the exact-value inputs (a report setup, where a value may be a filter variable that a date range cannot take).
 * @returns The row's date state and actions.
 */
export function useDateRow({ field, criteria, onChange, enabled = true }: {
  field: Pick<DateField, 'name' | 'type'> | undefined
  criteria: QFilterCriteria[]
  onChange: (criteria: QFilterCriteria[]) => void
  enabled?: boolean
}): DateRow {
  const isDate = isDateField(field) && enabled
  const type: QFieldType = field?.type ?? 'DATE'
  const context = useMemo(() => defaultDateContext(), [])
  const [state, setState] = useState<RowState>(() => initialState(criteria, type, context))

  const key = JSON.stringify(criteria)
  let current = state
  if (isDate && key !== state.key) {
    current = initialState(criteria, type, context)
    setState(current)
  }

  const fieldName = field?.name ?? ''
  const weekday = criteria.some((criterion) => isWeekdayFunction(criterion.fieldFunction))
  const canIncludeTime = isDate && type === 'DATE_TIME' && !weekday

  const emit = (next: QFilterCriteria[], patch: Partial<RowState>) => {
    setState((previous) => ({ ...previous, ...patch, key: JSON.stringify(next) }))
    onChange(next)
  }

  const backToDates = () => {
    const condition = exactCriterionToDateCondition(criteria[0], context) ?? emptyDateCondition()
    emit(dateConditionToCriteria(fieldName, type, condition, context), { condition, legacy: false, includeTime: false })
  }

  return {
    isDate,
    dateMode: isDate && !current.legacy && !current.includeTime,
    canIncludeTime,
    includeTime: current.includeTime,
    context,
    complete: criteria.length > 0 && criteria.every(isCriterionComplete),
    condition: current.condition,
    setCondition: (condition) => emit(dateConditionToCriteria(fieldName, type, condition, context), { condition, legacy: false, includeTime: false }),
    commitExact: (next) => emit(next, {}),
    switchToExact: (next) => emit(next, { legacy: true, includeTime: false }),
    canUseDatePicker: isDate && current.legacy && !current.includeTime && type === 'DATE' && !weekday,
    useDatePicker: () => backToDates(),
    setIncludeTime: (on) => {
      if (on) {
        emit([dateConditionToExactCriterion(fieldName, current.condition, context, new Date())], { legacy: true, includeTime: true })
        return
      }
      backToDates()
    },
  }
}

/**
 * The comparisons offered for a field, in the order shown.
 *
 * @param type - DATE or DATE_TIME.
 * @param pairAllowed - Whether a condition that is two bounds (a day, a range, a relative range) may be written.
 * @returns The modes.
 */
export function dateModesFor(type: QFieldType, pairAllowed: boolean): DateMode[] {
  const wholeDays: DateMode[] = pairAllowed ? ['on', 'between', 'within'] : type === 'DATE' ? ['on', 'between'] : []
  const dateOnly: DateMode[] = type === 'DATE' ? ['notOn', 'notBetween'] : []
  return [...wholeDays, 'before', 'after', 'onOrBefore', 'onOrAfter', ...dateOnly, 'empty', 'notEmpty']
}

interface DateModeInputsProps {
  /** The field. */
  field: DateField
  /** The row's date state. */
  row: DateRow
  /** Whether two-bound conditions may be written (an AND group). */
  pairAllowed: boolean
  /** Weekday operator settings (offers "day is any of" when enabled). */
  settings: OperatorOptionSettings
  /** The row's first criterion, which a weekday choice builds on. */
  criterion: QFilterCriteria
  /** data-qqq-id prefix. */
  dataId: string
  /** Larger touch targets, as the quick filters use. */
  touch?: boolean
  /** The comparison select's accessible name (the quick filters name it "Operator for <Field>"). */
  operatorLabel?: string
}

/**
 * The comparison select and the date inputs for a condition in date mode. The comparison list also
 * offers the weekday conditions, which switch the row to the weekday inputs.
 *
 * @param props - Component properties.
 * @returns The controls.
 */
export function DateModeInputs({ field, row, pairAllowed, settings, criterion, dataId, touch = false, operatorLabel = 'Filter operator' }: DateModeInputsProps) {
  const { condition, context, setCondition } = row
  const modes = dateModesFor(field.type, pairAllowed)
  const weekdayOptions = getOperatorOptions(field, settings).filter((option) => option.valueMode === 'weekdays')
  const size = touch ? 'min-h-11' : ''
  const modeList = modes.includes(condition.mode) ? modes : [...modes, condition.mode]

  const onMode = (value: string) => {
    const weekdayOption = weekdayOptions.find((option) => option.id === value)
    if (weekdayOption) {
      row.switchToExact([changeCriterionOperator({ ...criterion, values: [] }, undefined, weekdayOption)])
      return
    }
    if (value === RELATIVE_OPTION) {
      row.switchToExact([{ fieldName: field.name, operator: 'GREATER_THAN', values: [] }])
      return
    }
    const mode = value as DateMode
    setCondition({ ...condition, mode, to: mode === 'between' || mode === 'notBetween' ? condition.to : '' })
  }

  return (
    <>
      <select value={condition.mode} onChange={(e) => onMode(e.target.value)} aria-label={operatorLabel}
        className={`min-w-[160px] ${inputClass} ${size}`} data-qqq-id={`${dataId}-operator`}>
        {modeList.map((mode) => <option key={mode} value={mode}>{DATE_MODE_LABELS[mode]}</option>)}
        {field.type === 'DATE' && <option value={RELATIVE_OPTION}>is relative to today</option>}
        {weekdayOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
      <DateValueInputs field={field} condition={condition} context={context} onChange={setCondition} dataId={dataId} touch={touch} />
    </>
  )
}

interface DateValueInputsProps {
  field: DateField
  condition: DateCondition
  context: DateContext
  onChange: (condition: DateCondition) => void
  dataId: string
  touch: boolean
}

/**
 * The date inputs of a condition: one date, two ("between"), a relative range ("within"), or none.
 *
 * @param props - Component properties.
 * @returns The inputs.
 */
function DateValueInputs({ field, condition, context, onChange, dataId, touch }: DateValueInputsProps) {
  const size = touch ? 'min-h-11' : ''
  const note = timeZoneNote(context.timeZone, context.weekStart)
  const zoneHint = (
    <HintTooltip content={note} data-qqq-id={`${dataId}-timezone-hint`}>
      <button type="button" aria-label={`Time zone: ${note}`}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring ${touch ? 'min-h-11 min-w-11' : ''}`}
        data-qqq-id={`${dataId}-timezone`}>
        <Globe className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </HintTooltip>
  )

  if (condition.mode === 'empty' || condition.mode === 'notEmpty') return null
  if (condition.mode === 'within') {
    return <RangeInputs field={field} condition={condition} context={context} onChange={onChange} dataId={dataId} touch={touch} zoneHint={zoneHint} />
  }

  const ranged = condition.mode === 'between' || condition.mode === 'notBetween'
  const backwards = ranged && condition.from !== '' && condition.to !== '' && condition.to < condition.from
  return (
    <span className="flex flex-wrap items-center gap-1">
      <input type="date" value={condition.from} onChange={(e) => onChange({ ...condition, from: e.target.value })}
        aria-label={ranged ? `Filter value from for ${field.label}` : `Filter value for ${field.label}`}
        className={`w-36 ${inputClass} ${size}`} data-qqq-id={ranged ? `${dataId}-from` : dataId} />
      {ranged && (
        <>
          <span className="text-sm text-muted-foreground">and</span>
          <input type="date" value={condition.to} min={condition.from || undefined} onChange={(e) => onChange({ ...condition, to: e.target.value })}
            aria-label={`Filter value to for ${field.label}`} aria-invalid={backwards || undefined}
            title={backwards ? 'The end date is before the start date.' : undefined}
            className={`w-36 ${inputClass} ${size} ${backwards ? 'border-destructive' : ''}`} data-qqq-id={`${dataId}-to`} />
        </>
      )}
      {zoneHint}
    </span>
  )
}

const LAST_UNITS: LastUnit[] = ['DAYS', 'WEEKS', 'MONTHS']

/**
 * The relative range picker: a preset list, a custom "Last N" count and unit, and the days it covers now.
 *
 * @param props - Component properties.
 * @returns The inputs.
 */
function RangeInputs({ field, condition, context, onChange, dataId, touch, zoneHint }: DateValueInputsProps & { zoneHint: React.ReactNode }) {
  const size = touch ? 'min-h-11' : ''
  const preset = presetOf(condition.range)
  const [custom, setCustom] = useState(() => !preset)
  const last = asLastRange(condition.range) ?? { count: 3, unit: 'DAYS' as LastUnit }
  // the typed count: kept as text while typing (it is empty or half-typed on the way), committed once it is a whole number of 1 or more
  const committedCount = useRef(last.count)
  const [countText, setCountText] = useState(String(last.count))
  if (last.count !== committedCount.current) {
    committedCount.current = last.count
    setCountText(String(last.count))
  }
  const days = rangeDays(condition.range, new Date(), context)
  const group = (label: string, ids: string[]) => (
    <optgroup label={label}>
      {ids.map((id) => <option key={id} value={id}>{RANGE_PRESETS.find((p) => p.id === id)!.label}</option>)}
    </optgroup>
  )

  return (
    <span className="flex flex-wrap items-center gap-1">
      <select value={custom ? 'custom' : preset?.id ?? 'custom'} aria-label={`Date range for ${field.label}`}
        onChange={(e) => {
          if (e.target.value === 'custom') {
            setCustom(true)
            onChange({ ...condition, range: lastRange(last.count, last.unit) })
            return
          }
          setCustom(false)
          onChange({ ...condition, range: RANGE_PRESETS.find((p) => p.id === e.target.value)!.range })
        }}
        className={`min-w-[150px] ${inputClass} ${size}`} data-qqq-id={`${dataId}-range`}>
        {group('Days', ['today', 'yesterday', 'last7', 'last30'])}
        {group('Weeks', ['thisWeek', 'lastWeek'])}
        {group('Months', ['thisMonth', 'lastMonth'])}
        {group('Quarters and years', ['thisQuarter', 'lastQuarter', 'thisYear', 'lastYear'])}
        <option value="custom">Last N...</option>
      </select>
      {custom && (
        <>
          <input type="number" min={1} max={999} step={1} value={countText} aria-label={`Number of ${last.unit.toLowerCase()}`}
            onChange={(e) => {
              setCountText(e.target.value)
              const count = Math.trunc(Number(e.target.value))
              if (count >= 1 && count <= 999) {
                committedCount.current = count
                onChange({ ...condition, range: lastRange(count, last.unit) })
              }
            }}
            className={`w-16 ${inputClass} ${size}`} data-qqq-id={`${dataId}-range-count`} />
          <select value={last.unit} aria-label="Unit" onChange={(e) => onChange({ ...condition, range: lastRange(last.count, e.target.value as LastUnit) })}
            className={`${inputClass} ${size}`} data-qqq-id={`${dataId}-range-unit`}>
            {LAST_UNITS.map((unit) => <option key={unit} value={unit}>{unit.toLowerCase()}</option>)}
          </select>
        </>
      )}
      <span className="text-xs tabular-nums text-muted-foreground" data-qqq-id={`${dataId}-range-days`}>
        {formatYmdRange(days.from, days.to, context.locale)}
      </span>
      {zoneHint}
    </span>
  )
}

interface IncludeTimeToggleProps {
  /** The field's label (for the accessible name). */
  fieldLabel: string
  /** Whether it is on. */
  checked: boolean
  /** Switches it. */
  onChange: (on: boolean) => void
  /** data-qqq-id. */
  dataId: string
  /** Larger touch target. */
  touch?: boolean
}

/**
 * The unobtrusive switch from picking dates to picking exact date-times.
 *
 * @param props - Component properties.
 * @returns The switch.
 */
export function IncludeTimeToggle({ fieldLabel, checked, onChange, dataId, touch = false }: IncludeTimeToggleProps) {
  return (
    <label className={`flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground ${touch ? 'min-h-11' : ''}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={`Include time for ${fieldLabel}`}
        className="h-3.5 w-3.5 accent-primary" data-qqq-id={dataId} />
      Include time
    </label>
  )
}

/**
 * Plain-language text for a date condition, as a chip shows it: "Oct 1 – Oct 12, 2026", "Today".
 * Returns `null` when the criteria are exact times (the caller shows the date-times as before).
 *
 * @param criteria - The criteria of one condition on a field.
 * @param fieldType - DATE or DATE_TIME.
 * @returns The text and the pieces a tooltip can use, or `null`.
 */
export function describeDateCriteria(criteria: QFilterCriteria[], fieldType: QFieldType): { text: string; tooltip: string; hideOperator: boolean } | null {
  const context = defaultDateContext()
  const condition = criteriaToDateCondition(criteria, fieldType, context)
  if (!condition || !isDateConditionComplete(condition)) return null
  const text = describeDateCondition(condition, context.locale)
  const days = condition.mode === 'within' ? rangeDays(condition.range, new Date(), context) : null
  const range = days ? `${formatYmdRange(days.from, days.to, context.locale)}. ` : ''
  return { text, tooltip: `${range}${timeZoneNote(context.timeZone, context.weekStart)}`, hideOperator: true }
}

/**
 * The way back from exact-value inputs to the date controls, for a DATE field.
 *
 * @param props - Component properties.
 * @param props.onClick - Goes back.
 * @param props.dataId - data-qqq-id.
 * @returns The link-style button.
 */
export function UseDatePickerButton({ onClick, dataId }: { onClick: () => void; dataId: string }) {
  return (
    <button type="button" onClick={onClick} className="text-xs text-muted-foreground underline hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring" data-qqq-id={dataId}>
      Pick dates
    </button>
  )
}
