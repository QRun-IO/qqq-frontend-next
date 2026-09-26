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
 * @file EsbSection — the ESB part of a table's or process's Developer view: the destinations it
 * publishes to and the triggers on them, with per-node counters and management actions.
 */

import React, { useId } from 'react'
import { Network } from 'lucide-react'

import type {
  EsbDestination,
  EsbDestinationType,
  EsbPermissions,
  EsbProcessResponse,
  EsbTableResponse,
} from '@/types'
import { EsbQueueActions, destinationQueue } from './EsbActions'
import { EsbCounters } from './EsbCounters'
import { EsbBrowseButton } from './EsbMessageList'
import { EsbTriggerRow } from './EsbTriggerRow'

/** Label for each destination type. */
export const DESTINATION_TYPES: Record<EsbDestinationType, string> = { QUEUE: 'Queue', TOPIC: 'Topic' }

/** Column headings of a trigger table, matching {@link EsbTriggerRow}. */
export const TRIGGER_COLUMNS = ['Process', 'Destination', 'State', 'Counters', 'Dead letters', 'Actions']

/** Props for {@link EsbSection}. */
interface EsbSectionProps {
  /** The table's or process's ESB data, or `null` when it has none or the user may not see it. */
  data: EsbTableResponse | EsbProcessResponse | null
}

/**
 * Renders a table's or process's ESB publications and triggers, or nothing when `data` is `null`.
 *
 * @param props - Component props.
 * @param props.data - Response of `GET /esb/table/{table}` or `GET /esb/process/{process}`, or `null`.
 * @returns A section with a Publications table (destination, type, events, counters, queue
 *   depth, actions) and a Subscribers table for a table or a Triggers table for a process
 *   (process, destination, state, counters, dead letters, actions), each replaced by a
 *   sentence when empty; or `null`.
 */
export function EsbSection({ data }: EsbSectionProps) {
  const headingId = useId()
  if (!data) return null

  const isTable = 'table' in data
  const owner = isTable ? data.table : data.process
  const triggers = isTable ? data.subscribers : data.triggers

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-4 rounded-xl border border-border bg-card p-4"
      data-qqq-id={`esb-section-${owner}`}
    >
      <div className="flex items-center gap-2">
        <Network className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <h3 id={headingId} className="text-lg font-semibold text-foreground">
          Enterprise Service Bus
        </h3>
      </div>

      <EsbList
        title="Publications"
        columns={['Destination', 'Type', 'Events', 'Counters', 'Queue depth', 'Actions']}
        empty={`This ${isTable ? 'table' : 'process'} does not publish to any destination.`}
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
            <td className="px-2 py-2">
              <EsbDestinationActions destination={destination} permissions={data.permissions} />
            </td>
          </tr>
        ))}
      </EsbList>

      <EsbList
        title={isTable ? 'Subscribers' : 'Triggers'}
        columns={TRIGGER_COLUMNS}
        empty={
          isTable
            ? 'No processes you can access are triggered by these destinations.'
            : 'No destinations trigger this process.'
        }
      >
        {triggers.map((trigger) => (
          <EsbTriggerRow key={trigger.name} trigger={trigger} permissions={data.permissions} />
        ))}
      </EsbList>
    </section>
  )
}

/**
 * Browsing and management actions for the queue behind a destination. A topic has none: its
 * messages wait in each trigger's subscription, not on the topic.
 *
 * @param props - Component props.
 * @param props.destination - The destination.
 * @param props.permissions - The current user's ESB permissions.
 * @returns A browse button when the broker supports browsing, and the permitted queue actions;
 *   or `null` for a topic.
 */
export function EsbDestinationActions({
  destination,
  permissions,
}: {
  destination: EsbDestination
  permissions: EsbPermissions
}) {
  const queue = destinationQueue(destination)
  if (!queue) return null
  return (
    <div className="space-y-1">
      {queue.capabilities.browse && (
        <EsbBrowseButton
          label="Browse"
          ariaLabel={`Browse ${destination.name}`}
          title={`Messages in ${destination.name}`}
          source={{ kind: 'destination', name: destination.name }}
          queue={queue}
          permissions={permissions}
        />
      )}
      <EsbQueueActions queue={queue} permissions={permissions} />
    </div>
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
export function EsbList({
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
