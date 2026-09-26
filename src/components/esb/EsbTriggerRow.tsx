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
 * @file EsbTriggerRow — one table row for a process triggered by an ESB destination, with its
 * management actions.
 */

import React from 'react'
import Link from 'next/link'

import type { EsbPermissions, EsbTrigger, EsbTriggerMode, EsbTriggerState } from '@/types'
import { CHIP_COLOR_CLASSES, type ChipColor } from '@/lib/utils/adornment-utils'
import { cn } from '@/lib/utils/cn'
import { EsbTriggerActions, deadLetterQueue } from './EsbActions'
import { EsbCounters } from './EsbCounters'
import { EsbBrowseButton } from './EsbMessageList'

/** Label and chip color for each trigger state. */
const STATES: Record<EsbTriggerState, { label: string; color: ChipColor }> = {
  RUNNING: { label: 'Running', color: 'success' },
  PAUSED: { label: 'Paused', color: 'warning' },
  CONNECTING: { label: 'Connecting', color: 'info' },
  STOPPED: { label: 'Stopped', color: 'default' },
}

/** Label for each trigger mode. */
const MODES: Record<EsbTriggerMode, string> = { SINGLE: 'Single', BATCH: 'Batch' }

/**
 * Renders a trigger as a row of six cells: the process (linked, with its mode, concurrency
 * and attempts), the destination it consumes, its state, its counters, the number of
 * messages in its dead-letter queue (`—` when the broker cannot report it), and its actions:
 * pause or resume, restart and replay when permitted, and browsing its dead letters.
 *
 * @param props - Component props.
 * @param props.trigger - The trigger to show.
 * @param props.permissions - The current user's ESB permissions.
 * @returns A `<tr>` for a table with Process, Destination, State, Counters, Dead letters and
 *   Actions columns.
 */
export function EsbTriggerRow({
  trigger,
  permissions,
}: {
  trigger: EsbTrigger
  permissions: EsbPermissions
}) {
  const state = STATES[trigger.state] ?? { label: trigger.state, color: 'default' }
  const attempts = `${trigger.maxAttempts} ${trigger.maxAttempts === 1 ? 'attempt' : 'attempts'}`

  return (
    <tr
      className="border-b border-border/50 align-top last:border-0"
      data-qqq-id={`esb-trigger-${trigger.name}`}
    >
      <td className="px-2 py-2">
        <Link
          href={`/app/${encodeURIComponent(trigger.processName)}`}
          className="font-medium text-primary underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {trigger.processLabel}
        </Link>
        <p className="text-xs text-muted-foreground">
          {MODES[trigger.mode] ?? trigger.mode}, concurrency {trigger.concurrency}, {attempts}
        </p>
      </td>
      <td className="px-2 py-2 font-mono text-xs text-foreground">{trigger.destination.name}</td>
      <td className="px-2 py-2">
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
            CHIP_COLOR_CLASSES[state.color]
          )}
        >
          {state.label}
        </span>
      </td>
      <td className="px-2 py-2">
        <EsbCounters counters={trigger.counters} kind="consume" />
      </td>
      <td className="px-2 py-2 tabular-nums text-foreground">
        {trigger.deadLetter.messageCount ?? '—'}
      </td>
      <td className="space-y-1 px-2 py-2">
        <EsbTriggerActions trigger={trigger} permissions={permissions} />
        <EsbBrowseButton
          label="Browse dead letters"
          ariaLabel={`Browse dead letters for ${trigger.processLabel}`}
          title={`Dead letters for ${trigger.processLabel}`}
          source={{ kind: 'deadLetters', triggerName: trigger.name }}
          queue={deadLetterQueue(trigger)}
          permissions={permissions}
        />
      </td>
    </tr>
  )
}
