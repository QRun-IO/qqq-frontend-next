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

import React, { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'

import { CronScheduleEditor } from './CronScheduleEditor'

/** A controlled editor that reports each new value. */
function Harness({ initial = '', error, onValue }: { initial?: string; error?: string; onValue?: (value: string) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <CronScheduleEditor
      id="field-cronExpression"
      qqqId="cronWidget"
      label="Cron Expression"
      value={value}
      onChange={(next) => { setValue(next); onValue?.(next) }}
      required
      error={error}
    />
  )
}

const byQqqId = (container: HTMLElement, id: string) => container.querySelector(`[data-qqq-id="${id}"]`)

describe('CronScheduleEditor', () => {
  it('builds a weekly schedule in Basic mode and describes it', async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    const { container } = render(<Harness onValue={onValue} />)
    expect(screen.getByRole('button', { name: 'Basic' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^Days/ })).toHaveTextContent('Not set')

    await user.click(screen.getByRole('button', { name: /^Days/ }))
    const days = screen.getByRole('dialog', { name: 'Days' })
    await user.click(within(days).getByRole('radio', { name: 'Selected Weekdays' }))
    expect(onValue).not.toHaveBeenCalled()
    await user.click(within(days).getByRole('checkbox', { name: 'Friday' }))
    await user.click(within(days).getByRole('checkbox', { name: 'Monday' }))
    await user.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: /^Days/ })).toHaveTextContent('Mon, Fri')

    // a new schedule starts at midnight, as in Material
    await user.click(screen.getByRole('button', { name: /^Hours/ }))
    const hours = screen.getByRole('dialog', { name: 'Hours' })
    expect(within(hours).getByRole('checkbox', { name: '12am' })).toBeChecked()
    await user.click(within(hours).getByRole('checkbox', { name: '9am' }))
    await user.click(within(hours).getByRole('checkbox', { name: '12am' }))
    await user.keyboard('{Escape}')

    expect(onValue).toHaveBeenLastCalledWith('0 0 9 ? * MON,FRI')
    await waitFor(() => expect(byQqqId(container, 'cron-editor-description-cronWidget')).toHaveTextContent('Every week, on Monday and Friday, at 9:00 am'))
    expect(screen.getByRole('button', { name: /^Minutes/ })).toHaveTextContent('00')
  })

  it('reads an existing schedule into Basic mode and switches a slot to every value', async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    render(<Harness initial="0 0,30 9,17 1,15 * ?" onValue={onValue} />)
    expect(screen.getByRole('button', { name: /^Days/ })).toHaveTextContent('1st, 15th')
    expect(screen.getByRole('button', { name: /^Hours/ })).toHaveTextContent('9am, 5pm')
    expect(screen.getByRole('button', { name: /^Minutes/ })).toHaveTextContent('00, 30')
    await user.click(screen.getByRole('button', { name: /^Hours/ }))
    const hours = screen.getByRole('dialog', { name: 'Hours' })
    expect(within(hours).getByRole('checkbox', { name: '5pm' })).toBeChecked()
    await user.click(within(hours).getByRole('radio', { name: 'Every Hour' }))
    expect(onValue).toHaveBeenLastCalledWith('0 0,30 * 1,15 * ?')
  })

  it('keeps a slot popover within the space beside its trigger, scrolling inside (QRun-IO/qqq#708)', async () => {
    const user = userEvent.setup()
    render(<Harness initial="0 0 9 * * ?" />)
    await user.click(screen.getByRole('button', { name: /^Minutes/ }))
    const minutes = screen.getByRole('dialog', { name: 'Minutes' })
    // 60 touch-sized minute choices are taller than a phone or tablet screen: the popover is
    // capped at the height Radix measures as available and scrolls, so every choice is reachable
    expect(within(minutes).getAllByRole('checkbox')).toHaveLength(60)
    expect(minutes).toHaveClass('max-h-[var(--radix-popover-content-available-height)]', 'overflow-y-auto')
  })

  it('describes a typed expression and flags an invalid one in Advanced mode', async () => {
    const user = userEvent.setup()
    const { container } = render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Advanced' }))
    const input = screen.getByLabelText(/^Cron Expression/)
    await user.type(input, '0 30 8 ? * MON-FRI')
    await waitFor(() => expect(byQqqId(container, 'cron-editor-description-cronWidget')).toHaveTextContent('Every week, every day between Monday and Friday, at 8:30 am'))
    expect(input).not.toHaveAttribute('aria-invalid')

    await user.clear(input)
    await user.type(input, '0 75 8 * * ?')
    await waitFor(() => expect(byQqqId(container, 'cron-editor-error-cronWidget')).toHaveTextContent('Minute values must be between 0 and 59'))
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(byQqqId(container, 'cron-editor-description-cronWidget')).toBeNull()
  })

  it('names the expression part at the caret', async () => {
    const user = userEvent.setup()
    const { container } = render(<Harness initial="0 */15 * * * ?" />)
    const input = screen.getByLabelText(/^Cron Expression/)
    await user.click(input)
    await user.keyboard('{Home}{ArrowRight}{ArrowRight}{ArrowRight}')
    await waitFor(() => expect(byQqqId(container, 'cron-format-cronWidget')?.querySelector('[aria-current="true"]')).toHaveTextContent('minute'))
  })

  it('opens an expression Basic mode cannot show in Advanced mode, with the reason', () => {
    const { container } = render(<Harness initial="0 */15 * * * ?" />)
    expect(screen.getByRole('button', { name: 'Basic' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Advanced' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText(/^Cron Expression/)).toHaveValue('0 */15 * * * ?')
    expect(byQqqId(container, 'cron-basic-reason-cronWidget')).toHaveTextContent('To use Basic mode each part must be *, single values, lists or ranges')
    expect(byQqqId(container, 'cron-editor-description-cronWidget')).toHaveTextContent('Every day, every hour, every 15 minutes between 00 and 59')
  })

  it('clears the expression', async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    render(<Harness initial="0 0 9 * * ?" onValue={onValue} />)
    await user.click(screen.getByRole('button', { name: 'Clear Cron Expression' }))
    expect(onValue).toHaveBeenLastCalledWith('')
    expect(screen.getByRole('button', { name: /^Days/ })).toHaveTextContent('Not set')
    expect(screen.getByRole('button', { name: 'Clear Cron Expression' })).toBeDisabled()
  })

  it('shows the form validation message and describes the pickers with it', () => {
    render(<Harness error="Cron Expression is required" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Cron Expression is required')
    expect(screen.getByRole('button', { name: /^Days/ })).toHaveAccessibleDescription(/Cron Expression is required/)
  })

  it('has no accessibility violations in either mode', async () => {
    const user = userEvent.setup()
    const { container } = render(<Harness initial="0 0 9 * * ?" />)
    expect(await axe(container)).toHaveNoViolations()
    await user.click(screen.getByRole('button', { name: 'Advanced' }))
    expect(await axe(container)).toHaveNoViolations()
  })
})
