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


// Tests for the skip link target: the first zone of the page, made focusable

import { afterEach, describe, expect, it } from 'vitest'

import { findSkipTarget, skipToFirstZone } from './skip-link'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('skip link', () => {
  it('targets the first widget of an app home and moves focus to it', () => {
    document.body.innerHTML = `<main id="main-content" tabindex="-1">
      <h1>Home</h1>
      <section data-qqq-id="widget-grid">
        <div data-qqq-id="widget-grid-item-first"><h2>First</h2></div>
        <div data-qqq-id="widget-grid-item-second"><h2>Second</h2></div>
      </section></main>`
    const first = document.querySelector<HTMLElement>('[data-qqq-id="widget-grid-item-first"]')!
    expect(findSkipTarget()).toBe(first)
    expect(skipToFirstZone()).toBe(true)
    expect(first).toHaveAttribute('tabindex', '-1')
    expect(document.activeElement).toBe(first)
  })

  it('falls back to the main region when the page has no widgets (and main is focusable)', () => {
    document.body.innerHTML = '<main id="main-content" tabindex="-1"><h1>Dashboard</h1></main>'
    const main = document.getElementById('main-content')!
    expect(findSkipTarget()).toBe(main)
    expect(skipToFirstZone()).toBe(true)
    expect(document.activeElement).toBe(main)
  })

  it('does nothing without a main region', () => {
    document.body.innerHTML = '<div>no main</div>'
    expect(findSkipTarget()).toBeNull()
    expect(skipToFirstZone()).toBe(false)
  })
})
