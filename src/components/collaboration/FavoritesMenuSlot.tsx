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
 * @file The header favorites menu slot. The dashboard layout loads this module after hydration;
 * it renders the menu (with its popover) only once collaboration is known to be installed, and a
 * same-size star while the menu's chunk loads, so the header does not shift.
 */

'use client'

import dynamic from 'next/dynamic'
import { Star } from 'lucide-react'
import { useCollaborationAvailable } from '@/lib/hooks/use-collaboration-core'

/**
 * Header slot stand-in, sized like the menu trigger and the header's other icon buttons.
 * @returns A decorative star.
 */
function MenuPlaceholder() {
  return (
    <span aria-hidden="true" className="flex items-center justify-center p-2" data-qqq-id="favorites-menu-placeholder">
      <Star className="h-5 w-5 text-foreground/60" />
    </span>
  )
}

const FavoritesMenu = dynamic(() => import('./FavoritesMenu').then((module) => module.FavoritesMenu), {
  ssr: false,
  loading: MenuPlaceholder,
})

/**
 * The header favorites menu, loaded when collaboration is installed.
 * @returns The menu (or its placeholder while loading), or nothing when unavailable.
 */
export function LazyFavoritesMenu() {
  const available = useCollaborationAvailable()
  return available.data ? <FavoritesMenu /> : null
}
