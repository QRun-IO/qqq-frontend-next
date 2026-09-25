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
 * @file help-utils — chooses the help content entry for a screen from its roles
 * (`QHelpRole`), in the same priority the QQQ dashboards use.
 */

import type { QHelpContent } from '@/types'

/** Roles of the record view screen, most specific first. */
export const VIEW_SCREEN_HELP_ROLES = ['VIEW_SCREEN', 'READ_SCREENS', 'ALL_SCREENS'] as const
/** Roles of the record query screen, most specific first. */
export const QUERY_SCREEN_HELP_ROLES = ['QUERY_SCREEN', 'READ_SCREENS', 'ALL_SCREENS'] as const
/** Roles of the record edit screen, most specific first. */
export const EDIT_SCREEN_HELP_ROLES = ['EDIT_SCREEN', 'WRITE_SCREENS', 'ALL_SCREENS'] as const
/** Roles of the record create (and copy) screen, most specific first. */
export const INSERT_SCREEN_HELP_ROLES = ['INSERT_SCREEN', 'WRITE_SCREENS', 'ALL_SCREENS'] as const

/**
 * Picks the help content for a screen: the first entry naming the most specific
 * screen role wins; an entry without roles applies to every screen.
 *
 * @param helpContents - The declared entries (field, section or slot).
 * @param roles - The screen's roles, most specific first.
 * @returns The entry to show, or `undefined` when none applies or it is empty.
 */
export function selectHelpContent(helpContents: QHelpContent[] | undefined, roles: readonly string[]): QHelpContent | undefined {
  const entries = (helpContents ?? []).filter((entry) => typeof entry?.content === 'string' && entry.content.trim() !== '')
  for (const role of roles) {
    const match = entries.find((entry) => entry.roles?.includes(role))
    if (match) return match
  }
  return entries.find((entry) => !entry.roles || entry.roles.length === 0)
}
