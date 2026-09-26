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
 * @file ProcessDeveloperView — a process's Developer view: a metadata summary, the process's ESB
 * publications and triggers, and its full metadata as JSON.
 */

'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronUp, Code } from 'lucide-react'

import type { EsbProcessResponse, QProcessMetaData } from '@/types'
import { EsbSection } from './EsbSection'

/** Props for {@link ProcessDeveloperView}. */
interface ProcessDeveloperViewProps {
  /** The process's metadata. */
  process: QProcessMetaData
  /** The process's ESB data, or `null` when it has none or the user may not see it. */
  esb: EsbProcessResponse | null
}

/**
 * Renders a process's Developer view.
 *
 * @param props - See {@link ProcessDeveloperViewProps}.
 * @returns A heading, a summary (label, step count, table, access), the `<EsbSection>` when
 *   `esb` is not `null`, and a collapsible block with the full metadata as JSON.
 */
export function ProcessDeveloperView({ process, esb }: ProcessDeveloperViewProps) {
  const [jsonOpen, setJsonOpen] = useState(false)
  const stats: Array<[string, string]> = [
    ['Label', process.label],
    ['Steps', String((process.frontendSteps ?? []).length)],
    ['Table', process.tableName || '—'],
    ['Access', process.hasPermission === false ? 'Denied' : 'Allowed'],
  ]

  return (
    <div className="space-y-6" data-qqq-id={`process-dev-${process.name}`}>
      <div className="flex items-center gap-3">
        <Code className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-2xl font-semibold text-foreground">
          Process Developer View: <span className="font-mono text-primary">{process.name}</span>
        </h2>
      </div>

      <div className="space-y-4">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4">
              <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-lg font-semibold text-foreground">{value}</dd>
            </div>
          ))}
        </dl>

        <EsbSection data={esb} />

        <div className="overflow-hidden rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setJsonOpen((open) => !open)}
            className="flex w-full items-center justify-between bg-muted px-4 py-3 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring"
            aria-expanded={jsonOpen}
            data-qqq-id="button-json-block-toggle"
          >
            <span className="flex items-center gap-2">
              <Code className="h-4 w-4" aria-hidden="true" />
              Full Process Metadata
            </span>
            {jsonOpen ? (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          {jsonOpen && (
            <pre
              className="overflow-x-auto bg-gray-900 p-4 text-xs text-green-300"
              data-qqq-id="json-output"
            >
              {JSON.stringify(process, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}
