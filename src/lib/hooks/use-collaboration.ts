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

/** @file Shared, session-cached collaboration queries and optimistic favorite mutations. */

'use client'

import { useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CollaborationFavorite,
  CollaborationList,
  CollaborationTarget,
} from '@/types/collaboration'
import { queryKeys } from '@/lib/query-client'
import { api, useCollaborationAvailable } from './use-collaboration-core'

export { useCollaborationAvailable, useRecordRecentView } from './use-collaboration-core'

/**
 * Compares target identities, treating omitted and null record IDs alike.
 * @param a - First target.
 * @param b - Second target.
 * @returns Whether both refer to the same page.
 */
export function sameFavorite(a: CollaborationTarget, b: CollaborationTarget): boolean {
  return (
    a.targetType === b.targetType &&
    a.targetName === b.targetName &&
    (a.recordId ?? null) === (b.recordId ?? null)
  )
}

/**
 * Shares the user's favorites across stars, menu and palette.
 * @param enabled - False for closed lazy surfaces.
 * @returns Favorites query.
 */
export function useFavorites(enabled = true) {
  const available = useCollaborationAvailable(enabled)
  return useQuery({
    queryKey: queryKeys.collaborationFavorites(),
    queryFn: async () => (await api()).listFavorites(),
    enabled: enabled && available.data === true,
    staleTime: 30_000,
  })
}

/** Toggle input includes display information only for the optimistic cache. */
interface ToggleFavorite extends CollaborationTarget {
  starred: boolean
  label: string
  href: string | null
}

/**
 * Toggles with immediate feedback, rollback and server revalidation. All controls are locked
 * during a write so independent surfaces cannot overwrite each other's optimistic snapshot.
 * @returns Mutation and shared pending state.
 */
export function useToggleFavorite() {
  const client = useQueryClient()
  const mutationKey = queryKeys.collaborationToggle()
  const pending = useMutationState({
    filters: { mutationKey, status: 'pending' },
    select: (mutation) => mutation.state.status,
  })
  const mutation = useMutation({
    mutationKey,
    mutationFn: async ({ starred, targetType, targetName, recordId }: ToggleFavorite) => {
      const { starFavorite, unstarFavorite } = await api()
      return (starred ? unstarFavorite : starFavorite)({ targetType, targetName, recordId })
    },
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey: queryKeys.collaborationFavorites() })
      const previous = client.getQueryData<CollaborationList>(queryKeys.collaborationFavorites())
      const items = previous?.items ?? []
      const optimistic: CollaborationFavorite = {
        targetType: input.targetType,
        targetName: input.targetName,
        recordId: input.recordId,
        id: null,
        label: input.label,
        href: input.href,
        available: true,
        folder: null,
        sortOrder: null,
      }
      client.setQueryData<CollaborationList>(queryKeys.collaborationFavorites(), {
        items: input.starred
          ? items.filter((item) => !sameFavorite(item, input))
          : [...items, optimistic],
        nextCursor: null,
      })
      return { previous }
    },
    onError: (_error, _input, context) => {
      client.setQueryData(
        queryKeys.collaborationFavorites(),
        context?.previous ?? { items: [], nextCursor: null }
      )
    },
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.collaborationFavorites() }),
  })
  return { ...mutation, isPending: mutation.isPending || pending.length > 0 }
}

/**
 * Loads server recents only when the consuming surface needs them.
 * @param enabled - Whether the palette is open.
 * @param limit - Maximum target count.
 * @returns Recents query.
 */
export function useRecents(enabled = true, limit = 50) {
  const available = useCollaborationAvailable(enabled)
  return useQuery({
    queryKey: queryKeys.collaborationRecents(limit),
    queryFn: async () => (await api()).listRecents(limit),
    enabled: enabled && available.data === true,
    staleTime: 0,
  })
}
