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

/** @file Release notes extension response models. */

export type ReleaseNotesCategory = 'NEW' | 'IMPROVED' | 'FIXED' | 'SECURITY' | 'REMOVED'

export interface ReleaseNotesItemV1 {
  category: ReleaseNotesCategory
  categoryLabel: string
  text: string
  linkUrl: string | null
  screenshotUrl: string | null
}

export interface ReleaseNotesLatestV1 {
  id: number
  version: string
  title: string
  publishedAt: string
}

export interface ReleaseNotesReleaseV1 extends ReleaseNotesLatestV1 {
  summary: string | null
  isNew: boolean
  items: ReleaseNotesItemV1[]
}

export interface ReleaseNotesReleasesV1 {
  releases: ReleaseNotesReleaseV1[]
  total: number
  unreadCount: number
  lastSeenAt: string | null
}

export interface ReleaseNotesSummaryV1 {
  unreadCount: number
  latest: ReleaseNotesLatestV1 | null
}
