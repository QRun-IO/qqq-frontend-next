/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { describe, expect, it } from 'vitest'

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
