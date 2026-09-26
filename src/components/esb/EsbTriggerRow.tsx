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
 * @file EsbTriggerRow — one table row for a process triggered by an ESB destination.
 */

import React from 'react'
import Link from 'next/link'

import type { EsbTrigger, EsbTriggerMode, EsbTriggerState } from '@/types'
import { CHIP_COLOR_CLASSES, type ChipColor } from '@/lib/utils/adornment-utils'
import { cn } from '@/lib/utils/cn'
import { EsbCounters } from './EsbCounters'

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
 * Renders a trigger as a row of five cells: the process (linked, with its mode, concurrency
 * and attempts), the destination it consumes, its state, its counters, and the number of
 * messages in its dead-letter queue (`—` when the broker cannot report it).
 *
 * @param props - Component props.
 * @param props.trigger - The trigger to show.
 * @returns A `<tr>` for a table with Process, Destination, State, Counters and Dead letters columns.
 */
export function EsbTriggerRow({ trigger }: { trigger: EsbTrigger }) {
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
    </tr>
  )
}
