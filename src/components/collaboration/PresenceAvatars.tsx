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

/** @file Other viewers with editing badges and accessible name tooltips. */
'use client'
import { Pencil } from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip'
import type { PresenceViewer } from '@/types/collaboration'
/** Wraps viewer initials at narrow widths.
 * @param props - Merged people.
 * @returns Avatars.
 */
export function PresenceAvatars({ viewers }: { viewers: PresenceViewer[] }) {
  return (
    <Tooltip.Provider>
      <div
        className="flex flex-wrap items-center gap-2"
        aria-label="Other viewers"
        data-qqq-id="presence-avatars"
      >
        {viewers.map((viewer) => (
          <Tooltip.Root key={viewer.userId}>
            <Tooltip.Trigger asChild>
              <button
                type="button"
                className="relative flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-foreground ring-1 ring-border"
                aria-label={`${viewer.displayName}${viewer.mode === 'EDITING' ? ' (editing)' : ' (viewing)'}`}
                data-qqq-id={`presence-${viewer.userId}`}
              >
                {viewer.displayName
                  .split(/\s+/)
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')}
                {viewer.mode === 'EDITING' && (
                  <Pencil
                    aria-hidden
                    className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-card p-0.5"
                  />
                )}
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                className="z-50 rounded border border-border bg-popover px-2 py-1 text-sm text-popover-foreground"
                sideOffset={5}
              >
                {viewer.displayName}
                {viewer.mode === 'EDITING' ? ' · Editing' : ''}
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        ))}
      </div>
    </Tooltip.Provider>
  )
}
