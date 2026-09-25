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
 * @file HelpTextComponent — renders a HELP_TEXT process component: its text with
 * line breaks, optionally collapsed behind a "Show {previewText}" toggle.
 */

'use client'

import React, { useId, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

import type { QFrontendComponent } from '@/types'

/** Props for {@link HelpTextComponent}. */
export interface HelpTextComponentProps {
  component: QFrontendComponent
  /** Position of the component on the screen (used for stable ids). */
  index: number
}

/**
 * Split help text on newlines into separate lines.
 * @param text - The text.
 * @returns One element per line.
 */
function lines(text: string): React.ReactNode[] {
  return text.split('\n').map((line, index) => <span key={index} className="block">{line}</span>)
}

/**
 * Render a HELP_TEXT component.
 * @param props - {@link HelpTextComponentProps}
 * @returns The help text block.
 */
export function HelpTextComponent({ component, index }: HelpTextComponentProps) {
  const [expanded, setExpanded] = useState(false)
  const regionId = useId()
  const text = typeof component.values?.text === 'string' ? component.values.text : ''
  const previewText = typeof component.values?.previewText === 'string' ? component.values.previewText : ''

  if (previewText) {
    return (
      <div className="text-sm" data-qqq-id={`process-help-text-${index}`}>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={regionId}
          className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-qqq-id={`button-toggle-help-text-${index}`}
        >
          {expanded ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
          {expanded ? 'Hide' : 'Show'} {previewText}
        </button>
        <div id={regionId} hidden={!expanded} className="mt-1 text-primary">
          {lines(text)}
        </div>
      </div>
    )
  }

  return (
    <div className="text-sm text-primary" data-qqq-id={`process-help-text-${index}`}>
      {lines(text)}
    </div>
  )
}
