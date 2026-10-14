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
 * @file The favorites star for table, app and record headers. The real toggle (and its tooltip)
 * loads only once collaboration is known to be installed, so those screens keep it out of their
 * first load. A same-size star stands in while the chunk loads, so the title does not shift.
 */

'use client'

import dynamic from 'next/dynamic'
import { Star } from 'lucide-react'
import type { CollaborationTarget } from '@/types/collaboration'
import { useCollaborationAvailable } from '@/lib/hooks/use-collaboration-core'

/**
 * Page-title stand-in, sized like the favorite toggle.
 * @returns A decorative star.
 */
function TogglePlaceholder() {
  return (
    <span aria-hidden="true" className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center text-primary opacity-50" data-qqq-id="favorite-toggle-placeholder">
      <Star className="h-5 w-5" />
    </span>
  )
}

const FavoriteToggle = dynamic(() => import('./FavoriteToggle').then((module) => module.FavoriteToggle), {
  ssr: false,
  loading: TogglePlaceholder,
})

/**
 * The favorite star for a table, app or record header, loaded when collaboration is installed.
 * @param props - Target identity and metadata-derived display information.
 * @returns The toggle (or its placeholder while loading), or nothing when unavailable.
 */
export function LazyFavoriteToggle(props: { target: CollaborationTarget; label: string; href: string }) {
  const available = useCollaborationAvailable()
  return available.data ? <FavoriteToggle {...props} /> : null
}
