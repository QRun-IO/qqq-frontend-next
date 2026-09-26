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

import React from 'react'
import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { HoverTooltip } from './HoverTooltip'

function renderTooltip() {
  render(<HoverTooltip content="Owned help" qqqId="tooltip-test"><span>Label</span></HoverTooltip>)
  const trigger = screen.getByText('Label').parentElement as HTMLElement
  const tooltip = screen.getByRole('tooltip', { hidden: true })
  return { trigger, tooltip }
}

describe('HoverTooltip', () => {
  it('describes its trigger and stays hidden until needed', () => {
    const { trigger, tooltip } = renderTooltip()
    expect(trigger).toHaveAttribute('aria-describedby', tooltip.id)
    expect(tooltip).not.toBeVisible()
  })

  it('opens on hover and closes when the pointer leaves', () => {
    const { trigger, tooltip } = renderTooltip()
    fireEvent.mouseEnter(trigger)
    expect(tooltip).toBeVisible()
    fireEvent.mouseLeave(trigger)
    expect(tooltip).not.toBeVisible()
  })

  it('opens on a tap (click) and stays open until focus leaves (QRun-IO/qqq#708)', () => {
    const { trigger, tooltip } = renderTooltip()
    fireEvent.focus(trigger)
    fireEvent.click(trigger)
    expect(tooltip).toBeVisible()
    fireEvent.click(trigger)
    expect(tooltip).toBeVisible()
    fireEvent.blur(trigger)
    expect(tooltip).not.toBeVisible()
  })

  it('stays open while its trigger keeps focus after the pointer leaves (QRun-IO/qqq#708)', () => {
    const { trigger, tooltip } = renderTooltip()
    // a tap hovers, focuses and clicks the trigger; a later layout shift moves it from under the pointer
    fireEvent.mouseEnter(trigger)
    fireEvent.focus(trigger)
    fireEvent.click(trigger)
    fireEvent.mouseLeave(trigger)
    expect(tooltip).toBeVisible()
    fireEvent.blur(trigger)
    expect(tooltip).not.toBeVisible()
  })

  it('stays open while hovered after focus leaves', () => {
    const { trigger, tooltip } = renderTooltip()
    fireEvent.focus(trigger)
    fireEvent.mouseEnter(trigger)
    fireEvent.blur(trigger)
    expect(tooltip).toBeVisible()
    fireEvent.mouseLeave(trigger)
    expect(tooltip).not.toBeVisible()
  })

  it('closes on Escape while hovered and focused', () => {
    const { trigger, tooltip } = renderTooltip()
    fireEvent.mouseEnter(trigger)
    fireEvent.focus(trigger)
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(tooltip).not.toBeVisible()
  })

  it('closes on Escape', () => {
    const { trigger, tooltip } = renderTooltip()
    fireEvent.focus(trigger)
    expect(tooltip).toBeVisible()
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(tooltip).not.toBeVisible()
  })

  it('gives the trigger a 44 px hit area on coarse pointers only', () => {
    const { trigger } = renderTooltip()
    expect(trigger.className).toContain('pointer-coarse:min-h-11')
    expect(trigger.className).toContain('pointer-coarse:min-w-11')
  })
})
