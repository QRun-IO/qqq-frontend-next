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
 * @file EsbCounters — compact list of a destination's or trigger's per-node ESB counters.
 */

import React from 'react'

import type { EsbCounter } from '@/types'
import { formatDateTime } from '@/lib/utils/datetime-utils'

/** Which side of a destination the counters describe. */
export type EsbCountersKind = 'publish' | 'consume'

/** Numeric counts shown for each kind, with their labels. */
const COUNTS: Record<EsbCountersKind, ReadonlyArray<readonly [keyof EsbCounter, string]>> = {
  publish: [
    ['published', 'Published'],
    ['publishFailures', 'Publish failures'],
  ],
  consume: [
    ['consumed', 'Consumed'],
    ['succeeded', 'Succeeded'],
    ['failed', 'Failed'],
    ['retried', 'Retried'],
    ['deadLettered', 'Dead-lettered'],
    ['inFlight', 'In flight'],
  ],
}

/**
 * Renders counters as a wrapping description list: publish counts for a publication,
 * consume counts and processing times for a trigger, then last activity and last error.
 *
 * @param props - Component props.
 * @param props.counters - The counter snapshot.
 * @param props.kind - `publish` for a publication's destination, `consume` for a trigger.
 * @returns The counters as `<dl>` term/value pairs.
 */
export function EsbCounters({ counters, kind }: { counters: EsbCounter; kind: EsbCountersKind }) {
  const items = COUNTS[kind].map(([key, label]) => [label, String(counters[key])])
  if (kind === 'consume') {
    items.push(
      ['Avg time', `${Math.round(counters.avgMs)} ms`],
      ['Max time', `${Math.round(counters.maxMs)} ms`]
    )
  }
  items.push(['Last activity', formatDateTime(counters.lastActivity) ?? '—'])

  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {items.map(([label, value]) => (
        <div key={label} className="flex gap-1">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-medium tabular-nums text-foreground">{value}</dd>
        </div>
      ))}
      {counters.lastError && (
        <div className="flex basis-full gap-1">
          <dt className="text-muted-foreground">Last error</dt>
          <dd className="break-words text-destructive">{counters.lastError}</dd>
        </div>
      )}
    </dl>
  )
}
