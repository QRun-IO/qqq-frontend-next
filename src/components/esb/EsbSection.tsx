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
 * @file EsbSection — the ESB part of a table's Developer view: the destinations the table
 * publishes to and the processes those destinations trigger, with per-node counters.
 */

import React, { useId } from 'react'
import { Network } from 'lucide-react'

import type { EsbDestinationType, EsbTableResponse } from '@/types'
import { EsbCounters } from './EsbCounters'
import { EsbTriggerRow } from './EsbTriggerRow'

/** Label for each destination type. */
const DESTINATION_TYPES: Record<EsbDestinationType, string> = { QUEUE: 'Queue', TOPIC: 'Topic' }

/** Props for {@link EsbSection}. */
interface EsbSectionProps {
  /** The table's ESB data, or `null` when the table has none or the user may not see it. */
  data: EsbTableResponse | null
}

/**
 * Renders a table's ESB publications and subscribers, or nothing when `data` is `null`.
 *
 * @param props - Component props.
 * @param props.data - Response of `GET /esb/table/{table}`, or `null`.
 * @returns A section with a Publications table (destination, type, events, counters, queue
 *   depth) and a Subscribers table (process, destination, state, counters, dead letters),
 *   each replaced by a sentence when empty; or `null`.
 */
export function EsbSection({ data }: EsbSectionProps) {
  const headingId = useId()
  if (!data) return null

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-4 rounded-xl border border-border bg-card p-4"
      data-qqq-id={`esb-section-${data.table}`}
    >
      <div className="flex items-center gap-2">
        <Network className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <h3 id={headingId} className="text-lg font-semibold text-foreground">
          Enterprise Service Bus
        </h3>
      </div>

      <EsbList
        title="Publications"
        columns={['Destination', 'Type', 'Events', 'Counters', 'Queue depth']}
        empty="This table does not publish to any destination."
      >
        {data.publications.map(({ destination, events }) => (
          <tr
            key={destination.name}
            className="border-b border-border/50 align-top last:border-0"
            data-qqq-id={`esb-publication-${destination.name}`}
          >
            <td className="px-2 py-2 font-mono text-xs text-foreground">{destination.name}</td>
            <td className="px-2 py-2 text-foreground">
              {DESTINATION_TYPES[destination.type] ?? destination.type}
            </td>
            <td className="px-2 py-2 text-foreground">{events.join(', ')}</td>
            <td className="px-2 py-2">
              <EsbCounters counters={destination.counters} kind="publish" />
            </td>
            <td className="px-2 py-2 tabular-nums text-foreground">
              {destination.queueInfo ? destination.queueInfo.messageCount : '—'}
            </td>
          </tr>
        ))}
      </EsbList>

      <EsbList
        title="Subscribers"
        columns={['Process', 'Destination', 'State', 'Counters', 'Dead letters']}
        empty="No processes you can access are triggered by these destinations."
      >
        {data.subscribers.map((trigger) => (
          <EsbTriggerRow key={trigger.name} trigger={trigger} />
        ))}
      </EsbList>
    </section>
  )
}

/**
 * A titled table of ESB rows, or a sentence when there are none.
 *
 * @param props - Component props.
 * @param props.title - Heading, also the table's accessible name.
 * @param props.columns - Column headings.
 * @param props.empty - Sentence shown when there are no rows.
 * @param props.children - The table rows.
 * @returns The heading followed by the table or the empty sentence.
 */
function EsbList({
  title,
  columns,
  empty,
  children,
}: {
  title: string
  columns: string[]
  empty: string
  children: React.ReactNode[]
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-foreground">{title}</h4>
      {children.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label={title}>
            <thead>
              <tr className="border-b border-border text-left">
                {columns.map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="whitespace-nowrap px-2 py-1.5 font-medium text-muted-foreground"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>{children}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}
