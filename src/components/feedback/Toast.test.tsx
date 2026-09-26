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
import { act, render, renderHook, screen } from '@testing-library/react'
import { toast } from 'sonner'

import { AppToaster, TOASTER_POSITION, TOAST_TOP_VARIABLE, useToastTopBelow } from './Toast'

describe('AppToaster', () => {
  it('shows toasts at the top center, clear of the bottom-right primary actions (QRun-IO/qqq#708)', async () => {
    render(<AppToaster />)
    act(() => {
      toast.error('Failed to create Record Lab')
    })
    const message = await screen.findByText('Failed to create Record Lab')
    const item = message.closest('[data-sonner-toast]')
    expect(item).toHaveAttribute('data-y-position', 'top')
    expect(item).toHaveAttribute('data-x-position', 'center')
    expect(TOASTER_POSITION).toBe('top-center')
  })
})

describe('toasts below the header', () => {
  it('offsets the toaster by the header variable, with the default distance when there is no header', async () => {
    render(<AppToaster />)
    act(() => { toast('Saved') })
    await screen.findByText('Saved')
    const list = document.querySelector('[data-sonner-toaster]') as HTMLElement
    expect(list.style.getPropertyValue('--offset-top')).toBe('var(--qqq-toast-top, 24px)')
    expect(list.style.getPropertyValue('--mobile-offset-top')).toBe('var(--qqq-toast-top, 16px)')
  })

  it('sets the variable just below the header while it is mounted, and clears it after', () => {
    const header = document.createElement('header')
    header.getBoundingClientRect = () => ({ bottom: 100 } as DOMRect)
    document.body.appendChild(header)
    const { unmount } = renderHook(() => useToastTopBelow({ current: header }))
    expect(document.documentElement.style.getPropertyValue(TOAST_TOP_VARIABLE)).toBe('108px')
    header.getBoundingClientRect = () => ({ bottom: 140 } as DOMRect)
    act(() => { window.dispatchEvent(new Event('resize')) })
    expect(document.documentElement.style.getPropertyValue(TOAST_TOP_VARIABLE)).toBe('148px')
    unmount()
    expect(document.documentElement.style.getPropertyValue(TOAST_TOP_VARIABLE)).toBe('')
    header.remove()
  })
})

describe('toasts below a header that moves', () => {
  it('follows the header when content above it resizes one of its ancestors', () => {
    const observed: Element[] = []
    let notify: () => void = () => {}
    const original = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      constructor(callback: () => void) { notify = callback }
      observe(target: Element) { observed.push(target) }
      disconnect() {}
      unobserve() {}
    } as unknown as typeof ResizeObserver
    const column = document.createElement('div')
    const header = document.createElement('header')
    column.appendChild(header)
    document.body.appendChild(column)
    header.getBoundingClientRect = () => ({ bottom: 64 } as DOMRect)
    const { unmount } = renderHook(() => useToastTopBelow({ current: header }))
    expect(observed).toEqual(expect.arrayContaining([header, column, document.body]))
    header.getBoundingClientRect = () => ({ bottom: 117 } as DOMRect)
    act(() => notify())
    expect(document.documentElement.style.getPropertyValue(TOAST_TOP_VARIABLE)).toBe('125px')
    unmount()
    column.remove()
    globalThis.ResizeObserver = original
  })
})
