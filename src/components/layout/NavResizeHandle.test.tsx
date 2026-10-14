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

// Tests for the navigation resize handle: separator semantics, keyboard resizing, reset and persistence

import React from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { NAV_WIDTH_KEY, NAV_WIDTH_VAR } from '@/lib/utils/nav-width'
import { NavResizeHandle } from './NavResizeHandle'

/** A panel with the handle; jsdom has no layout, so the panel measures as 0 px wide. */
function Harness() {
  return (
    <div data-testid="panel">
      <NavResizeHandle controls="nav" />
    </div>
  )
}

const panelVar = () => screen.getByTestId('panel').style.getPropertyValue(NAV_WIDTH_VAR)
const handle = () => screen.getByRole('separator', { name: 'Resize navigation' })

beforeEach(() => {
  window.innerWidth = 1440
})

afterEach(() => {
  localStorage.clear()
})

describe('NavResizeHandle', () => {
  it('is a focusable vertical separator with its value range', () => {
    render(<Harness />)
    const el = handle()
    expect(el).toHaveAttribute('aria-orientation', 'vertical')
    expect(el).toHaveAttribute('aria-controls', 'nav')
    expect(el).toHaveAttribute('aria-valuenow', '256')
    expect(el).toHaveAttribute('aria-valuemin', '200')
    expect(el).toHaveAttribute('aria-valuemax', '480')
    expect(el).toHaveAttribute('tabindex', '0')
  })

  it('restores the stored width before paint', () => {
    localStorage.setItem(NAV_WIDTH_KEY, '320')
    render(<Harness />)
    expect(panelVar()).toBe('320px')
  })

  it('resizes with the arrow keys and remembers the width', () => {
    render(<Harness />)
    fireEvent.keyDown(handle(), { key: 'ArrowRight' })
    expect(panelVar()).toBe('272px')
    expect(handle()).toHaveAttribute('aria-valuenow', '272')
    fireEvent.keyDown(handle(), { key: 'ArrowRight', shiftKey: true })
    expect(panelVar()).toBe('336px')
    fireEvent.keyDown(handle(), { key: 'ArrowLeft' })
    expect(panelVar()).toBe('320px')
    expect(localStorage.getItem(NAV_WIDTH_KEY)).toBe('320')
  })

  it('jumps to the limits with Home and End', () => {
    render(<Harness />)
    fireEvent.keyDown(handle(), { key: 'End' })
    expect(panelVar()).toBe('480px')
    fireEvent.keyDown(handle(), { key: 'Home' })
    expect(panelVar()).toBe('200px')
  })

  it('caps End at 40% of a narrower window', () => {
    window.innerWidth = 1024
    render(<Harness />)
    expect(handle()).toHaveAttribute('aria-valuemax', '409')
    fireEvent.keyDown(handle(), { key: 'End' })
    expect(panelVar()).toBe('409px')
  })

  it('resets to the default and forgets the width on double-click', () => {
    localStorage.setItem(NAV_WIDTH_KEY, '400')
    render(<Harness />)
    fireEvent.doubleClick(handle())
    expect(panelVar()).toBe('')
    expect(localStorage.getItem(NAV_WIDTH_KEY)).toBeNull()
    expect(handle()).toHaveAttribute('aria-valuenow', '256')
  })

  it('ignores keys that do not resize', () => {
    render(<Harness />)
    fireEvent.keyDown(handle(), { key: 'Enter' })
    expect(panelVar()).toBe('')
    expect(localStorage.getItem(NAV_WIDTH_KEY)).toBeNull()
  })
})
