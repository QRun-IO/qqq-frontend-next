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

/** @file Accessible exact-run status and action shared by both profile panels. */
'use client'
import { controlClass, ProfileError } from './ProfileParts'
import type { useExactRun } from './use-exact-run'

/** Renders an exact-run control without inventing a percentage absent from the contract.
 * @param props - Run state.
 * @returns Action, live progress and errors.
 */
export function ExactRun({ exact }: { exact: ReturnType<typeof useExactRun> }) {
  const error = exact.start.error ?? exact.run.error
  return (
    <div className="space-y-2">
      <button
        className={controlClass}
        disabled={exact.busy}
        onClick={() => exact.start.mutate()}
        data-qqq-id="analysis-run-exact"
      >
        Run exact
      </button>
      {exact.busy && (
        <p role="status">
          {exact.start.isPending ? 'Starting exact analysis…' : 'Exact analysis running…'}
        </p>
      )}
      {exact.run.data?.status === 'COMPLETE' && <p role="status">Exact analysis complete</p>}
      {exact.run.data?.status === 'FAILED' && (
        <p role="alert">{exact.run.data.error || 'Exact analysis failed.'}</p>
      )}
      {error && <ProfileError error={error} />}
    </div>
  )
}
