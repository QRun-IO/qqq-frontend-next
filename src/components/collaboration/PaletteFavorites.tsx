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
 * @file The command palette's Favorites and "This page" groups, and its server record
 * recents. The palette loads this module when it opens, so the collaboration hooks and
 * helpers stay out of the dashboard layout's first load.
 */

'use client'

import { useEffect, useMemo } from 'react'
import { Command } from 'cmdk'
import { Star } from 'lucide-react'
import type { QInstance } from '@/types'
import type { RecentRecord } from '@/lib/utils/recent-records'
import { commandMatches } from '@/lib/utils/command-palette'
import { favoritePageTarget, paletteFavorites, paletteRecents } from '@/lib/utils/command-palette-collaboration'
import {
  sameFavorite,
  useCollaborationAvailable,
  useFavorites,
  useRecents,
  useToggleFavorite,
} from '@/lib/hooks/use-collaboration'
import { GroupHeading, ITEM_CLASS } from '@/components/feedback/command-menu-parts'
import { CollaborationIcon } from './CollaborationIcon'

/** What the palette needs from these groups for its empty state, highlight and Recent group. */
export interface PaletteFavoritesState {
  /** Whether either group shows an entry. */
  hasEntries: boolean
  /** The cmdk value of the first entry shown, if any. */
  firstValue: string | undefined
  /** Server record recents when collaboration is installed; null keeps browser history. */
  history: RecentRecord[] | null
}

/** Props of {@link PaletteFavorites}. */
interface PaletteFavoritesProps {
  search: string
  pathname: string
  hash: string
  metaData?: QInstance
  /** Browser history, for the current record's label. */
  recentRecords: RecentRecord[]
  /** Navigates to an entry and closes the palette. */
  onSelect: (path: string) => void
  /** Reports the groups' state to the palette. */
  onState: (state: PaletteFavoritesState) => void
}

/**
 * Renders the Favorites group and the current page's star action, first in the palette.
 * @param props - Palette search and location, and the callbacks into the palette.
 * @returns The groups, or nothing when collaboration is unavailable.
 */
export function PaletteFavorites({ search, pathname, hash, metaData, recentRecords, onSelect, onState }: PaletteFavoritesProps) {
  const available = useCollaborationAvailable()
  const favorites = useFavorites()
  const recents = useRecents()
  const toggleFavorite = useToggleFavorite()
  const favoriteTarget = favoritePageTarget(pathname, hash, metaData)
  const pageStarred = !!favoriteTarget && !!favorites.data?.items.some((item) => sameFavorite(item, favoriteTarget))
  const starAction = pageStarred ? 'Unstar this page' : 'Star this page'
  const visibleFavorites = paletteFavorites(favorites.data?.items ?? [], search)
  const showStarAction = available.data === true && !!favoriteTarget && (!search || commandMatches(starAction, search))
  const history = useMemo(
    () => (available.data === true ? paletteRecents(true, recents.data?.items ?? [], recentRecords, metaData) : null),
    [available.data, recents.data, recentRecords, metaData]
  )
  const showWork = available.data === true && (!search || commandMatches('Go to My work', search))
  const firstValue = (visibleFavorites[0] && `favorite:${visibleFavorites[0].href}`) || (showStarAction ? 'action:favorite' : showWork ? 'page:my-work' : undefined)
  const hasEntries = visibleFavorites.length > 0 || showStarAction || showWork

  useEffect(() => {
    onState({ hasEntries, firstValue, history })
  }, [hasEntries, firstValue, history, onState])

  return (
    <>
      {showWork && <Command.Group heading={<GroupHeading>Work</GroupHeading>}><Command.Item value="page:my-work" onSelect={() => onSelect('/app/my-work')} className={ITEM_CLASS} data-qqq-id="command-my-work">Go to My work</Command.Item></Command.Group>}
      {visibleFavorites.length > 0 && (
        <Command.Group heading={<GroupHeading>Favorites</GroupHeading>} data-qqq-id="command-group-favorites">
          {visibleFavorites.map((item, index) => (
            <Command.Item key={item.id ?? index} value={`favorite:${item.href}`} onSelect={() => onSelect(item.href!)}
              className={ITEM_CLASS} data-qqq-id="command-favorite">
              <CollaborationIcon type={item.targetType} />
              <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
            </Command.Item>
          ))}
        </Command.Group>
      )}
      {showStarAction && favoriteTarget && (
        <Command.Group heading={<GroupHeading>This page</GroupHeading>} data-qqq-id="command-group-page">
          <Command.Item value="action:favorite" disabled={!favorites.isSuccess || toggleFavorite.isPending}
            onSelect={() => {
              const label = recentRecords.find((record) => record.path.replace(/\/$/, '') === pathname.replace(/\/$/, ''))?.recordLabel
                ?? metaData?.apps?.[favoriteTarget.targetName]?.label ?? metaData?.tables?.[favoriteTarget.targetName]?.label ?? ''
              toggleFavorite.mutate({ ...favoriteTarget, label, href: pathname, starred: pageStarred })
            }} className={ITEM_CLASS} data-qqq-id="command-toggle-favorite">
            <Star className="h-4 w-4" aria-hidden="true" />
            <span className="font-medium">{starAction}</span>
          </Command.Item>
        </Command.Group>
      )}
    </>
  )
}
