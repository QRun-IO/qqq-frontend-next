/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { describe, expect, it } from 'vitest'

import type { QFilterCriteria } from '@/types'
import {
  chipHidesOperator, criterionOperatorLabel, criterionValuesString, evaluateExpression,
  formatCriteriaValue, formatEvaluatedExpression,
} from './filter-display-utils'
import type { FilterExpression } from './filter-utils'

const criterion = (values: QFilterCriteria['values'], operator: QFilterCriteria['operator'] = 'EQUALS'): QFilterCriteria =>
  ({ fieldName: 'status', operator, values })

describe('human-readable query filters', () => {
  it('shows possible value labels, booleans, weekdays and relative dates', () => {
    expect(formatCriteriaValue('A', { type: 'STRING' }, criterion([]), { A: 'Active' })).toBe('Active')
    expect(formatCriteriaValue(true, { type: 'BOOLEAN' }, criterion([]))).toBe('yes')
    expect(formatCriteriaValue(false, { type: 'BOOLEAN' }, criterion([]))).toBe('no')
    const weekday = { ...criterion([]), fieldFunction: { fieldName: 'receivedDate', functionTypeIdentifierName: 'WeekdayOfDate' } }
    expect(formatCriteriaValue(1, { type: 'DATE' }, weekday)).toBe('Monday')
    expect(formatCriteriaValue(9, { type: 'DATE' }, weekday)).toBe('9')
    expect(formatCriteriaValue({ type: 'Now' }, { type: 'DATE' }, criterion([]))).toBe('today')
    expect(formatCriteriaValue('ordinary', undefined, criterion([]))).toBe('ordinary')
  })

  it('summarizes long value lists without hiding small ones', () => {
    expect(criterionValuesString({ type: 'STRING' }, criterion([], 'IS_BLANK'))).toBe('')
    expect(criterionValuesString({ type: 'STRING' }, criterion(['', null, undefined] as QFilterCriteria['values']))).toBe('')
    expect(criterionValuesString({ type: 'STRING' }, criterion(['A', 'B']), { A: 'Active', B: 'Blocked' })).toBe('Active, Blocked')
    expect(criterionValuesString({ type: 'STRING' }, criterion(['a', 'b', 'c', 'd', 'e', 'f']))).toBe('a, b, c,  and 3 other values.')
    expect(criterionValuesString({ type: 'STRING' }, criterion(['a', 'b', 'c']), undefined, 1, '+N')).toBe('a +2')
  })

  it('uses metadata operator names and hides plain equals and any-of chips', () => {
    expect(criterionOperatorLabel({ type: 'DATE' }, criterion(['2021-01-01'], 'GREATER_THAN'))).toBe('is after')
    expect(chipHidesOperator(criterion(['A']))).toBe(true)
    expect(chipHidesOperator(criterion(['A'], 'IN'))).toBe(true)
    expect(chipHidesOperator(criterion(['A'], 'NOT_IN'))).toBe(false)
    expect(chipHidesOperator({ ...criterion(['A']), fieldFunction: { fieldName: 'status', functionTypeIdentifierName: 'WeekdayOfDate' } })).toBe(false)
  })
})

describe('relative date previews', () => {
  const now = new Date(2024, 5, 15, 12, 34, 56)
  const offset = (timeUnit: 'SECONDS' | 'MINUTES' | 'HOURS' | 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS', amount: number, operator: 'PLUS' | 'MINUS' = 'PLUS'): FilterExpression =>
    ({ type: 'NowWithOffset', operator, amount, timeUnit })

  it('does not turn an unassigned filter variable into an invented date', () => {
    expect(evaluateExpression(now, { type: 'FilterVariableExpression', variableName: 'start' })).toBeNull()
    expect(formatEvaluatedExpression(now, { type: 'FilterVariableExpression', variableName: 'start' }, 'DATE')).toContain('start')
    expect(evaluateExpression(now, { type: 'Now' })?.getTime()).toBe(now.getTime())
  })

  it.each([
    ['SECONDS', 1, 12, 34, 57], ['MINUTES', 1, 12, 35, 56], ['HOURS', 1, 13, 34, 56],
  ] as const)('adds one %s with calendar semantics', (unit, amount, hour, minute, second) => {
    const result = evaluateExpression(now, offset(unit, amount))!
    expect([result.getHours(), result.getMinutes(), result.getSeconds()]).toEqual([hour, minute, second])
  })

  it('handles day, week, month and year offsets, including past dates', () => {
    expect(evaluateExpression(now, offset('DAYS', 2))?.getDate()).toBe(17)
    expect(evaluateExpression(now, offset('WEEKS', 1))?.getDate()).toBe(22)
    expect(evaluateExpression(now, offset('MONTHS', 1))?.getMonth()).toBe(6)
    expect(evaluateExpression(now, offset('YEARS', 1))?.getFullYear()).toBe(2025)
    expect(evaluateExpression(now, offset('DAYS', 2, 'MINUS'))?.getDate()).toBe(13)
  })

  it('finds the start of this or last period and formats a date', () => {
    const period = (timeUnit: 'HOURS' | 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS', operator: 'THIS' | 'LAST'): FilterExpression =>
      ({ type: 'ThisOrLastPeriod', operator, timeUnit })
    expect(evaluateExpression(now, period('HOURS', 'THIS'))?.getMinutes()).toBe(0)
    expect(evaluateExpression(now, period('HOURS', 'LAST'))?.getHours()).toBe(11)
    expect(evaluateExpression(now, period('DAYS', 'LAST'))?.getDate()).toBe(14)
    expect(evaluateExpression(now, period('WEEKS', 'THIS'))?.getDay()).toBe(0)
    expect(evaluateExpression(now, period('MONTHS', 'THIS'))?.getDate()).toBe(1)
    expect(evaluateExpression(now, period('YEARS', 'LAST'))?.getFullYear()).toBe(2023)
    expect(formatEvaluatedExpression(now, { type: 'Now' }, 'DATE')).toBe('2024-06-15')
    expect(formatEvaluatedExpression(now, { type: 'Now' }, 'DATE_TIME')).toContain('2024')
  })
})
