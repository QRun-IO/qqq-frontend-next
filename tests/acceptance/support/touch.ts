/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Phone and tablet layout checks (QRun-IO/qqq#708), shared by the @mobile / @tablet specs.
import type { Locator, Page } from '@playwright/test'
import { expect } from './fixtures'

/** Minimum touch target edge in CSS px (WCAG 2.5.5). */
export const TOUCH_TARGET = 44

/** Controls that must meet the touch target size. */
const CONTROLS = [
  'a[href]', 'button', 'select', 'textarea', 'summary', 'input:not([type=hidden])',
  '[role=button]', '[role=checkbox]', '[role=radio]', '[role=switch]', '[role=tab]', '[role=combobox]',
  '[role=menuitem]', '[role=menuitemcheckbox]', '[role=menuitemradio]', '[role=option]', '[role=link]',
].join(',')

/**
 * Asserts the page does not scroll sideways: nothing is wider than the viewport.
 *
 * @param page - The page.
 */
export async function expectNoHorizontalScroll(page: Page) {
  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: window.innerWidth }))
  expect(widths.scroll, `page is ${widths.scroll}px wide in a ${widths.viewport}px viewport`).toBeLessThanOrEqual(widths.viewport + 1)
}

/**
 * Lists the visible controls in `scope` whose touch target is below 44 x 44 CSS px. Only a
 * coarse (touch) pointer is checked; with a mouse the desktop sizes stand, so the list is empty.
 * A checkbox or radio counts its wrapping label as its target, links in running text and in
 * data values (table cells, definition values) are exempt (WCAG 2.5.5 inline exception), and
 * so are controls hidden from assistive technology or visually hidden (skip links until focus).
 *
 * @param scope - The page, or a region of it.
 * @returns Descriptions of undersized controls, empty when every target is large enough.
 */
export async function undersizedTargets(scope: Page | Locator): Promise<string[]> {
  const target: Locator = 'mainFrame' in scope ? scope.locator('body') : scope
  return target.evaluate((element, { selector, size }) => {
    if (!matchMedia('(pointer: coarse)').matches) return []
    const inlineText = (control: Element) => {
      if (control.tagName !== 'A') return false
      const display = getComputedStyle(control).display
      return display === 'inline' && !!control.closest('p, td, dd, li, [data-inline-text]')
    }
    const problems: string[] = []
    for (const control of element.querySelectorAll(selector)) {
      const rect = control.getBoundingClientRect()
      const style = getComputedStyle(control)
      if (rect.width === 0 || rect.height === 0 || style.visibility === 'hidden') continue
      if (rect.width <= 1 && rect.height <= 1) continue // visually hidden (sr-only) until focused
      if (control.closest('[aria-hidden="true"], [inert]')) continue
      if (inlineText(control)) continue
      let box = rect
      if (control instanceof HTMLInputElement && (control.type === 'checkbox' || control.type === 'radio')) {
        const label = control.closest('label') ?? (control.id ? document.querySelector(`label[for="${CSS.escape(control.id)}"]`) : null)
        if (label) box = label.getBoundingClientRect()
      }
      if (box.width + 0.5 < size || box.height + 0.5 < size) {
        const id = control.getAttribute('data-qqq-id') ?? control.closest('[data-qqq-id]')?.getAttribute('data-qqq-id') ?? ''
        const name = control.getAttribute('aria-label') ?? (control.textContent ?? '').trim().slice(0, 40)
        problems.push(`${control.tagName.toLowerCase()} ${id} "${name}" ${Math.round(box.width)}x${Math.round(box.height)}`)
      }
    }
    return problems
  }, { selector: CONTROLS, size: TOUCH_TARGET })
}

/**
 * Asserts every visible control in `scope` is at least 44 x 44 CSS px on a touch screen.
 *
 * @param scope - The page, or a region of it (a dialog, a sheet).
 */
export async function expectTouchTargets(scope: Page | Locator) {
  expect(await undersizedTargets(scope), 'controls below the 44 x 44 px touch target').toEqual([])
}

/**
 * Asserts the phone/tablet basics for what is on screen: no sideways page scroll and touch-sized controls.
 *
 * @param page - The page.
 * @param scope - Optional region to check targets in (defaults to the whole page).
 */
export async function expectTouchReady(page: Page, scope?: Locator) {
  await expectNoHorizontalScroll(page)
  await expectTouchTargets(scope ?? page)
}
