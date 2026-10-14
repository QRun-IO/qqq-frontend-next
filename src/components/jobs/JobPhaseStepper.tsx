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

/** @file Wrapping phase list with explicit status labels and reduced-motion-aware running pulse. */
import { Check, Circle, CircleAlert } from 'lucide-react'
import type { JobPhaseV1 } from '@/types/jobs'

/** Renders the server's ordered phases.
 * @param props - Phases.
 * @returns Stepper.
 */
export function JobPhaseStepper({ phases }: { phases: JobPhaseV1[] }) {
  return (
    <ol
      aria-label="Job phases"
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-6"
      data-qqq-id="job-phases"
    >
      {phases.map((phase) => {
        const Icon =
          phase.status === 'DONE' ? Check : phase.status === 'FAILED' ? CircleAlert : Circle
        return (
          <li
            key={phase.name}
            aria-current={phase.status === 'RUNNING' ? 'step' : undefined}
            className={`flex min-w-0 items-center gap-2 text-sm ${phase.status === 'FAILED' ? 'text-destructive' : phase.status === 'PENDING' || phase.status === 'SKIPPED' ? 'text-muted-foreground' : 'text-foreground'}`}
          >
            <Icon
              aria-hidden="true"
              className={`h-4 w-4 shrink-0 ${phase.status === 'RUNNING' ? 'qqq-job-pulse text-primary' : ''}`}
            />
            <span className="break-words">
              {phase.label} <span className="sr-only">{phase.status.toLowerCase()}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
