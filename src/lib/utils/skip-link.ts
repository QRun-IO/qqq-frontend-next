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


/**
 * @file skip-link — where the "Skip to main content" link moves keyboard focus: the first zone of
 * the page (the first widget of an app home), else the main region itself.
 */

import { MAIN_CONTENT_ID } from './scroll-to-top'

/** Selector of the first zone of a page: the first widget of an app home. */
const FIRST_ZONE_SELECTOR = '[data-qqq-id^="widget-grid-item-"]'

/**
 * Finds the element the skip link targets: the first widget in `<main>`, else `<main>`.
 *
 * @returns The element, or `null` when the page has no main region.
 */
export function findSkipTarget(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const main = document.getElementById(MAIN_CONTENT_ID)
  return main?.querySelector<HTMLElement>(FIRST_ZONE_SELECTOR) ?? main
}

/**
 * Moves focus to the skip target. The target is made programmatically focusable
 * (`tabindex="-1"`) when it is not already, so focus really moves and the next Tab continues
 * from there.
 *
 * @returns True when focus moved.
 */
export function skipToFirstZone(): boolean {
  const target = findSkipTarget()
  if (!target) return false
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
  target.focus()
  target.scrollIntoView?.({ block: 'start' })
  return true
}
