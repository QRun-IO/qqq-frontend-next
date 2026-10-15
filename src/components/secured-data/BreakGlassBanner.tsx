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

/** @file Persistent emergency access banner, loaded only for the installed extension. */
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { getSecuredDataStatus, type BreakGlassSession } from '@/lib/api/secured-data'
import { queryKeys } from '@/lib/query-client'
import { countdownText, remainingSeconds } from '@/lib/utils/secured-data'

/**
 * Fetch on navigation; poll only while an active session is displayed.
 * @returns The rendered UI or current secured-data context.
 */
export default function BreakGlassBanner() {
  const pathname = usePathname()
  const status = useQuery({
    queryKey: queryKeys.securedDataStatus(pathname),
    queryFn: getSecuredDataStatus,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchInterval: (query) =>
      query.state.data?.breakGlass && remainingSeconds(query.state.data.breakGlass.expiresAt) > 0
        ? 60_000
        : false,
  })
  return status.data?.breakGlass ? <BreakGlassNotice session={status.data.breakGlass} /> : null
}

/**
 * Display expiry and an End link to the standard record action screen.
 * @param props - Component inputs.
 * @returns The rendered UI or current secured-data context.
 */
export function BreakGlassNotice({ session }: { session: BreakGlassSession }) {
  const [seconds, setSeconds] = useState(() => remainingSeconds(session.expiresAt))
  useEffect(() => {
    const update = () => setSeconds(remainingSeconds(session.expiresAt))
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [session.expiresAt])
  if (!seconds) return null
  return (
    <div
      role="alert"
      className="z-40 flex shrink-0 flex-wrap items-center gap-3 border-b border-red-700 bg-red-50 px-4 py-3 text-red-900 dark:border-red-500 dark:bg-red-950 dark:text-red-100"
      data-qqq-id="break-glass-banner"
    >
      <strong className="min-w-0 flex-1 break-words">
        Break-glass access active — {session.reason}
      </strong>
      <span role="timer" aria-label="Break-glass expires in" className="font-mono">
        {countdownText(seconds)}
      </span>
      <Link
        href={`/app/secured_data_break_glass/${encodeURIComponent(String(session.id))}`}
        className="min-h-11 rounded border border-current px-4 py-2 font-semibold"
        data-qqq-id="break-glass-end"
      >
        End
      </Link>
    </div>
  )
}
