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

/** @file Accessible progress with a monotonic eased fill for the current mounted attempt. */
'use client'
import { useState } from 'react'
import './jobs.css'

/** A determinate or indeterminate bar. Remount for another job/attempt.
 * @param props - Percentage and accessible label.
 * @returns Progress bar.
 */
export function JobProgressBar({
  percent,
  label = 'Job progress',
}: {
  percent?: number | null
  label?: string
}) {
  const value =
    typeof percent === 'number' && Number.isFinite(percent)
      ? Math.max(0, Math.min(100, percent))
      : null
  const [highWater, setHighWater] = useState(value ?? 0)
  if (value !== null && value > highWater) setHighWater(value)
  const displayed = value === null ? null : Math.max(value, highWater)
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={displayed ?? undefined}
      aria-valuetext={displayed === null ? 'In progress' : `${Math.round(displayed)}%`}
      className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
      data-qqq-id="job-progress-bar"
    >
      <div
        className={`h-full w-full rounded-full bg-primary ${displayed === null ? 'qqq-job-shimmer' : 'qqq-job-fill'}`}
        style={displayed === null ? undefined : { transform: `scaleX(${displayed / 100})` }}
      />
    </div>
  )
}
