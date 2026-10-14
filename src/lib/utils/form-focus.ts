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
 * @file form-focus — moving the user to the first field that needs attention after a failed save:
 * which invalid field comes first on the page, scrolling and focusing it, and whether the other
 * invalid fields would be out of sight (the only time a summary is worth showing).
 */

/**
 * Finds a field's control in the form by the `data-qqq-id` the form puts on every control.
 *
 * @param form - The form element.
 * @param name - The field name.
 * @returns The control, if it is rendered.
 */
export function fieldElement(form: HTMLElement, name: string): HTMLElement | null {
  const id = name.split('"').join('')
  const selector = ['input', 'textarea', 'select', 'button', '[role="combobox"]'].map((tag) => `${tag}[data-qqq-id="${id}"]`).join(', ')
  return form.querySelector<HTMLElement>(selector)
}

/**
 * Orders field names as their controls appear on the page; names with no control keep their place at the end.
 *
 * @param form - The form element.
 * @param names - Field names.
 * @returns The names in page order.
 */
export function inPageOrder(form: HTMLElement, names: readonly string[]): string[] {
  const placed = names.map((name) => ({ name, element: fieldElement(form, name) }))
  return placed
    .sort((a, b) => {
      if (!a.element || !b.element) return a.element ? -1 : b.element ? 1 : 0
      return a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    })
    .map(({ name }) => name)
}

/**
 * Scrolls a control to the middle of the view and focuses it, gently unless the user prefers less motion.
 *
 * @param element - The control.
 */
export function revealField(element: HTMLElement): void {
  const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  element.scrollIntoView?.({ block: 'center', behavior: reduced ? 'auto' : 'smooth' })
  element.focus({ preventScroll: true })
}

/**
 * Whether any of the other fields sits far enough from the revealed one to be out of sight
 * once it is centred.
 *
 * @param first - The control being revealed (it ends up mid-screen).
 * @param others - The remaining invalid controls.
 * @returns `true` when at least one would be off screen.
 */
export function anyOffScreen(first: HTMLElement, others: readonly HTMLElement[]): boolean {
  const firstTop = first.getBoundingClientRect().top
  const reach = window.innerHeight / 2 - 40
  return others.some((element) => Math.abs(element.getBoundingClientRect().top - firstTop) > reach)
}
