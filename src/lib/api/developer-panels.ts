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
 * @file Developer panels API — the panels that developer panel providers (QQQ core, modules and
 * qbits such as qqq-esb, quick search, SQL workbench or the assistant) contribute to a record's
 * developer view: v1 `GET /table/{table}/{pk}/developer/panels` (QRun-IO/qqq#1076).
 */

import { getErrorStatusCode } from '@/lib/utils/error-utils'
import apiClient from './client'

/** Tone of a panel's status badge or of a TEXT block. */
export type DeveloperPanelTone = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'

/** Kinds of panel block. */
export type DeveloperPanelBlockType = 'KEY_VALUES' | 'TEXT' | 'CODE' | 'TABLE' | 'LINKS' | 'ACTIONS'

/** A label/value pair of a KEY_VALUES block. */
export interface DeveloperPanelKeyValue {
  label: string
  value?: string
  monospace?: boolean
  /** App-relative (`/app/...`) or absolute link for the value. */
  href?: string
}

/** A link of a LINKS block. */
export interface DeveloperPanelLink {
  label: string
  href: string
  description?: string
  external?: boolean
}

/** A process action of an ACTIONS block. */
export interface DeveloperPanelAction {
  label: string
  processName: string
  tableName?: string
  /** Launch with this record selected (default true). */
  includeRecordId?: boolean
  description?: string
}

/** One block of a panel; `type` says which fields are used. */
export interface DeveloperPanelBlock {
  type: DeveloperPanelBlockType
  label?: string
  text?: string
  tone?: DeveloperPanelTone
  language?: string
  code?: string
  items?: DeveloperPanelKeyValue[]
  columns?: string[]
  rows?: string[][]
  links?: DeveloperPanelLink[]
  actions?: DeveloperPanelAction[]
}

/** A panel contributed by one provider. */
export interface DeveloperPanel {
  id: string
  title: string
  order?: number
  icon?: string
  description?: string
  statusLabel?: string
  statusTone?: DeveloperPanelTone
  blocks: DeveloperPanelBlock[]
  /** Set when the provider failed to build its panel. */
  error?: string
}

const BLOCK_TYPES = new Set<DeveloperPanelBlockType>(['KEY_VALUES', 'TEXT', 'CODE', 'TABLE', 'LINKS', 'ACTIONS'])
const TONES = new Set<DeveloperPanelTone>(['INFO', 'SUCCESS', 'WARNING', 'ERROR'])

/**
 * Whether a value is a plain object.
 * @param value - Candidate.
 * @returns True for non-null, non-array objects.
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * A string, or undefined.
 * @param value - Candidate.
 * @returns The string when the value is a non-empty string.
 */
function str(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

/**
 * A tone, or undefined.
 * @param value - Candidate.
 * @returns The tone when the value is a known one.
 */
function tone(value: unknown): DeveloperPanelTone | undefined {
  return typeof value === 'string' && TONES.has(value as DeveloperPanelTone) ? value as DeveloperPanelTone : undefined
}

/**
 * Objects of a list, dropping anything else.
 * @param value - Candidate list.
 * @returns The list's plain objects.
 */
function objects(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isObject) : []
}

/**
 * Parses one block, dropping unknown types and malformed entries.
 * @param raw - The block as received.
 * @returns The block, or null when its type is unknown.
 */
export function parseDeveloperPanelBlock(raw: Record<string, unknown>): DeveloperPanelBlock | null {
  const type = raw.type
  if (typeof type !== 'string' || !BLOCK_TYPES.has(type as DeveloperPanelBlockType)) return null
  return {
    type: type as DeveloperPanelBlockType,
    label: str(raw.label),
    text: str(raw.text),
    tone: tone(raw.tone),
    language: str(raw.language),
    code: typeof raw.code === 'string' ? raw.code : undefined,
    items: objects(raw.items).flatMap((item) => typeof item.label === 'string'
      ? [{ label: item.label, value: typeof item.value === 'string' ? item.value : undefined, monospace: item.monospace === true, href: str(item.href) }]
      : []),
    columns: Array.isArray(raw.columns) ? raw.columns.map((column) => String(column ?? '')) : undefined,
    rows: Array.isArray(raw.rows) ? raw.rows.filter(Array.isArray).map((row: unknown[]) => row.map((cell) => cell == null ? '' : String(cell))) : undefined,
    links: objects(raw.links).flatMap((link) => typeof link.label === 'string' && typeof link.href === 'string'
      ? [{ label: link.label, href: link.href, description: str(link.description), external: link.external === true }]
      : []),
    actions: objects(raw.actions).flatMap((action) => typeof action.label === 'string' && typeof action.processName === 'string'
      ? [{ label: action.label, processName: action.processName, tableName: str(action.tableName), includeRecordId: action.includeRecordId !== false, description: str(action.description) }]
      : []),
  }
}

/**
 * Parses the panels response, dropping malformed panels and blocks.
 * @param body - The response body.
 * @returns The panels, sorted by order then title.
 */
export function parseDeveloperPanels(body: unknown): DeveloperPanel[] {
  if (!isObject(body)) return []
  const panels = objects(body.panels).flatMap((raw): DeveloperPanel[] => {
    if (typeof raw.id !== 'string' || typeof raw.title !== 'string') return []
    return [{
      id: raw.id,
      title: raw.title,
      order: typeof raw.order === 'number' ? raw.order : undefined,
      icon: str(raw.icon),
      description: str(raw.description),
      statusLabel: str(raw.statusLabel),
      statusTone: tone(raw.statusTone),
      error: str(raw.error),
      blocks: objects(raw.blocks).map(parseDeveloperPanelBlock).filter((block): block is DeveloperPanelBlock => block !== null),
    }]
  })
  return panels.sort((a, b) => (a.order ?? 500) - (b.order ?? 500) || a.title.localeCompare(b.title))
}

/**
 * Loads a record's developer panels. Backends from before the panels endpoint answer 404 (or
 * 405), which means "no panels" rather than an error.
 *
 * @param tableName - Exact backend table identifier.
 * @param primaryKey - Record identifier.
 * @returns The record's panels, in display order.
 */
export async function getRecordDeveloperPanels(tableName: string, primaryKey: string | number): Promise<DeveloperPanel[]> {
  try {
    const body = await apiClient.get<unknown>(`/table/${encodeURIComponent(tableName)}/${encodeURIComponent(String(primaryKey))}/developer/panels`)
    return parseDeveloperPanels(body)
  } catch (error) {
    const status = getErrorStatusCode(error)
    if (status === 404 || status === 405) return []
    throw error
  }
}
