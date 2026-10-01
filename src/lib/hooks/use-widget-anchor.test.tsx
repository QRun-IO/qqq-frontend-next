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

// Tests for useWidgetAnchor: #widgetName deep links on dashboards

import React from 'react'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { act, fireEvent, render } from '@testing-library/react'

import { useWidgetAnchor } from './use-widget-anchor'

/** A dashboard grid with one item per widget name, using the hook. */
function Dashboard({ names }: { names: string[] }) {
  useWidgetAnchor(names)
  return <div>{names.map((name) => <div key={name} id={name}>{name}</div>)}</div>
}

describe('useWidgetAnchor', () => {
  let observers: Array<{ callback: () => void; disconnect: ReturnType<typeof vi.fn> }>
  const scrolled: string[] = []

  beforeEach(() => {
    observers = []
    scrolled.length = 0
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element) { scrolled.push(this.id) }
    globalThis.ResizeObserver = class {
      callback: () => void
      disconnect = vi.fn()
      constructor(callback: () => void) {
        this.callback = callback
        observers.push(this)
      }
      observe() {}
      unobserve() {}
    } as unknown as typeof ResizeObserver
  })

  afterEach(() => {
    window.history.replaceState(null, '', '/')
    vi.useRealTimers()
  })

  it('scrolls to the widget the hash names and follows layout changes until the user scrolls', () => {
    window.history.replaceState(null, '', '/app/dash#accSecond')
    render(<Dashboard names={['accFirst', 'accSecond']} />)
    expect(scrolled).toEqual(['accSecond'])
    act(() => observers[0].callback())
    expect(scrolled).toEqual(['accSecond', 'accSecond'])
    fireEvent.wheel(window)
    expect(observers[0].disconnect).toHaveBeenCalled()
  })

  it('stops following the layout after it settles', () => {
    vi.useFakeTimers()
    window.history.replaceState(null, '', '/app/dash#accFirst')
    render(<Dashboard names={['accFirst']} />)
    act(() => { vi.advanceTimersByTime(3000) })
    expect(observers[0].disconnect).toHaveBeenCalled()
  })

  it('ignores hashes that name no widget of the dashboard', () => {
    window.history.replaceState(null, '', '/app/dash#audit')
    render(<Dashboard names={['accFirst']} />)
    expect(scrolled).toEqual([])
    window.history.replaceState(null, '', '/app/dash')
    render(<Dashboard names={['accFirst']} />)
    expect(scrolled).toEqual([])
  })

  it('decodes an encoded hash', () => {
    window.history.replaceState(null, '', '/app/dash#acc%20Spaced')
    render(<Dashboard names={['acc Spaced']} />)
    expect(scrolled).toEqual(['acc Spaced'])
  })
})
