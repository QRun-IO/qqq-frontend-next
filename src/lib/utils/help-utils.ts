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
  const entries = (helpContents ?? []).filter((entry) => Boolean(entry?.content?.trim() || entry?.contentAsHtml?.trim() || entry?.summary?.trim()))
  for (const role of roles) {
    const match = entries.find((entry) => entry.roles?.includes(role))
    if (match) return match
  }
  return entries.find((entry) => !entry.roles || entry.roles.length === 0)
}

/** Roles of widget help slots, most specific first (Material widgets use the view screen's). */
export const WIDGET_HELP_ROLES = VIEW_SCREEN_HELP_ROLES
/** Roles of process screens (steps and bulk-load mapping fields), most specific first. */
export const PROCESS_SCREEN_HELP_ROLES = ['PROCESS_SCREEN', 'ALL_SCREENS'] as const

/**
 * Escapes text for inclusion in HTML help content.
 *
 * @param text - Plain text.
 * @returns The text with HTML special characters escaped.
 */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`)
}

/**
 * Picks the help content for a help slot, as {@link selectHelpContent} does, and in Material's
 * help-authoring mode (`?helpHelp`, QContext `helpHelpActive`) appends the slot's key (for
 * example `[table:person;field:email]`), returning an entry for every slot, even one without
 * content, so help authors can see where help may be declared.
 *
 * Keys follow Material's `helpContentKey`: `table:{t};field:{f}`, `table:{t};section:{s}`,
 * `process:{p};step:{s}`, `process:{p};field:{f}`, `widget:{w};slot:{s}`, `app:{a};slot:{s}`
 * and `instanceLevel:true;slot:{s}`.
 *
 * @param helpContents - The declared entries (field, section or slot).
 * @param roles - The screen's roles, most specific first.
 * @param helpKey - The slot's key.
 * @param helpHelpActive - Whether help-authoring mode is on.
 * @returns The entry to show, or `undefined` when none applies and the mode is off.
 */
export function selectSlotHelpContent(
  helpContents: QHelpContent[] | undefined,
  roles: readonly string[],
  helpKey: string | undefined,
  helpHelpActive: boolean
): QHelpContent | undefined {
  const selected = selectHelpContent(helpContents, roles)
  if (!helpHelpActive) return selected
  const suffix = `[${helpKey ?? '?'}]`
  if (!selected) return { content: suffix, format: 'TEXT' }
  const format = selected.format ?? 'TEXT'
  if (format === 'HTML') return { ...selected, content: `${selected.content ?? ''} ${escapeHtml(suffix)}` }
  if (format === 'MARKDOWN') return { ...selected, content: `${selected.content ?? ''} ${suffix}`, contentAsHtml: `${selected.contentAsHtml ?? ''} ${escapeHtml(suffix)}` }
  return { ...selected, content: `${selected.content ?? ''} ${suffix}` }
}

/** Roles of application headers, most specific first. */
export const APP_SCREEN_HELP_ROLES = ['APP_SCREEN', 'ALL_SCREENS'] as const
/** Roles of record and table action items, most specific first. */
export const TABLE_ACTION_MENU_HELP_ROLES = ['TABLE_ACTION_MENU', 'ALL_SCREENS'] as const

/**
 * Selects a role-specific entry from a named slot.
 * @param map - Metadata slot map.
 * @param slot - Slot name.
 * @param roles - Screen roles in precedence order.
 * @returns Applicable help, if any.
 */
export function selectSlotHelp(map: Record<string, QHelpContent[]> | undefined, slot: string, roles: readonly string[]): QHelpContent | undefined {
  return selectHelpContent(map?.[slot], roles)
}

/**
 * Derives a plain-text first sentence when no explicit summary is supplied.
 * @param entry - Long help in its declared format.
 * @returns Short tooltip text without HTML or Markdown markup.
 */
export function helpSummary(entry: QHelpContent): string {
  if (entry.summary?.trim()) return entry.summary.trim()
  const text = helpPlainText(entry)
  return text.match(/^.*?[.!?](?:\s|$)/)?.[0].trim() || text
}

/**
 * The whole help text as plain text (no HTML or Markdown markup), e.g. for an
 * empty table's placeholder: what the table is for and how its rows get created.
 * @param entry - Long help in its declared format.
 * @returns Plain text, whitespace collapsed.
 */
export function helpPlainText(entry: QHelpContent): string {
  const source = entry.contentAsHtml || entry.content || entry.summary || ''
  const withoutBlocks = replaceUntilStable(source, (s) => s
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\b[^>]*>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style\b[^>]*>/gi, ''))
  const withoutTags = replaceUntilStable(withoutBlocks.replace(/<\/?(?:p|div|br|li|h[1-6])\b[^>]*>/gi, ' '), (s) => s.replace(/<[^>]*>/g, ''))
  return withoutTags.replace(/!?(\[([^\]]+)\])\([^)]*\)/g, '$2').replace(/[#*_`~]/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim()
}

/**
 * Applies a replacement repeatedly until the text stops changing, so removing one tag cannot
 * leave behind (or assemble) another one, e.g. `<scr<script>ipt>`.
 * @param text - Input text.
 * @param step - One replacement pass.
 * @returns The stable result.
 */
function replaceUntilStable(text: string, step: (s: string) => string): string {
  let previous = text
  for (;;) {
    const next = step(previous)
    if (next === previous) return next
    previous = next
  }
}
