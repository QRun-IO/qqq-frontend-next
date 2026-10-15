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
 * @file QA capture entries for the user menu: "Report a bug" (when the capability allows
 * reporting) and "QA reports" (when the server sends a reports link, followed as given).
 * Renders nothing when QA capture is not available.
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Bug, ClipboardList } from 'lucide-react'
import { toast } from 'sonner'
import { useQaCaptureCapability } from '@/lib/hooks/use-qa-capture'
import { queryKeys } from '@/lib/query-client'
import { startBugReport } from '@/lib/qa-capture/report'
import type { RouteMetaData } from '@/lib/qa-capture/route-context'
import { cn } from '@/lib/utils/cn'

const ITEM_CLASS = cn(
  'flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-foreground',
  'hover:bg-accent transition-colors focus:outline-none focus:bg-accent',
  'disabled:cursor-not-allowed disabled:opacity-60'
)

/** Message shown when a report has no Recording Link to open. */
export const NO_RECORDING_LINK_MESSAGE = 'Bug report saved, but the recorder cannot open: an administrator must set the Recording Link in the QA capture settings.'

/**
 * The QA capture menu items.
 *
 * @param props - Component properties.
 * @param props.onSelect - Called when an item is chosen (closes the menu).
 * @returns The items, or null.
 */
export function ReportBugMenuItems({ onSelect }: { onSelect?: () => void }) {
  const capability = useQaCaptureCapability()
  const client = useQueryClient()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  if (!capability?.enabled) return null
  const reportsHref = capability.reportsHref

  /** Creates the report and opens the recorder, reporting the outcome in a toast. */
  async function report() {
    if (!capability || busy) return
    setBusy(true)
    onSelect?.()
    try {
      const outcome = await startBugReport({ capability, metaData: client.getQueryData<RouteMetaData>(queryKeys.metadataAll()) })
      if (outcome.kind === 'no-recording-link') {
        toast.warning(NO_RECORDING_LINK_MESSAGE, {
          duration: 10_000,
          ...(reportsHref ? { action: { label: 'QA reports', onClick: () => router.push(reportsHref) } } : {}),
        })
      }
    } catch (error) {
      toast.error(error instanceof Error && error.message ? `Could not start the bug report: ${error.message}` : 'Could not start the bug report.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {capability.canReport && (
        <button type="button" role="menuitem" className={ITEM_CLASS} disabled={busy} onClick={() => void report()} data-qqq-id="menu-item-report-bug">
          <Bug className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {busy ? 'Starting bug report…' : 'Report a bug'}
        </button>
      )}
      {reportsHref && (
        <Link href={reportsHref} role="menuitem" className={ITEM_CLASS} onClick={() => onSelect?.()} data-qqq-id="menu-item-qa-reports">
          <ClipboardList className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          QA reports
        </Link>
      )}
    </>
  )
}
