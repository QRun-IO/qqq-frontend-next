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
 * @file HelpContent — renders one help content entry in its declared format.
 */

'use client'

import React, { useMemo } from 'react'
import DOMPurify from 'dompurify'

import type { QHelpContent } from '@/types'
import { cn } from '@/lib/utils/cn'

interface HelpContentProps {
  /** The entry to render. */
  helpContent: QHelpContent
  /** Element id, for `aria-describedby` references. */
  id?: string
  /** `data-qqq-id` for CSS customization. */
  'data-qqq-id'?: string
  /** Additional CSS classes. */
  className?: string
}

/**
 * Renders help text: TEXT as plain text (line breaks kept), HTML sanitized, and
 * MARKDOWN through the backend's rendered `contentAsHtml` (sanitized).
 *
 * @param props - See {@link HelpContentProps}.
 * @returns A span with the help content.
 */
export function HelpContent({ helpContent, id, 'data-qqq-id': dataQqqId, className }: HelpContentProps) {
  const format = helpContent.format ?? 'TEXT'
  const html = format === 'HTML' ? helpContent.content : format === 'MARKDOWN' ? helpContent.contentAsHtml : undefined
  const sanitized = useMemo(() => (html ? DOMPurify.sanitize(html) : undefined), [html])

  if (sanitized !== undefined) {
    return (
      <span
        id={id}
        data-qqq-id={dataQqqId}
        data-help-format={format}
        className={cn('help-content [&_p]:inline', className)}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    )
  }
  return (
    <span id={id} data-qqq-id={dataQqqId} data-help-format={format} className={cn('help-content whitespace-pre-line', className)}>
      {helpContent.content}
    </span>
  )
}
