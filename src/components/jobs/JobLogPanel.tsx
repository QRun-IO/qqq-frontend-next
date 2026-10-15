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

/** @file Plain-text live log with scroll intent preservation and copying. */
'use client'
import { useEffect, useRef, useState } from 'react'
import type { JobLogLineV1 } from '@/types/jobs'

/** Formats one redacted server line without interpreting markup.
 * @param line - Log line.
 * @returns Clipboard and displayed text.
 */
export function jobLogText(line: JobLogLineV1) {
  return `${line.loggedAt ? `${line.loggedAt} ` : ''}[${line.level}] ${line.message}`
}

/** Collapsible log; scrolling up pauses following until the user returns to the bottom.
 * @param props - Visible lines and server retention count.
 * @returns Log panel.
 */
export function JobLogPanel({
  lines,
  logDropped = 0,
}: {
  lines: JobLogLineV1[]
  logDropped?: number
}) {
  const [open, setOpen] = useState(true)
  const [following, setFollowing] = useState(true)
  const [copyMessage, setCopyMessage] = useState('')
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (open && following && panel.current) panel.current.scrollTop = panel.current.scrollHeight
  }, [lines, open, following])
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(lines.map(jobLogText).join('\n'))
      setCopyMessage('Copied')
    } catch {
      setCopyMessage('Could not copy. Select and copy the log text.')
    }
  }
  return (
    <section className="min-w-0 rounded-lg border border-border" data-qqq-id="job-log-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="min-h-11 rounded px-1 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring"
          data-qqq-id="button-job-log-toggle"
        >
          {open ? 'Hide log' : `Show log (${lines.length})`}
        </button>
        {open && (
          <button
            type="button"
            onClick={() => void copy()}
            disabled={!lines.length}
            className="min-h-11 rounded px-2 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            data-qqq-id="button-job-log-copy"
          >
            Copy
          </button>
        )}
      </div>
      {open && (
        <>
          {logDropped > 0 && (
            <p className="px-4 pt-3 text-xs text-muted-foreground">
              {logDropped.toLocaleString()} earlier lines not kept
            </p>
          )}
          <div
            ref={panel}
            role="region"
            aria-label="Job log"
            tabIndex={0}
            onScroll={() => {
              const node = panel.current
              if (node) setFollowing(node.scrollHeight - node.scrollTop - node.clientHeight < 24)
            }}
            className="max-h-72 overflow-y-auto p-4 font-mono text-xs leading-6 focus-visible:ring-2 focus-visible:ring-ring"
            data-qqq-id="job-log-scroll"
          >
            {!lines.length && <p className="text-muted-foreground">Waiting for log messages…</p>}
            {lines.map((line) => (
              <p
                key={line.id}
                className={`whitespace-pre-wrap [overflow-wrap:anywhere] ${line.level === 'ERROR' ? 'text-destructive' : line.level === 'WARN' ? 'text-[var(--qqq-banner-warning-text)]' : line.level === 'DEBUG' ? 'text-muted-foreground' : 'text-foreground'}`}
              >
                {jobLogText(line)}
              </p>
            ))}
          </div>
          {!following && (
            <button
              type="button"
              onClick={() => setFollowing(true)}
              className="m-2 min-h-11 rounded-md bg-primary px-3 text-sm text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring"
              data-qqq-id="button-job-log-latest"
            >
              Jump to latest
            </button>
          )}
        </>
      )}
      <p role="status" className="px-4 text-xs text-muted-foreground">
        {copyMessage}
      </p>
    </section>
  )
}
