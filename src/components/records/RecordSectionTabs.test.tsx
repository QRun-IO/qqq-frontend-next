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

import { useState } from 'react'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RecordSectionTabs } from './RecordSectionTabs'

const tabs = Array.from({ length: 13 }, (_, index) => ({ id: `section-${index}`, label: `Section ${index}` }))
let width = 390
let resize: () => void
const disconnect = vi.fn()

function Harness() {
  const [activeTab, setActiveTab] = useState(tabs[0].id)
  return <>
    <RecordSectionTabs tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} tabId="test" label="Record sections" />
    <div role="tabpanel" id="test-panel" aria-labelledby={`test-${activeTab}`}>{activeTab}</div>
  </>
}

beforeEach(() => {
  width = 390
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resize = callback }
    observe = vi.fn()
    disconnect = disconnect
  })
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return { width: this.textContent === 'More' ? 80 : 120, height: 40, x: 0, y: 0, top: 0, left: 0, right: 120, bottom: 40, toJSON: () => ({}) }
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('RecordSectionTabs', () => {
  it.each([[390, 2], [768, 5], [1024, 7], [1440, 11], [1920, 13]])('fits a %i px container without horizontal scrolling', async (containerWidth, count) => {
    width = containerWidth
    const { container } = render(<Harness />)
    expect(screen.getAllByRole('tab')).toHaveLength(count)
    for (const element of container.querySelectorAll('[data-qqq-id="record-tabs-container"], [data-qqq-id="record-tabs-container"] *')) {
      expect(element.getAttribute('class') ?? '').not.toMatch(/overflow-(?:x-)?(?:auto|scroll)/)
      expect(getComputedStyle(element).overflowX).not.toMatch(/auto|scroll/)
    }
    if (count < tabs.length) {
      await userEvent.setup().click(screen.getByRole('button', { name: 'More sections' }))
      expect(screen.getAllByRole('menuitem')).toHaveLength(tabs.length - count)
      expect(within(screen.getByRole('menu')).getByText('Section 12')).toBeInTheDocument()
    } else {
      expect(screen.queryByRole('button', { name: 'More sections' })).not.toBeInTheDocument()
    }
  })

  it('activates an overflow section and keeps its tab and panel label visible', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'More sections' }))
    await user.click(screen.getByRole('menuitem', { name: 'Section 12' }))
    expect(screen.getByRole('tab', { name: 'Section 12' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel', { name: 'Section 12' })).toHaveTextContent('section-12')
    expect(screen.getAllByRole('tab')).toHaveLength(2)
    expect(screen.queryByRole('tab', { name: 'Section 1' })).not.toBeInTheDocument()
  })

  it('moves keyboard focus only across visible tabs and reaches More with Tab', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    screen.getByRole('tab', { name: 'Section 0' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Section 1' })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Section 0' })).toHaveFocus()
    await user.keyboard('{ArrowLeft}{Home}{End}')
    expect(screen.getByRole('tab', { name: 'Section 1' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'More sections' })).toHaveFocus()
    await user.keyboard('{Enter}{End}{Enter}')
    expect(screen.getByRole('tab', { name: 'Section 12' })).toHaveAttribute('aria-selected', 'true')
  })

  it('recalculates on resize and disconnects on unmount', () => {
    const { unmount } = render(<Harness />)
    expect(screen.getAllByRole('tab')).toHaveLength(2)
    act(() => { width = 1920; resize() })
    expect(screen.getAllByRole('tab')).toHaveLength(13)
    expect(screen.queryByRole('button', { name: 'More sections' })).not.toBeInTheDocument()
    act(() => { width = 768; resize() })
    expect(screen.getAllByRole('tab')).toHaveLength(5)
    unmount()
    expect(disconnect).toHaveBeenCalled()
  })

  it('wraps safely when ResizeObserver is unavailable', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    render(<Harness />)
    expect(screen.getByRole('tablist')).toHaveClass('flex-wrap')
    expect(screen.getAllByRole('tab')).toHaveLength(13)
  })
})
