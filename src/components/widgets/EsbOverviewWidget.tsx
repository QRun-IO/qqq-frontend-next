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
 * @file EsbOverviewWidget — the ESB app's `ESB_OVERVIEW` widget: every provider, destination,
 * publisher and trigger from `GET /esb/overview`, with per-node counters and management actions.
 */

'use client'

import React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'

import type { EsbOverviewDestination, EsbPermissions, EsbProviderType, QWidgetMetaData } from '@/types'
import { getEsbOverview } from '@/lib/api/esb'
import { HANDLES_OWN_ERRORS, queryKeys } from '@/lib/query-client'
import { CHIP_COLOR_CLASSES } from '@/lib/utils/adornment-utils'
import { cn } from '@/lib/utils/cn'
import { EsbCounters } from '@/components/esb/EsbCounters'
import {
  DESTINATION_TYPES,
  EsbDestinationActions,
  EsbList,
  TRIGGER_COLUMNS,
} from '@/components/esb/EsbSection'
import { EsbTriggerRow } from '@/components/esb/EsbTriggerRow'

/** Label for each provider type. */
const PROVIDER_TYPES: Record<EsbProviderType, string> = {
  ACTIVEMQ_ARTEMIS: 'ActiveMQ Artemis',
  RABBITMQ: 'RabbitMQ',
}

/**
 * Renders the ESB overview. The widget's own payload carries nothing it needs: the data comes
 * from the permission-checked overview endpoint, so management actions refresh it.
 *
 * @param props - Component props.
 * @param props.widgetMetaData - The widget's metadata, for `data-qqq-id` scoping.
 * @returns Providers, Destinations and Triggers tables; or a loading, error or unavailable state.
 */
export function EsbOverviewWidget({ widgetMetaData }: { widgetMetaData: QWidgetMetaData }) {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.esbOverview(),
    queryFn: getEsbOverview,
    meta: HANDLES_OWN_ERRORS,
  })

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Loading ESB status…
      </p>
    )
  }
  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        Failed to load ESB status: {error instanceof Error ? error.message : 'Unknown error'}
      </p>
    )
  }
  if (!data) return <p className="text-sm text-muted-foreground">ESB status is not available.</p>

  const triggers = data.destinations.flatMap((destination) => destination.triggers)

  return (
    <div className="space-y-6" data-qqq-id={`widget-esb-overview-${widgetMetaData.name}`}>
      <EsbList
        title="Providers"
        columns={['Provider', 'Type', 'Connection', 'Management API']}
        empty="No ESB providers are configured."
      >
        {data.providers.map((provider) => (
          <tr
            key={provider.name}
            className="border-b border-border/50 align-top last:border-0"
            data-qqq-id={`esb-provider-${provider.name}`}
          >
            <td className="px-2 py-2 font-mono text-xs text-foreground">{provider.name}</td>
            <td className="px-2 py-2 text-foreground">
              {PROVIDER_TYPES[provider.type] ?? provider.type}
            </td>
            <td className="px-2 py-2">
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                  CHIP_COLOR_CLASSES[provider.connected ? 'success' : 'error']
                )}
              >
                {provider.connected ? 'Connected' : 'Disconnected'}
              </span>
            </td>
            <td className="px-2 py-2 text-foreground">
              {provider.managementEnabled ? 'Enabled' : 'Not configured'}
            </td>
          </tr>
        ))}
      </EsbList>

      <EsbList
        title="Destinations"
        columns={['Destination', 'Type', 'Publishers', 'Queue depth', 'Counters', 'Actions']}
        empty="No destinations are configured."
      >
        {data.destinations.map((destination) => (
          <DestinationRow
            key={destination.name}
            destination={destination}
            permissions={data.permissions}
          />
        ))}
      </EsbList>

      <EsbList title="Triggers" columns={TRIGGER_COLUMNS} empty="No triggers on processes you can access.">
        {triggers.map((trigger) => (
          <EsbTriggerRow key={trigger.name} trigger={trigger} permissions={data.permissions} />
        ))}
      </EsbList>
    </div>
  )
}

/**
 * One destination with its provider, the tables and processes publishing to it, queue depth,
 * counters and actions.
 *
 * @param props - Component props.
 * @param props.destination - The destination.
 * @param props.permissions - The current user's ESB permissions.
 * @returns The row.
 */
function DestinationRow({
  destination,
  permissions,
}: {
  destination: EsbOverviewDestination
  permissions: EsbPermissions
}) {
  return (
    <tr
      className="border-b border-border/50 align-top last:border-0"
      data-qqq-id={`esb-destination-${destination.name}`}
    >
      <td className="px-2 py-2">
        <p className="font-mono text-xs text-foreground">{destination.name}</p>
        <p className="text-xs text-muted-foreground">on {destination.provider}</p>
      </td>
      <td className="px-2 py-2 text-foreground">
        {DESTINATION_TYPES[destination.type] ?? destination.type}
      </td>
      <td className="px-2 py-2">
        {destination.publishers.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <ul className="space-y-1">
            {destination.publishers.map((publisher) => (
              <li key={`${publisher.kind}-${publisher.name}`} className="text-foreground">
                <span className="text-xs text-muted-foreground">
                  {publisher.kind === 'TABLE' ? 'Table' : 'Process'}{' '}
                </span>
                <Link
                  href={`/app/${encodeURIComponent(publisher.name)}`}
                  className="font-medium text-primary underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {publisher.name}
                </Link>
                <span className="text-xs text-muted-foreground">: {publisher.events.join(', ')}</span>
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className="px-2 py-2 tabular-nums text-foreground">
        {destination.queueInfo ? destination.queueInfo.messageCount : '—'}
      </td>
      <td className="px-2 py-2">
        <EsbCounters counters={destination.counters} kind="publish" />
      </td>
      <td className="px-2 py-2">
        <EsbDestinationActions destination={destination} permissions={permissions} />
      </td>
    </tr>
  )
}
