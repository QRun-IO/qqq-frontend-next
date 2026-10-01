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
 * @file JsonPreview — Material's `DataBagPreview`: a JSON value as an expandable tree. Objects
 * and arrays are disclosure buttons (keyboard operable, `aria-expanded`), collapsed at first;
 * other values show as `key: value`. Text that is not valid JSON shows the parse error.
 */

'use client'

import React, { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

/** Props for {@link JsonPreview}. */
export interface JsonPreviewProps {
  /** JSON text to parse and show. */
  json: string
  /** Suffix of the toggles' `data-qqq-id`s. */
  idKey: string
  /** Extra classes for the wrapper. */
  className?: string
}

/**
 * Whether a value opens as a branch of the tree.
 * @param value - A parsed JSON value.
 * @returns True for objects and arrays (not null).
 */
function isBranch(value: unknown): value is Record<string, unknown> | unknown[] {
  return value !== null && typeof value === 'object'
}

/**
 * Display text of a JSON leaf value.
 * @param value - A parsed JSON value (string, number, boolean or null).
 * @returns The text Material shows (`String(value)`).
 */
function leafText(value: unknown): string {
  return value === null ? 'null' : String(value)
}

/**
 * The expandable tree of a JSON document.
 *
 * @param props - {@link JsonPreviewProps}
 * @returns The tree, or the parse error.
 */
export function JsonPreview({ json, idKey, className }: JsonPreviewProps) {
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const parsed = useMemo((): { value?: unknown; error?: string } => {
    try {
      return { value: JSON.parse(json) }
    } catch (error) {
      return { error: `Error parsing JSON: ${error instanceof Error ? error.message : String(error)}` }
    }
  }, [json])

  if (parsed.error) {
    return <p role="alert" className={cn('p-2 text-sm text-destructive', className)} data-qqq-id={`json-preview-error-${idKey}`}>{parsed.error}</p>
  }

  /**
   * Opens or closes a branch.
   * @param path - The branch's path.
   */
  function toggle(path: string) {
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  /**
   * One level of the tree.
   * @param value - An object or array.
   * @param path - Path of this level (`""` at the root).
   * @returns The list of entries.
   */
  function renderLevel(value: Record<string, unknown> | unknown[], path: string): React.ReactNode {
    const entries = Object.entries(value)
    if (entries.length === 0) return <p className="ml-6 text-sm text-muted-foreground">{Array.isArray(value) ? '(empty list)' : '(empty)'}</p>
    return (
      <ul className="ml-3 space-y-0.5">
        {entries.map(([key, child]) => {
          const childPath = `${path}.${key}`
          const expanded = open.has(childPath)
          return (
            <li key={key} className="text-sm">
              {isBranch(child) ? (
                <>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => toggle(childPath)}
                    className="inline-flex items-center gap-1 rounded text-left font-medium text-foreground hover:underline focus:outline-none focus:ring-2 focus:ring-ring"
                    data-qqq-id={`json-preview-toggle-${idKey}-${childPath.slice(1)}`}
                  >
                    {expanded ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
                    {key}:
                  </button>
                  {expanded && renderLevel(child, childPath)}
                </>
              ) : (
                <span data-qqq-id={`json-preview-value-${idKey}-${childPath.slice(1)}`}>
                  <span className="inline-block w-5 text-center text-muted-foreground" aria-hidden="true">&bull;</span>
                  <span className="font-medium text-foreground">{key}:</span>
                  {' '}
                  <span className="break-all text-foreground">{leafText(child)}</span>
                </span>
              )}
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <div className={cn('font-mono', className)} data-qqq-id={`json-preview-${idKey}`}>
      {isBranch(parsed.value)
        ? renderLevel(parsed.value, '')
        : <p className="text-sm text-foreground">{leafText(parsed.value)}</p>}
    </div>
  )
}
