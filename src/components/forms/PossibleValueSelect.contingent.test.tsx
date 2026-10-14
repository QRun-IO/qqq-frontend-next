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

/** @file Contingent select behavior with real React Hook Form updates and resets. */
import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useForm, type UseFormReturn } from 'react-hook-form'

import type { QFieldMetaData } from '@/types'
import { fetchTablePossibleValues, fetchProcessPossibleValues } from '@/lib/api/possible-values'
import { PossibleValueSelect } from './PossibleValueSelect'

vi.mock('@/lib/api/possible-values', () => ({ fetchTablePossibleValues: vi.fn(), fetchProcessPossibleValues: vi.fn(), fetchPossibleValues: vi.fn(), fetchPossibleValuesPage: vi.fn() }))
const field = (name: string, label: string, dependsOn?: string[]): QFieldMetaData => ({ name, label, type: 'INTEGER', isRequired: false, isEditable: true, isHidden: false, isHeavy: false, adornments: [], possibleValueSourceName: name, possibleValueSourceDependsOn: dependsOn })
const fields = { country: field('country', 'Country'), state: field('state', 'State', ['country']), city: field('city', 'City', ['state']) }
let form: UseFormReturn<Record<string, unknown>>
const api = vi.mocked(fetchTablePossibleValues)

/** Exposes the form to drive reset and user-like edits without replacing the select. */
function Harness({ defaults = {}, behavior, cascade = false, process = false, enabledFields }: {
  defaults?: Record<string, unknown>; behavior?: QFieldMetaData['possibleValueSourceDependencyBehavior']; cascade?: boolean; process?: boolean; enabledFields?: Record<string, boolean>
}) {
  form = useForm<Record<string, unknown>>({ defaultValues: defaults })
  return <>{[fields.state, ...(cascade ? [fields.city] : [])].map((metadata) => <PossibleValueSelect key={metadata.name}
    id={metadata.name} name={metadata.name} label={metadata.label} fieldName={metadata.name} control={form.control} formMethods={form}
    chipField={{ ...metadata, possibleValueSourceDependencyBehavior: behavior }} fieldsByName={fields} enabledFields={enabledFields}
    initialLabel={defaults[metadata.name] ? `${metadata.label} saved` : undefined}
    context={process ? { type: 'process', processName: 'pickPlace' } : { type: 'table', tableName: 'address' }} />)}</>
}
const change = (name: string, value: unknown) => act(() => form.setValue(name, value, { shouldDirty: true }))

beforeEach(() => { vi.clearAllMocks(); api.mockResolvedValue([]); vi.mocked(fetchProcessPossibleValues).mockResolvedValue([]) })

describe('contingent PossibleValueSelect', () => {
  it('disables with an accessible metadata label hint until its parent is set', () => {
    render(<Harness />)
    expect(screen.getByRole('combobox', { name: 'State' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('combobox', { name: 'State' })).toHaveAccessibleDescription('Choose Country first')
    expect(screen.getByText('Choose Country first')).toHaveAttribute('data-qqq-id', 'contingent-hint-state')
    change('country', 1)
    expect(screen.getByRole('combobox', { name: 'State' })).not.toHaveAttribute('aria-disabled')
  })
  it('SHOW_ALL_UNTIL_SET stays enabled with an empty parent', () => {
    render(<Harness behavior="SHOW_ALL_UNTIL_SET" />)
    expect(screen.getByRole('combobox')).not.toHaveAttribute('aria-disabled')
    expect(screen.queryByText('Choose Country first')).not.toBeInTheDocument()
  })
  it('unknown policies disable until set', () => {
    render(<Harness behavior={'FUTURE' as QFieldMetaData['possibleValueSourceDependencyBehavior']} />)
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-disabled', 'true')
  })
  it('reloads only on dependency changes while sending all current form values', async () => {
    render(<Harness defaults={{ country: 1, unrelated: 'before' }} />)
    fireEvent.click(screen.getByRole('combobox'))
    await waitFor(() => expect(api).toHaveBeenCalledTimes(1))
    change('unrelated', 'after')
    expect(api).toHaveBeenCalledTimes(1)
    change('country', 2)
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2))
    expect(api).toHaveBeenLastCalledWith('address', 'state', { formValues: { country: 2, unrelated: 'after' } })
  })
  it('clears an invalid held value, marks it dirty, validates, and dismisses the notice on selection', async () => {
    render(<Harness defaults={{ country: 1, state: 10 }} />)
    const setter = vi.spyOn(form, 'setValue')
    change('country', 2)
    await waitFor(() => expect(form.getValues('state')).toBeNull())
    expect(api).toHaveBeenCalledWith('address', 'state', { ids: '10', useCase: 'form', formValues: { country: 2, state: 10 } })
    expect(setter).toHaveBeenCalledWith('state', null, { shouldDirty: true, shouldValidate: true })
    expect(screen.getByRole('status')).toHaveTextContent("State was cleared because it doesn't match the selected Country")
    change('state', 20)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
  it('keeps a still-valid held value', async () => {
    api.mockResolvedValue([{ id: 10, label: 'Still valid' }])
    render(<Harness defaults={{ country: 1, state: 10 }} />)
    change('country', 2)
    await waitFor(() => expect(api).toHaveBeenCalledTimes(1))
    expect(form.getValues('state')).toBe(10)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
  it('does not clear on mount or saved-record reset', async () => {
    render(<Harness defaults={{ country: 1, state: 10 }} />)
    expect(api).not.toHaveBeenCalled()
    act(() => form.reset({ country: 2, state: 20 }))
    await act(async () => {})
    expect(form.getValues('state')).toBe(20)
    expect(api).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
  it('does not clear when the initially empty form is populated from a saved record', async () => {
    render(<Harness />)
    act(() => form.reset({ country: 1, state: 10 }))
    await act(async () => {})
    expect(form.getValues('state')).toBe(10)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
  it('clearing a parent cascades through two levels without lookup', async () => {
    render(<Harness defaults={{ country: 1, state: 10, city: 100 }} cascade />)
    change('country', null)
    await waitFor(() => expect(form.getValues()).toEqual({ country: null, state: null, city: null }))
    expect(screen.getAllByRole('status')).toHaveLength(2)
    expect(api).not.toHaveBeenCalled()
  })
  it('changing a parent cascades through invalid descendants', async () => {
    render(<Harness defaults={{ country: 1, state: 10, city: 100 }} cascade />)
    change('country', 2)
    await waitFor(() => expect(form.getValues()).toEqual({ country: 2, state: null, city: null }))
    expect(screen.getAllByRole('status')).toHaveLength(2)
  })
  it('uses process values and the process PV route', async () => {
    render(<Harness defaults={{ country: 1, state: 10 }} process />)
    change('country', 2)
    await waitFor(() => expect(form.getValues('state')).toBeNull())
    expect(fetchProcessPossibleValues).toHaveBeenCalledWith('pickPlace', 'state', { ids: '10', useCase: 'form', formValues: { country: 2, state: 10 } })
    expect(api).not.toHaveBeenCalled()
  })
  it('bulk edit requires the parent switch as well as its value', () => {
    const { rerender } = render(<Harness defaults={{ country: 1 }} enabledFields={{ state: true }} />)
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-disabled', 'true')
    rerender(<Harness defaults={{ country: 1 }} enabledFields={{ country: true, state: true }} />)
    expect(screen.getByRole('combobox')).not.toHaveAttribute('aria-disabled')
  })
  it('does not clear on lookup failure', async () => {
    api.mockRejectedValue(new Error('Offline'))
    render(<Harness defaults={{ country: 1, state: 10 }} />)
    change('country', 2)
    await act(async () => {})
    expect(form.getValues('state')).toBe(10)
  })
  it('ignores a stale invalid lookup after another parent change', async () => {
    let finish!: (values: []) => void
    api.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve })).mockResolvedValue([{ id: 10, label: 'Valid' }])
    render(<Harness defaults={{ country: 1, state: 10 }} />)
    change('country', 2)
    change('country', 3)
    await act(async () => finish([]))
    expect(form.getValues('state')).toBe(10)
  })
  it('does not clear a newer B selection when an old validation completes', async () => {
    let finish!: (values: []) => void
    api.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve })).mockResolvedValue([{ id: 20, label: 'New' }])
    render(<Harness defaults={{ country: 1, state: 10 }} />)
    change('country', 2)
    change('state', 20)
    await act(async () => finish([]))
    expect(form.getValues('state')).toBe(20)
  })
})
