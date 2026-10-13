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
 * @file FormErrorSummary — a compact "2 fields need attention" strip with a link to each field,
 * shown after a failed save only when some of those fields are out of sight.
 */

'use client'

import React from 'react'

/** A field that needs attention. */
export interface SummaryItem {
  name: string
  label: string
}

/** Props for {@link FormErrorSummary}. */
interface FormErrorSummaryProps {
  items: readonly SummaryItem[]
  /** Moves the user to a field. */
  onSelect: (name: string) => void
}

/**
 * Renders the summary strip; it stays in view at the top of the form while the user scrolls.
 *
 * @param props - See {@link FormErrorSummaryProps}.
 * @returns The strip, or nothing when every field is fixed.
 */
export function FormErrorSummary({ items, onSelect }: FormErrorSummaryProps) {
  if (items.length === 0) return null
  return (
    <div
      role="status"
      className="sticky top-0 z-10 flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-md border border-destructive/40 bg-background px-3 py-2 text-sm shadow-sm"
      data-qqq-id="form-error-summary"
    >
      <span className="font-medium text-destructive">
        {items.length === 1 ? '1 field needs attention' : `${items.length} fields need attention`}
      </span>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {items.map((item) => (
          <li key={item.name}>
            <button type="button" onClick={() => onSelect(item.name)} className="text-foreground underline underline-offset-2 hover:text-primary focus:outline-none focus:ring-2 focus:ring-ring">
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
