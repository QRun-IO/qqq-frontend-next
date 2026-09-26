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
 * @file filter-display-utils — how filter conditions read on the query screen (quick-filter
 * chips and the advanced query preview), following Material's `FilterUtils.getValuesString`
 * and `criteriaToHumanString`, and the live value of relative date expressions
 * (Material's `EvaluatedExpression`).
 */

import type { QFieldMetaData, QFieldType, QFilterCriteria } from '@/types'
import { formatDateTime, fromLocalDateTimeInput } from './datetime-utils'
import {
  describeExpression,
  getOperatorOptions,
  isFilterExpression,
  isFilterVariableExpression,
  isNowExpression,
  isNowWithOffsetExpression,
  isThisOrLastPeriodExpression,
  isWeekdayFunction,
  selectedOperatorOption,
  weekdayLabel,
  type CriteriaValue,
  type FilterExpression,
  type OperatorOptionSettings,
} from './filter-utils'

/** How a values list that is cut short says so: "and N other values." or "+N". */
export type AndMoreFormat = 'andNOther' | '+N'

/**
 * Formats one criteria value for reading (Material's value labels): expressions as words,
 * booleans as yes/no, weekdays and possible values by label, date-times in the viewer's zone.
 *
 * @param value - The value.
 * @param field - The field the condition is on.
 * @param criterion - The condition (for its field function).
 * @param labels - Possible-value labels by id, when known.
 * @returns The text.
 */
export function formatCriteriaValue(value: CriteriaValue, field: Pick<QFieldMetaData, 'type'> | undefined, criterion: Pick<QFilterCriteria, 'fieldFunction'>, labels?: Record<string, string>): string {
  if (isFilterExpression(value)) return describeExpression(value, field?.type)
  if (isWeekdayFunction(criterion.fieldFunction)) return weekdayLabel(value) ?? String(value)
  if (field?.type === 'BOOLEAN') return value === true || value === 'true' ? 'yes' : 'no'
  const label = labels?.[String(value)]
  if (label !== undefined) return label
  if (field?.type === 'DATE_TIME' && typeof value === 'string') return formatDateTime(fromLocalDateTimeInput(value)) ?? value
  return String(value)
}

/**
 * The values of a condition as one string (Material's `getValuesString`): none for the
 * emptiness operators; a long list is cut to `maxValuesToShow`, then "and N other values." or
 * "+N"; with one value to show, any second value is summarized.
 *
 * @param field - The field.
 * @param criterion - The condition.
 * @param labels - Possible-value labels by id.
 * @param maxValuesToShow - How many values to list.
 * @param andMoreFormat - How a cut list ends.
 * @returns The values text (empty for none).
 */
export function criterionValuesString(field: Pick<QFieldMetaData, 'type'> | undefined, criterion: QFilterCriteria, labels?: Record<string, string>, maxValuesToShow = 3, andMoreFormat: AndMoreFormat = 'andNOther'): string {
  if (criterion.operator === 'IS_BLANK' || criterion.operator === 'IS_NOT_BLANK') return ''
  const values = (criterion.values ?? []).filter((v) => v !== null && v !== undefined && String(typeof v === 'object' ? 'x' : v).trim() !== '')
  if (values.length === 0) return ''
  let shown = values.length
  if (shown > maxValuesToShow + 2) shown = maxValuesToShow
  else if (maxValuesToShow === 1 && values.length > 1) shown = 1
  const parts = values.slice(0, shown).map((v) => formatCriteriaValue(v, field, criterion, labels))
  const more = values.length - shown
  if (more > 0) {
    if (andMoreFormat === '+N') parts[parts.length - 1] += ` +${more}`
    else parts.push(` and ${more} other value${more === 1 ? '' : 's'}.`)
  }
  return parts.join(', ')
}

/**
 * The operator of a condition as the field's operator list words it ("is after", "day is any
 * of"), or the generic label for an operator the field does not offer.
 *
 * @param field - The field.
 * @param criterion - The condition.
 * @param settings - Operator option settings.
 * @returns The operator text.
 */
export function criterionOperatorLabel(field: Pick<QFieldMetaData, 'type' | 'possibleValueSourceName'> | undefined, criterion: QFilterCriteria, settings: OperatorOptionSettings = {}): string {
  const options = field ? getOperatorOptions(field, settings) : []
  return selectedOperatorOption(options, criterion).label.trim()
}

/**
 * Whether a quick-filter chip hides the operator (Material hides "equals" and "is any of").
 *
 * @param criterion - The condition.
 * @returns True for plain EQUALS and IN.
 */
export function chipHidesOperator(criterion: QFilterCriteria): boolean {
  return !criterion.fieldFunction && (criterion.operator === 'EQUALS' || criterion.operator === 'IN')
}

/**
 * Evaluates a relative date expression at a moment, as the backend would in the viewer's zone:
 * now; now plus or minus an amount (calendar units by the calendar); or the start of this or the
 * last hour, day, week (Sunday), month or year.
 *
 * @param now - The moment to evaluate at.
 * @param expression - The expression.
 * @returns The instant, or null for a filter variable (which has no value until run).
 */
export function evaluateExpression(now: Date, expression: FilterExpression): Date | null {
  if (isFilterVariableExpression(expression)) return null
  const result = new Date(now.getTime())
  if (isNowExpression(expression)) return result
  if (isNowWithOffsetExpression(expression)) {
    const amount = (expression.operator === 'MINUS' ? -1 : 1) * (Number(expression.amount) || 0)
    switch (expression.timeUnit) {
      case 'SECONDS': result.setSeconds(result.getSeconds() + amount); break
      case 'MINUTES': result.setMinutes(result.getMinutes() + amount); break
      case 'HOURS': result.setHours(result.getHours() + amount); break
      case 'DAYS': result.setDate(result.getDate() + amount); break
      case 'WEEKS': result.setDate(result.getDate() + 7 * amount); break
      case 'MONTHS': result.setMonth(result.getMonth() + amount); break
      case 'YEARS': result.setFullYear(result.getFullYear() + amount); break
    }
    return result
  }
  if (isThisOrLastPeriodExpression(expression)) {
    const last = expression.operator === 'LAST' ? 1 : 0
    result.setMinutes(0, 0, 0)
    if (expression.timeUnit === 'HOURS') {
      result.setHours(result.getHours() - last)
      return result
    }
    result.setHours(0)
    switch (expression.timeUnit) {
      case 'WEEKS': result.setDate(result.getDate() - result.getDay() - 7 * last); break
      case 'MONTHS': result.setDate(1); result.setMonth(result.getMonth() - last); break
      case 'YEARS': result.setMonth(0, 1); result.setFullYear(result.getFullYear() - last); break
      default: result.setDate(result.getDate() - last); break
    }
    return result
  }
  return null
}

/**
 * Two-digit zero padding.
 *
 * @param value - A number below 100.
 * @returns The padded text.
 */
function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * The text of an evaluated expression: `yyyy-MM-dd` for dates, Material's
 * `yyyy-MM-dd hh:mm:ss AM TZ` for date-times; a filter variable shows its name.
 *
 * @param now - The moment to evaluate at.
 * @param expression - The expression.
 * @param fieldType - DATE or DATE_TIME.
 * @returns The evaluated value as text.
 */
export function formatEvaluatedExpression(now: Date, expression: FilterExpression, fieldType: QFieldType): string {
  const value = evaluateExpression(now, expression)
  if (!value) return describeExpression(expression, fieldType)
  if (fieldType === 'DATE') return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
  return formatDateTime(value) ?? value.toISOString()
}
