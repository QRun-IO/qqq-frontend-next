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

// Tests for WidgetDropdownMenu: Material's searchable combobox, date picker and custom timeframe

import React from 'react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { WidgetDropdownMenu } from './WidgetDropdownMenu'
import type { WidgetDropdownControl } from './WidgetDropdownMenu'
import { localDateTimeToUtc } from './widget-utils'

const choices: WidgetDropdownControl = {
  paramName: 'accChoice', label: 'Choice', type: 'POSSIBLE_VALUE_SOURCE', value: null,
  options: [{ id: 'alpha', label: 'Alpha' }, { id: 'beta', label: 'Beta' }, { id: 'gamma', label: 'Gamma Ray' }],
}

function renderMenu(control: Partial<WidgetDropdownControl> = {}, onChange = vi.fn()) {
  const result = render(<WidgetDropdownMenu widgetName="accWidget" control={{ ...choices, ...control }} onChange={onChange} />)
  return { ...result, onChange }
}

describe('WidgetDropdownMenu combobox', () => {
  it('filters options as the user types and says when nothing matches', async () => {
    const user = userEvent.setup()
    renderMenu()
    const input = screen.getByRole('combobox', { name: 'Select Choice' })
    expect(input).toHaveAttribute('aria-expanded', 'false')
    await user.click(input)
    expect(input).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Alpha', 'Beta', 'Gamma Ray'])
    await user.type(input, 'ray')
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Gamma Ray'])
    await user.clear(input)
    await user.type(input, 'zzz')
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByText('No options found')).toBeInTheDocument()
  })

  it('selects by click or keyboard, and clears with the clear button', async () => {
    const user = userEvent.setup()
    const { onChange, rerender } = renderMenu()
    const input = screen.getByRole('combobox', { name: 'Select Choice' })
    await user.click(input)
    await user.click(screen.getByRole('option', { name: 'Beta' }))
    expect(onChange).toHaveBeenLastCalledWith({ id: 'beta', label: 'Beta' })
    rerender(<WidgetDropdownMenu widgetName="accWidget" control={{ ...choices, value: 'beta' }} onChange={onChange} />)
    expect(input).toHaveValue('Beta')
    // keyboard: open, move down, choose
    await user.click(input)
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(onChange).toHaveBeenLastCalledWith({ id: 'beta', label: 'Beta' })
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Clear Choice' }))
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('hides the clear button with disableClearable, sizes to the metadata width and shows the start icon', () => {
    renderMenu({ value: 'alpha', disableClearable: true, width: 300, startIconName: 'star' })
    expect(screen.queryByRole('button', { name: 'Clear Choice' })).toBeNull()
    const container = screen.getByRole('combobox').closest('.relative') as HTMLElement
    expect(container.style.width).toBe('300px')
    expect(document.querySelector('[data-qqq-id="widget-dropdown-icon-accWidget-accChoice"]')).toHaveAttribute('data-icon-name', 'star')
  })

  it('defaults the width to 225 px (Material)', () => {
    renderMenu()
    expect((screen.getByRole('combobox').closest('.relative') as HTMLElement).style.width).toBe('225px')
  })

  it('offers a label-for-null option (selected by default) only without a backend default', async () => {
    const user = userEvent.setup()
    const { onChange, unmount } = renderMenu({ labelForNullValue: 'All choices', value: null })
    const input = screen.getByRole('combobox', { name: 'Select Choice' })
    expect(input).toHaveValue('All choices')
    await user.click(input)
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['All choices', 'Alpha', 'Beta', 'Gamma Ray'])
    await user.click(screen.getByRole('option', { name: 'All choices' }))
    expect(onChange).toHaveBeenLastCalledWith(null)
    unmount()
    renderMenu({ labelForNullValue: 'All choices', hasDefault: true, value: 'alpha' })
    await user.click(screen.getByRole('combobox', { name: 'Select Choice' }))
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Alpha', 'Beta', 'Gamma Ray'])
  })

  it('steps to the previous and next options with allowBackAndForth, inverted when asked', async () => {
    const user = userEvent.setup()
    const { onChange, unmount } = renderMenu({ value: 'beta', allowBackAndForth: true })
    await user.click(screen.getByRole('button', { name: 'Previous Choice' }))
    expect(onChange).toHaveBeenLastCalledWith({ id: 'alpha', label: 'Alpha' })
    await user.click(screen.getByRole('button', { name: 'Next Choice' }))
    expect(onChange).toHaveBeenLastCalledWith({ id: 'gamma', label: 'Gamma Ray' })
    unmount()
    const inverted = renderMenu({ value: 'beta', allowBackAndForth: true, backAndForthInverted: true })
    await user.click(screen.getByRole('button', { name: 'Previous Choice' }))
    expect(inverted.onChange).toHaveBeenLastCalledWith({ id: 'gamma', label: 'Gamma Ray' })
    // at the end of the list nothing happens
    inverted.unmount()
    const atEnd = renderMenu({ value: 'gamma', allowBackAndForth: true })
    await user.click(screen.getByRole('button', { name: 'Next Choice' }))
    expect(atEnd.onChange).not.toHaveBeenCalled()
  })
})

describe('WidgetDropdownMenu date picker', () => {
  const day: WidgetDropdownControl = { paramName: 'accDate', label: 'Day', type: 'DATE_PICKER', options: [], value: null }

  it('sends the chosen day as toLocaleDateString (Material) and shows a stored value', () => {
    const onChange = vi.fn()
    const { rerender } = render(<WidgetDropdownMenu widgetName="accWidget" control={day} onChange={onChange} />)
    const input = screen.getByLabelText('Select Day')
    expect(input).toHaveAttribute('type', 'date')
    fireEvent.change(input, { target: { value: '2025-12-31' } })
    const sent = new Date(2025, 11, 31).toLocaleDateString()
    expect(onChange).toHaveBeenLastCalledWith({ id: sent, label: sent })
    rerender(<WidgetDropdownMenu widgetName="accWidget" control={{ ...day, value: sent }} onChange={onChange} />)
    expect(input).toHaveValue('2025-12-31')
  })

  it('has a Today action and a day either way', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<WidgetDropdownMenu widgetName="accWidget" control={{ ...day, value: new Date(2026, 1, 28).toLocaleDateString(), allowBackAndForth: true }} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Today for Day' }))
    const today = new Date().toLocaleDateString()
    expect(onChange).toHaveBeenLastCalledWith({ id: today, label: today })
    await user.click(screen.getByRole('button', { name: 'Next day for Day' }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ id: new Date(2026, 2, 1).toLocaleDateString() }))
    await user.click(screen.getByRole('button', { name: 'Previous day for Day' }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ id: new Date(2026, 1, 27).toLocaleDateString() }))
  })
})

describe('WidgetDropdownMenu custom timeframe', () => {
  afterEach(() => vi.useRealTimers())

  const timeframe: WidgetDropdownControl = {
    paramName: 'timeframe', label: 'Timeframe', type: 'POSSIBLE_VALUE_SOURCE', value: 'week',
    options: [{ id: 'week', label: 'This Week' }, { id: 'custom', label: 'Custom' }],
  }

  it('asks for a start and end, then sends custom,<utcStart>,<utcEnd> after 500 ms', async () => {
    const onChange = vi.fn()
    render(<WidgetDropdownMenu widgetName="accWidget" control={timeframe} onChange={onChange} />)
    fireEvent.click(screen.getByRole('combobox', { name: 'Select Timeframe' }))
    fireEvent.click(screen.getByRole('option', { name: 'Custom' }))
    // choosing custom sends nothing until the range is complete
    expect(onChange).not.toHaveBeenCalled()
    vi.useFakeTimers()
    fireEvent.change(screen.getByLabelText('Custom Timeframe Start'), { target: { value: '2026-09-01T08:00' } })
    fireEvent.change(screen.getByLabelText('Custom Timeframe End'), { target: { value: '2026-09-02T17:30' } })
    act(() => { vi.advanceTimersByTime(499) })
    expect(onChange).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenLastCalledWith({
      id: `custom,${localDateTimeToUtc('2026-09-01T08:00')},${localDateTimeToUtc('2026-09-02T17:30')}`, label: 'Custom',
    })
  })

  it('restores a stored custom range into the inputs', () => {
    const value = `custom,${localDateTimeToUtc('2026-03-04T05:06')},${localDateTimeToUtc('2026-03-05T07:08')}`
    render(<WidgetDropdownMenu widgetName="accWidget" control={{ ...timeframe, value }} onChange={vi.fn()} />)
    expect(screen.getByRole('combobox', { name: 'Select Timeframe' })).toHaveValue('Custom')
    expect(screen.getByLabelText('Custom Timeframe Start')).toHaveValue('2026-03-04T05:06')
    expect(screen.getByLabelText('Custom Timeframe End')).toHaveValue('2026-03-05T07:08')
  })

  it('does not offer a range for other dropdowns with a custom option', () => {
    render(<WidgetDropdownMenu widgetName="accWidget" control={{ ...timeframe, paramName: 'period', value: 'custom' }} onChange={vi.fn()} />)
    expect(screen.queryByLabelText('Custom Timeframe Start')).toBeNull()
  })
})
