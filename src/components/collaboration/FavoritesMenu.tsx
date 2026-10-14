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

/** @file Personal favorites grouped by folder in a viewport-bounded header popover. */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import * as Popover from '@radix-ui/react-popover'
import { Star, X } from 'lucide-react'
import {
  useCollaborationAvailable,
  useFavorites,
  useToggleFavorite,
} from '@/lib/hooks/use-collaboration'
import { withTrailingSlash } from '@/lib/utils/material-links'
import { CollaborationIcon } from './CollaborationIcon'

/**
 * Shows favorites on demand, with removals for entries whose visibility has changed.
 * @returns The header trigger and its popover, or nothing when unavailable.
 */
export function FavoritesMenu() {
  const [open, setOpen] = useState(false)
  const available = useCollaborationAvailable()
  const favorites = useFavorites(open)
  const toggle = useToggleFavorite()
  if (!available.data) return null
  const groups = new Map<string, NonNullable<typeof favorites.data>['items']>()
  for (const item of favorites.data?.items ?? []) {
    const folder = item.folder ?? 'Unfiled'
    groups.set(folder, [...(groups.get(folder) ?? []), item])
  }
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Favorites"
          data-qqq-id="favorites-menu"
          className="flex items-center justify-center rounded-lg p-2 hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Star className="h-5 w-5 text-foreground/60" aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={16}
          aria-label="Favorites"
          className="z-[160] w-80 max-w-[calc(100vw-32px)] rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg"
          data-qqq-id="favorites-popover"
        >
          <div className="mb-2 flex items-center justify-between">
            <h2 className="px-2 font-semibold">Favorites</h2>
            <Popover.Close
              aria-label="Close favorites"
              data-qqq-id="favorites-close"
              className="flex min-h-11 min-w-11 items-center justify-center rounded hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </Popover.Close>
          </div>
          <div className="max-h-[min(60vh,24rem)] overflow-y-auto">
            {favorites.isPending && (
              <p role="status" className="p-2 text-sm">
                Loading favorites…
              </p>
            )}
            {favorites.isError && (
              <p role="alert" className="p-2 text-sm">
                Could not load favorites.{' '}
                <button
                  type="button"
                  data-qqq-id="favorites-retry"
                  onClick={() => favorites.refetch()}
                  className="underline"
                >
                  Try again
                </button>
              </p>
            )}
            {favorites.isSuccess && groups.size === 0 && (
              <p className="p-2 text-sm text-muted-foreground">
                No favorites yet. Use the star on any table, app or record.
              </p>
            )}
            {[...groups].map(([folder, items]) => (
              <section key={folder} aria-label={folder} className="mt-2 first:mt-0">
                <h3 className="break-words px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {folder}
                </h3>
                {items.map((item, index) => (
                  <div
                    key={item.id ?? index}
                    className="flex min-w-0 items-center gap-2 pl-2"
                    data-qqq-id="favorite-row"
                  >
                    <CollaborationIcon type={item.targetType} />
                    {item.available && item.href ? (
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        data-qqq-id="favorite-link"
                        className="min-w-0 flex-1 truncate rounded py-3 text-sm hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <span className="min-w-0 flex-1 truncate py-3 text-sm text-muted-foreground">
                        Unavailable
                      </span>
                    )}
                    <button
                      type="button"
                      data-qqq-id="favorite-remove"
                      aria-label={`Remove ${item.label} from favorites`}
                      disabled={toggle.isPending}
                      onClick={() => toggle.mutate({ ...item, starred: true })}
                      className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </section>
            ))}
          </div>
          <Link href={withTrailingSlash('/app/my-work')} onClick={() => setOpen(false)} data-qqq-id="favorites-my-work" className="block rounded border-t border-border px-2 py-3 text-sm font-medium hover:underline">My work</Link>
          <Link
            href={withTrailingSlash('/app/collaboration_favorite')}
            onClick={() => setOpen(false)}
            data-qqq-id="favorites-manage"
            className="mt-2 block rounded border-t border-border px-2 py-3 text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            Manage
          </Link>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
