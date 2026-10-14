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

/** @file Collaboration v1 navigation contracts, normalized for UI consumers. */

/** Navigation kinds supported by the collaboration qbit. */
export type CollaborationTargetType =
  | 'TABLE'
  | 'APP'
  | 'RECORD'
  | 'PROCESS'
  | 'REPORT'
  | 'SAVED_VIEW'

/** Target request shared by star, unstar and record-view mutations. */
export interface CollaborationTarget {
  /** Kind of navigation target. */
  targetType: CollaborationTargetType
  /** Metadata name of the target. */
  targetName: string
  /** Canonical record key; omitted or null for other target types. */
  recordId?: string | null
}

/** FavoriteV1 also represents recent entries; recents have no timestamp in this contract. */
export interface CollaborationFavorite extends CollaborationTarget {
  /** Persisted favorite identifier; null for an optimistic entry. */
  id: number | null
  /** Current server label, or Unavailable when access is lost. */
  label: string
  /** Validated in-app destination, absent when unavailable. */
  href: string | null
  /** The server's current visibility decision. */
  available: boolean
  /** Optional personal grouping. */
  folder: string | null
  /** Position in the personal list. */
  sortOrder: number | null
}

/** FavoriteListV1 and RecentListV1 share the same response shape. */
export interface CollaborationList {
  /** Ordered entries; nullable wire lists normalize to an empty array. */
  items: CollaborationFavorite[]
  /** Opaque continuation token, null after the last page. */
  nextCursor: string | null
}

/** Moves the specified identifiers first and optionally assigns or clears folders. */
export interface CollaborationFavoriteOrder {
  /** Favorite identifiers in the requested order, without duplicates. */
  ids: number[]
  /** Identifier to folder mapping; null values clear a folder. */
  folders?: Record<string, string | null> | null
}

/** MutationResultV1 acknowledgement. */
export interface CollaborationMutationResult {
  /** True when the requested write completed. */
  success: boolean
}
