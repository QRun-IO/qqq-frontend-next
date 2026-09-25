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
 * @file SafeHtml — renders backend-supplied widget HTML after DOMPurify sanitization.
 */
'use client'

import React, { useMemo } from 'react'
import DOMPurify from 'dompurify'

/** Props accepted by {@link SafeHtml}. */
interface SafeHtmlProps {
  /** Backend HTML (widget html, descriptions, footers, bullets). */
  html: string
  /** Element to render; defaults to `div`. */
  as?: 'div' | 'span' | 'li' | 'p'
  className?: string
  qqqId?: string
}

/**
 * Renders sanitized HTML. Scripts, event handlers and other active content are
 * stripped by DOMPurify; ordinary formatting (b, i, u, strong, em, lists, links,
 * inline styles) is preserved.
 *
 * @param props - See {@link SafeHtmlProps}.
 * @returns The element with sanitized inner HTML.
 */
export function SafeHtml({ html, as = 'div', className, qqqId }: SafeHtmlProps) {
  const clean = useMemo(() => DOMPurify.sanitize(html), [html])
  return React.createElement(as, { className, 'data-qqq-id': qqqId, dangerouslySetInnerHTML: { __html: clean } })
}
