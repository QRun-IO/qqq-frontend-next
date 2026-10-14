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

/** @file Progress labels with a silent, once-per-second elapsed clock. */

'use client'

import { useEffect, useState } from 'react'
import type { AssistantRun } from './use-assistant-engine'

/**
 * Displays elapsed time without repeatedly announcing ticks to screen readers.
 *
 * @param props - The start time.
 * @param props.startedAt - ISO timestamp of the turn's start.
 * @returns The elapsed clock.
 */
export function AssistantElapsed({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [startedAt])
  const seconds = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000)) || 0
  return <span aria-live="off">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span>
}

/**
 * Shows the current phase; only phase changes enter the polite live region.
 *
 * @param props - The running answer.
 * @param props.run - Current progress and start time.
 * @returns The progress line.
 */
export function AssistantRunStatus({ run }: { run: AssistantRun }) {
  const label = run.status === 'cancelling' ? 'Stopping...'
    : run.phase === 'starting' ? 'Starting...'
      : run.phase === 'tool' ? `Using ${run.toolLabel || 'tool'}...`
        : run.phase === 'writing' ? 'Writing...' : 'Thinking...'
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground" data-qqq-id="assistant-run-status">
      <span aria-live="polite" aria-atomic="true">{label}</span>
      <AssistantElapsed startedAt={run.startedAt} />
    </p>
  )
}
