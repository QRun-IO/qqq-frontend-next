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

/** @file Section-gated notification gear; its drawer and form load only when requested. */
'use client'

import { lazy, Suspense, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Settings } from 'lucide-react'
import { getPreferences } from '@/lib/api/preferences'
import { queryKeys } from '@/lib/query-client'

const PreferenceSectionDrawer = lazy(
  () => import('@/components/preferences/PreferenceSectionDrawer')
)

/** Shows the shortcut only for a section visible to the current user.
 * @param props - Summary section name and optional popover visibility callback.
 * @returns Gear and lazily loaded drawer, or nothing.
 */
export function NotificationSettingsButton({
  sectionName,
  onOpenChange,
}: {
  sectionName?: string | null
  onOpenChange?: (open: boolean) => void
}) {
  const query = useQuery({
    queryKey: queryKeys.preferencesIndex(),
    queryFn: getPreferences,
    enabled: Boolean(sectionName),
    staleTime: 30_000,
    retry: false,
  })
  const section = query.data?.sections.find((section) => section.name === sectionName)
  const [open, setOpen] = useState(false)
  const gear = useRef<HTMLButtonElement>(null)
  const changeOpen = (next: boolean) => {
    onOpenChange?.(next)
    setOpen(next)
  }
  if (!section) return null
  return (
    <>
      <button
        ref={gear}
        type="button"
        aria-label="Notification settings"
        aria-haspopup="dialog"
        onClick={() => changeOpen(true)}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        data-qqq-id="notifications-settings-gear"
      >
        <Settings className="h-5 w-5" aria-hidden="true" />
      </button>
      {open && (
        <Suspense
          fallback={
            <span role="status" className="sr-only">
              Loading settings…
            </span>
          }
        >
          <PreferenceSectionDrawer
            section={section}
            open={open}
            onOpenChange={changeOpen}
            returnFocusRef={gear}
          />
        </Suspense>
      )}
    </>
  )
}
