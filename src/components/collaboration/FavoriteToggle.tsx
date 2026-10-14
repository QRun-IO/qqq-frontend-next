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

/** @file Accessible favorite toggle shared by record, table and app headers. */

'use client'

import { Star } from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip'
import type { CollaborationTarget } from '@/types/collaboration'
import {
  sameFavorite,
  useCollaborationAvailable,
  useFavorites,
  useToggleFavorite,
} from '@/lib/hooks/use-collaboration'

/**
 * Renders a star only when collaboration is installed.
 * @param props - Target identity and metadata-derived display information.
 * @returns Keyboard-accessible pressed button with a tooltip, or nothing.
 */
export function FavoriteToggle({
  target,
  label,
  href,
}: {
  target: CollaborationTarget
  label: string
  href: string
}) {
  const available = useCollaborationAvailable()
  const favorites = useFavorites()
  const toggle = useToggleFavorite()
  if (!available.data) return null
  const starred = favorites.data?.items.some((item) => sameFavorite(item, target)) ?? false
  const title = starred ? 'Remove from favorites' : 'Add to favorites'
  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            data-qqq-id="favorite-toggle"
            aria-label={title}
            aria-pressed={starred}
            disabled={!favorites.isSuccess || toggle.isPending}
            onClick={() => toggle.mutate({ ...target, starred, label, href })}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <Star className="h-5 w-5" fill={starred ? 'currentColor' : 'none'} aria-hidden="true" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={4}
            className="z-[200] rounded bg-popover px-3 py-2 text-sm text-popover-foreground shadow"
          >
            {title}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
