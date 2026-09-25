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
 * @file HtmlComponent — renders an HTML process component: the sanitized HTML the
 * backend placed in the `{stepName}.html` process value.
 */

'use client'

import React, { useMemo } from 'react'
import DOMPurify from 'dompurify'

import { useProcessStep } from './ProcessStepContext'

/** Props for {@link HtmlComponent}. */
export interface HtmlComponentProps {
  index: number
}

//////////////////////////////////////////////////////////////////////////////
// DOMPurify's default URI rule, plus inline CSV and plain-text files, which //
// bulk load instructions offer as downloadable templates                   //
//////////////////////////////////////////////////////////////////////////////
const ALLOWED_URI_REGEXP = /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|data:text\/(?:csv|plain)[;,]|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i

/**
 * Sanitize process HTML for display.
 * @param html - Backend-provided HTML.
 * @returns Safe HTML.
 */
export function sanitizeProcessHtml(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_URI_REGEXP })
}

/**
 * Render an HTML component.
 * @param props - {@link HtmlComponentProps}
 * @returns The sanitized HTML, or nothing when the step has none.
 */
export function HtmlComponent({ index }: HtmlComponentProps) {
  const { step, values } = useProcessStep()
  const raw = values[`${step.name}.html`]
  const html = useMemo(() => (typeof raw === 'string' && raw ? sanitizeProcessHtml(raw) : ''), [raw])
  if (!html) return null
  return (
    <div
      className="prose prose-sm max-w-none text-foreground"
      data-qqq-id={`process-html-${index}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
