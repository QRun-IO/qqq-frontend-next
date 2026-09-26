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
 * @file The one HTML sanitizer for backend and record HTML (field values, widgets,
 * process steps, help content, banners, the rich text editor).
 *
 * DOMPurify's defaults already remove scripts, event handlers and `javascript:`
 * URLs. The UI additionally removes what lets stored HTML impersonate the
 * application (QRun-IO/qqq#696):
 * - `<style>` elements, which restyle or hide the whole page;
 * - forms and form controls, which can collect a password inside the trusted UI
 *   and post it elsewhere;
 * - inline `position` other than static or relative (fixed, absolute, sticky),
 *   which lets content cover the page (a fake sign-in overlay).
 * Ordinary formatting, links, images, tables and other inline styles are kept.
 */

import DOMPurify, { type Config, type DOMPurify as Purifier } from 'dompurify'

/** Elements removed from rendered HTML (with their content, for style). */
export const FORBIDDEN_TAGS = ['style', 'form', 'input', 'button', 'textarea', 'select', 'option', 'optgroup', 'datalist', 'dialog']

/** The only positioning kept: anything else (fixed, absolute, sticky, var(...)) can leave its container. */
const CONTAINED_POSITION = /^(?:static|relative)?$/i

let purifier: Purifier | null = null

/**
 * The shared DOMPurify instance with the UI's hooks (created on first use, in the browser).
 *
 * @returns The instance.
 */
function instance(): Purifier {
  if (!purifier) {
    purifier = DOMPurify(window)
    purifier.addHook('afterSanitizeAttributes', (node) => {
      const element = node as Element & { style?: CSSStyleDeclaration }
      if (typeof element.getAttribute !== 'function' || !element.style || !element.getAttribute('style')) return
      if (!CONTAINED_POSITION.test(element.style.position.trim())) element.style.removeProperty('position')
      if (!element.getAttribute('style')?.trim()) element.removeAttribute('style')
    })
  }
  return purifier
}

/** Options for {@link sanitizeHtml}. */
export interface SanitizeHtmlOptions {
  /** URI allow-list replacing DOMPurify's default (for example to allow data: CSV downloads). */
  allowedUriRegexp?: RegExp
}

/**
 * Sanitizes HTML for `dangerouslySetInnerHTML`.
 *
 * @param html - Untrusted HTML.
 * @param options - Optional URI allow-list.
 * @returns Safe HTML (empty outside the browser, where nothing is rendered from data).
 */
export function sanitizeHtml(html: string | null | undefined, options: SanitizeHtmlOptions = {}): string {
  if (!html || typeof window === 'undefined') return ''
  const config: Config = { FORBID_TAGS: FORBIDDEN_TAGS, ...(options.allowedUriRegexp ? { ALLOWED_URI_REGEXP: options.allowedUriRegexp } : {}) }
  return instance().sanitize(html, config) as string
}
