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

// Material page shortcuts (QRun-IO/qqq#714)

import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { hasOpenOverlay, isTextEntryTarget, usePageShortcuts } from './use-page-shortcuts'

function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('usePageShortcuts', () => {
  it('runs the mapped action for a plain key and prevents its default', () => {
    const edit = vi.fn()
    renderHook(() => usePageShortcuts({ e: edit, d: false }))
    const event = press('e')
    expect(edit).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
    // unmapped and disabled keys do nothing
    expect(press('d').defaultPrevented).toBe(false)
    expect(press('x').defaultPrevented).toBe(false)
  })

  it('ignores modified keys, repeats, text entry and open overlays', () => {
    const create = vi.fn()
    renderHook(() => usePageShortcuts({ n: create }))
    press('n', { ctrlKey: true })
    press('n', { metaKey: true })
    press('n', { altKey: true })
    press('n', { repeat: true })

    const input = document.createElement('input')
    document.body.appendChild(input)
    press('n', {}, input)

    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    document.body.appendChild(dialog)
    press('n')
    expect(create).not.toHaveBeenCalled()

    dialog.remove()
    press('n')
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('is off when disabled and uses the latest actions', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(({ action, enabled }) => usePageShortcuts({ r: action }, enabled), {
      initialProps: { action: first, enabled: false },
    })
    press('r')
    expect(first).not.toHaveBeenCalled()
    rerender({ action: second, enabled: true })
    press('r')
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})

describe('isTextEntryTarget', () => {
  it('treats text controls as text entry and buttons and checkboxes as not', () => {
    const make = (html: string) => {
      const wrapper = document.createElement('div')
      wrapper.innerHTML = html
      return wrapper.firstElementChild
    }
    expect(isTextEntryTarget(make('<input type="text">'))).toBe(true)
    expect(isTextEntryTarget(make('<input type="search">'))).toBe(true)
    expect(isTextEntryTarget(make('<textarea></textarea>'))).toBe(true)
    expect(isTextEntryTarget(make('<select></select>'))).toBe(true)
    expect(isTextEntryTarget(make('<input type="checkbox">'))).toBe(false)
    expect(isTextEntryTarget(make('<button>Go</button>'))).toBe(false)
    expect(isTextEntryTarget(null)).toBe(false)
  })

  it('detects open menus and alert dialogs', () => {
    expect(hasOpenOverlay(document)).toBe(false)
    document.body.innerHTML = '<div role="menu"></div>'
    expect(hasOpenOverlay(document)).toBe(true)
    document.body.innerHTML = '<div role="alertdialog"></div>'
    expect(hasOpenOverlay(document)).toBe(true)
  })
})
