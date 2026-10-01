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
// Section anchors on a phone (QRun-IO/qqq#708): the accordion item renders its section only after
// the link opens it, so the scroll waits for the section to appear.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { scrollIntoViewWhenRendered } from './scroll-when-rendered'

describe('scrollIntoViewWhenRendered', () => {
  const scrolled: Element[] = []

  beforeEach(() => {
    scrolled.length = 0
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) { scrolled.push(this) })
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('scrolls to an element that is already rendered', async () => {
    document.body.innerHTML = '<section data-qqq-id="record-section-dates"></section>'
    scrollIntoViewWhenRendered('[data-qqq-id="record-section-dates"]')
    await vi.waitFor(() => expect(scrolled.map((node) => node.getAttribute('data-qqq-id'))).toEqual(['record-section-dates']))
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
  })

  it('waits for an element that renders a few frames later (an accordion item opening)', async () => {
    scrollIntoViewWhenRendered('[data-qqq-id="record-section-employmentInfo"]')
    await new Promise((resolve) => setTimeout(resolve, 80))
    expect(scrolled).toEqual([])
    document.body.innerHTML = '<section data-qqq-id="record-section-employmentInfo"></section>'
    await vi.waitFor(() => expect(scrolled.map((node) => node.getAttribute('data-qqq-id'))).toEqual(['record-section-employmentInfo']))
  })

  it('stops waiting when cancelled or after the frame budget', async () => {
    const cancel = scrollIntoViewWhenRendered('[data-qqq-id="record-section-late"]')
    cancel()
    scrollIntoViewWhenRendered('[data-qqq-id="record-section-never"]', { maxFrames: 2 })
    await new Promise((resolve) => setTimeout(resolve, 120))
    document.body.innerHTML = '<section data-qqq-id="record-section-late"></section><section data-qqq-id="record-section-never"></section>'
    await new Promise((resolve) => setTimeout(resolve, 120))
    expect(scrolled).toEqual([])
  })
})
