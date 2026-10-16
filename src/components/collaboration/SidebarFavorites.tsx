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

/** @file The personal Favorites section at the top of the sidebar: collapsed, up to five, hidden when empty. */

'use client'

import Link from 'next/link'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useCollaborationAvailable, useFavorites } from '@/lib/hooks/use-collaboration'
import { withTrailingSlash } from '@/lib/utils/material-links'
import { CollaborationIcon } from './CollaborationIcon'

/** How many favorites the sidebar lists; the rest are one click away. */
export const SIDEBAR_FAVORITES_LIMIT = 5

/** Props for {@link SidebarFavorites}. */
export interface SidebarFavoritesProps {
  /** Current browser path, to mark the current favorite. */
  pathname: string
  /** Whether the section is expanded (collapsed by default). */
  open: boolean
  /** Expands or collapses the section. */
  onToggle: (next: boolean) => void
}

/**
 * The signed-in user's favorites (collaboration), in the sidebar like Atlassian's "Starred" and
 * Linear's favorites: collapsed by default, the first five when open, then "All favorites".
 *
 * @param props - Component properties.
 * @returns The section, or nothing without collaboration or favorites.
 */
export function SidebarFavorites({ pathname, open, onToggle }: SidebarFavoritesProps) {
  const available = useCollaborationAvailable()
  const favorites = useFavorites(available.data === true)
  const items = (favorites.data?.items ?? []).filter((item) => item.available && item.href)
  if (!available.data || items.length === 0) return null
  const shown = items.slice(0, SIDEBAR_FAVORITES_LIMIT)
  const current = pathname.replace(/\/+$/, '')

  return (
    <div role="group" aria-labelledby="sidebar-favorites-heading" className="mb-3 border-b border-border/60 pb-3" data-qqq-id="sidebar-favorites">
      <button
        id="sidebar-favorites-heading"
        type="button"
        onClick={() => onToggle(!open)}
        aria-expanded={open}
        aria-controls="sidebar-favorites-list"
        className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
        data-qqq-id="sidebar-favorites-toggle"
      >
        <span className="flex-1">Favorites</span>
        <span className="font-normal normal-case" aria-label={`${items.length} ${items.length === 1 ? 'item' : 'items'}`}>· {items.length}</span>
        {open ? <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
      </button>
      {open && (
        <ul id="sidebar-favorites-list" role="list" className="mt-0.5 space-y-0.5">
          {shown.map((item, index) => {
            const href = item.href as string
            const active = current === href.replace(/\/+$/, '')
            return (
              <li key={item.id ?? index} role="listitem">
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11 ${
                    active ? 'qqq-sidebar-active bg-primary text-primary-foreground shadow-sm' : 'text-foreground/70 hover:bg-accent hover:text-foreground'
                  }`}
                  data-qqq-id="sidebar-favorite-link"
                >
                  <CollaborationIcon type={item.targetType} />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            )
          })}
          <li role="listitem">
            <Link
              href={withTrailingSlash('/app/collaboration_favorite')}
              className="flex items-center rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
              data-qqq-id="sidebar-favorites-all"
            >
              {items.length > SIDEBAR_FAVORITES_LIMIT ? `All favorites (${items.length})` : 'Manage favorites'}
            </Link>
          </li>
        </ul>
      )}
    </div>
  )
}
