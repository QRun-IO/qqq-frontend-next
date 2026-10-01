/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { describe, expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'

import type { QFieldMetaData } from '@/types'
import {
  caseTransform, fileUploadWidth, formFieldColumnClasses, formFieldColumns,
  isImplicitSubmitKey, numberAdornments, transformInputValue,
} from './form-layout'

const field = (extra: Partial<QFieldMetaData> = {}) => ({
  name: 'amount', label: 'Amount', type: 'DECIMAL', adornments: [], ...extra,
}) as QFieldMetaData

describe('metadata driven form layout', () => {
  it('uses a half-width default, valid 12-column spans, and full-width file uploads', () => {
    expect(formFieldColumns(field())).toBe(6)
    expect(formFieldColumns(field({ gridColumns: 4 }))).toBe(4)
    expect(formFieldColumnClasses(field({ gridColumns: 4 }))).toContain('lg:col-span-4')
    expect(formFieldColumns(field({ gridColumns: 0 }))).toBe(6)
    expect(formFieldColumns(field({ gridColumns: 13 }))).toBe(6)
    expect(formFieldColumns(field({ gridColumns: Number.NaN }))).toBe(6)
    const upload = field({ gridColumns: 3, adornments: [{ type: 'FILE_UPLOAD', values: { width: 'full' } }] })
    expect(fileUploadWidth(upload)).toBe('full')
    expect(formFieldColumns(upload)).toBe(12)
    expect(formFieldColumnClasses(upload)).toContain('sm:col-span-12 lg:col-span-12')
    expect(fileUploadWidth(field())).toBe('half')
  })

  it('shows currency and percentage affordances from the declared display format', () => {
    expect(numberAdornments(field({ displayFormat: '$#,##0.00' }))).toEqual({ prefix: '$', suffix: undefined })
    expect(numberAdornments(field({ displayFormat: '0.0%%' }))).toEqual({ prefix: undefined, suffix: '%' })
    expect(numberAdornments(field())).toEqual({ prefix: undefined, suffix: undefined })
  })

  it('changes case while retaining a focused input selection', () => {
    expect(caseTransform(field())).toBeUndefined()
    expect(caseTransform(field({ behaviors: ['TO_LOWER_CASE'] }))?.('HeLLo')).toBe('hello')
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.value = 'mixed'
    input.focus()
    input.setSelectionRange(1, 3)
    transformInputValue(input, caseTransform(field({ behaviors: ['TO_UPPER_CASE'] }))!)
    expect(input.value).toBe('MIXED')
    expect([input.selectionStart, input.selectionEnd]).toEqual([1, 3])
    input.remove()
  })

  describe.each(['input', 'textarea'] as const)('%s case conversion', (tag) => {
    it.each([
      { behavior: 'TO_UPPER_CASE', initial: 'ßcd', converted: 'SSXD', continued: 'SSXYD' },
      { behavior: 'TO_LOWER_CASE', initial: 'İCD', converted: 'i\u0307xd', continued: 'i\u0307xyd' },
    ])('keeps subsequent typing after the insertion when $behavior expands a character', async ({ behavior, initial, converted, continued }) => {
      const user = userEvent.setup()
      const input = document.createElement(tag)
      const transform = caseTransform(field({ behaviors: [behavior] }))!
      input.addEventListener('input', () => transformInputValue(input, transform))
      document.body.appendChild(input)
      try {
        input.value = initial
        input.focus()
        input.setSelectionRange(1, 2)
        await user.keyboard('X')
        expect(input.value).toBe(converted)
        expect([input.selectionStart, input.selectionEnd]).toEqual([3, 3])
        await user.keyboard('Y')
        expect(input.value).toBe(continued)
        expect([input.selectionStart, input.selectionEnd]).toEqual([4, 4])
      } finally {
        input.remove()
      }
    })

    it('keeps a backward selection over expanded characters', () => {
      const input = document.createElement(tag)
      document.body.appendChild(input)
      try {
        input.value = 'aßcﬃd'
        input.focus()
        input.setSelectionRange(1, 4, 'backward')
        transformInputValue(input, caseTransform(field({ behaviors: ['TO_UPPER_CASE'] }))!)
        expect(input.value).toBe('ASSCFFID')
        expect([input.selectionStart, input.selectionEnd, input.selectionDirection]).toEqual([1, 7, 'backward'])
      } finally {
        input.remove()
      }
    })
  })

  it('blocks only implicit Enter submits from single-line inputs', () => {
    const input = document.createElement('input')
    input.type = 'text'
    expect(isImplicitSubmitKey({ key: 'Enter', target: input, isComposing: false })).toBe(true)
    expect(isImplicitSubmitKey({ key: 'Enter', target: input, isComposing: true })).toBe(false)
    expect(isImplicitSubmitKey({ key: 'Tab', target: input, isComposing: false })).toBe(false)
    input.type = 'checkbox'
    expect(isImplicitSubmitKey({ key: 'Enter', target: input, isComposing: false })).toBe(false)
    expect(isImplicitSubmitKey({ key: 'Enter', target: document.createElement('textarea'), isComposing: false })).toBe(false)
  })
})
