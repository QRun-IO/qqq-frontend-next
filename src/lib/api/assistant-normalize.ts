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
 * @file Runtime validation of assistant payloads at the API boundary.
 *
 * Messages, parts, renders and stream events from `/qqq/v1/assistant` are checked against the
 * shapes of the assistant UI API document (extensions/assistant.json) with zod, and repaired
 * instead of trusted: a missing optional list becomes `[]`, a missing text becomes `''`, list
 * items that are not objects are dropped, and a part or render of a type this UI does not know
 * becomes an `unknown` part/render that is shown as raw JSON. Nothing here throws.
 */

import { z } from 'zod'

import type {
  AssistantConversation,
  AssistantConversationDetail,
  AssistantMessage,
  AssistantPart,
  AssistantPresentationAction,
  AssistantPresentationPart,
  AssistantRecordRef,
  AssistantRender,
  AssistantStreamEvent,
  AssistantUnknownRender,
} from '@/types/assistant'

// ─── Lenient primitives ───────────────────────────────────────────────────────

/** Any scalar as a string; anything else becomes ''. */
const text = z.preprocess((value) => (typeof value === 'number' || typeof value === 'boolean' ? String(value) : value), z.string()).catch('')
/** A string, a scalar as a string, or null. */
const nullableText = z.preprocess((value) => (typeof value === 'number' || typeof value === 'boolean' ? String(value) : value), z.string().nullable()).catch(null)
/** A string or number id ('' when missing). */
const idValue = z.union([z.string(), z.number()]).catch('')
const optionalText = z.string().optional().catch(undefined)
const optionalNumber = z.number().finite().optional().catch(undefined)
const record = z.record(z.unknown()).catch({})

/**
 * A list whose items are parsed one by one: a non-list becomes `[]` and an item that is not an
 * object is dropped (one bad row never hides the rest).
 *
 * @param item - The item schema (an object schema).
 * @returns The list schema.
 */
function list<T extends z.ZodTypeAny>(item: T) {
  return z.unknown().transform((value): Array<z.output<T>> => {
    if (!Array.isArray(value)) return []
    return value.flatMap((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
      const parsed = item.safeParse(entry)
      return parsed.success ? [parsed.data] : []
    })
  })
}

// ─── Renders ──────────────────────────────────────────────────────────────────

const recordRef = z.object({ tableName: text, tableLabel: text, id: idValue, label: text, href: text })
const cellValues = z.record(nullableText).catch({})

const RENDER_SCHEMAS = {
  records: z.object({
    type: z.literal('records'), tableName: text, tableLabel: text,
    columns: list(z.object({ name: text, label: text })),
    rows: list(z.object({ id: idValue, href: text, values: cellValues })),
    totalCount: optionalNumber, truncated: z.boolean().catch(false), openHref: text,
  }),
  record: z.object({
    type: z.literal('record'), tableName: text, tableLabel: text, id: idValue, href: text,
    fields: list(z.object({ name: text, label: text, value: nullableText })),
  }),
  count: z.object({ type: z.literal('count'), tableName: text, tableLabel: text, count: z.number().finite().catch(0), openHref: text }),
  widget: z.object({ type: z.literal('widget'), widgetName: text, label: text, widgetType: text, data: record }),
  history: z.object({
    type: z.literal('history'), tableName: text, recordId: idValue,
    entries: list(z.object({
      timestamp: text, user: text, message: text,
      details: list(z.object({ field: text, oldValue: nullableText, newValue: nullableText, truncated: z.boolean().catch(false) })),
    })),
  }),
  pending_action: z.object({
    type: z.literal('pending_action'), actionId: z.number().int(), toolName: z.enum(['create_record', 'update_record', 'delete_record']),
    tableName: text, tableLabel: text, recordId: nullableText.optional(), summary: text,
    changes: list(z.object({ field: text, label: text, value: nullableText })), href: optionalText,
  }),
} as const

/**
 * Validates and repairs a tool result's render.
 *
 * @param raw - The render as received.
 * @returns A known render with safe defaults, an unknown render, or undefined for none.
 */
export function normalizeAssistantRender(raw: unknown): AssistantRender | AssistantUnknownRender | undefined {
  if (raw === undefined || raw === null) return undefined
  const type = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as { type?: unknown }).type : undefined
  const schema = typeof type === 'string' ? RENDER_SCHEMAS[type as keyof typeof RENDER_SCHEMAS] : undefined
  if (schema) {
    const parsed = schema.safeParse(raw)
    if (parsed.success) return parsed.data as AssistantRender
  }
  return { type: 'unknown', originalType: typeof type === 'string' ? type : '', raw }
}

// ─── Presentation ─────────────────────────────────────────────────────────────

const link = z.object({ label: text, href: text })
const BLOCK_SCHEMAS: Record<string, z.ZodTypeAny> = {
  metrics: z.object({ kind: z.literal('metrics'), items: list(z.object({ label: text, value: z.union([z.string(), z.number()]).catch(''), display: optionalText, href: optionalText })) }),
  table: z.object({
    kind: z.literal('table'), title: optionalText,
    columns: list(z.object({ key: text, label: text, align: z.enum(['left', 'center', 'right']).optional().catch(undefined) })),
    rows: list(z.object({ cells: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]).catch(null)).catch({}), display: z.record(z.string()).optional().catch(undefined), href: optionalText })),
  }),
  chart: z.object({
    kind: z.literal('chart'), chartType: z.string().catch(''), title: optionalText,
    points: list(z.object({ label: text, value: z.number().finite().catch(0), display: optionalText, href: optionalText })),
  }),
  filterLinks: z.object({ kind: z.literal('filterLinks'), items: list(link.extend({ tableName: text })) }),
  recordLinks: z.object({ kind: z.literal('recordLinks'), items: list(link.extend({ tableName: text, recordId: idValue })) }),
  actions: z.object({
    kind: z.literal('actions'),
    items: list(z.object({ label: text, prompt: optionalText, href: optionalText })).transform((items) =>
      items.flatMap((item): AssistantPresentationAction[] => (item.prompt !== undefined ? [{ label: item.label, prompt: item.prompt }] : item.href !== undefined ? [{ label: item.label, href: item.href }] : []))),
  }),
}

/**
 * Validates a presentation part; unknown block kinds pass through (the view skips them).
 *
 * @param raw - The part as received.
 * @returns The repaired part.
 */
export function normalizePresentationPart(raw: Record<string, unknown>): AssistantPresentationPart {
  const blocks = Array.isArray(raw.blocks) ? raw.blocks : []
  return {
    type: 'presentation',
    summary: text.parse(raw.summary),
    markdown: text.parse(raw.markdown),
    blocks: blocks.flatMap((block) => {
      if (!block || typeof block !== 'object' || Array.isArray(block)) return []
      const kind = (block as { kind?: unknown }).kind
      if (typeof kind !== 'string') return []
      const schema = BLOCK_SCHEMAS[kind]
      if (!schema) return [block as { kind: string }]
      const parsed = schema.safeParse(block)
      return parsed.success ? [parsed.data] : []
    }),
  }
}

// ─── Parts and messages ───────────────────────────────────────────────────────

const TOOL_OUTCOMES = ['OK', 'DENIED', 'NOT_FOUND', 'INVALID_INPUT', 'TRUNCATED', 'ERROR'] as const
const toolOutcome = z.enum(TOOL_OUTCOMES).optional().catch(undefined)
const noticeLevel = z.enum(['info', 'warning', 'error']).catch('info')

/**
 * Normalizes a list of record references.
 *
 * @param raw - The list as received.
 * @returns Valid references.
 */
export function normalizeRecordRefs(raw: unknown): AssistantRecordRef[] {
  return list(recordRef).parse(raw)
}

/**
 * Validates and repairs one message part.
 *
 * @param raw - The part as received.
 * @returns A known part, or an unknown part for anything else.
 */
export function normalizeAssistantPart(raw: unknown): AssistantPart {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { type: 'unknown', originalType: '', raw }
  const part = raw as Record<string, unknown>
  switch (part.type) {
    case 'text':
      return { type: 'text', text: text.parse(part.text) }
    case 'tool': {
      const render = normalizeAssistantRender(part.render)
      const outcome = toolOutcome.parse(part.outcome)
      return {
        type: 'tool', toolCallId: text.parse(part.toolCallId), name: text.parse(part.name), summary: text.parse(part.summary),
        ...(outcome ? { outcome } : {}), ...(render ? { render } : {}),
      }
    }
    case 'record_refs':
      return { type: 'record_refs', refs: normalizeRecordRefs(part.refs) }
    case 'navigate':
      return { type: 'navigate', href: text.parse(part.href) }
    case 'notice':
      return { type: 'notice', level: noticeLevel.parse(part.level), text: text.parse(part.text) }
    case 'presentation':
      return normalizePresentationPart(part)
    default:
      return { type: 'unknown', originalType: typeof part.type === 'string' ? part.type : '', raw }
  }
}

const ROLES = ['USER', 'ASSISTANT', 'SYSTEM_NOTICE'] as const
const STATUSES = ['STREAMING', 'COMPLETE', 'CANCELLED', 'ERROR'] as const

/**
 * Validates and repairs one message; a message without a numeric id is dropped.
 *
 * @param raw - The message as received.
 * @returns The message, or null.
 */
export function normalizeAssistantMessage(raw: unknown): AssistantMessage | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const message = raw as Record<string, unknown>
  if (typeof message.id !== 'number') return null
  return {
    id: message.id,
    role: z.enum(ROLES).catch('ASSISTANT').parse(message.role),
    status: z.enum(STATUSES).catch('COMPLETE').parse(message.status),
    turnId: typeof message.turnId === 'number' ? message.turnId : null,
    createDate: text.parse(message.createDate),
    parts: Array.isArray(message.parts) ? message.parts.map(normalizeAssistantPart) : [],
  }
}

/**
 * Repairs one conversation of the list: `unreadCount` is a non-negative number and `running` a
 * boolean when present (older servers send neither: unread defaults to 0 and running stays absent).
 *
 * @param raw - One list item.
 * @returns The conversation, or null when it has no numeric id.
 */
export function normalizeConversationSummary(raw: unknown): AssistantConversation | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>
  if (typeof item.id !== 'number') return null
  const unread = typeof item.unreadCount === 'number' && item.unreadCount > 0 ? item.unreadCount : 0
  const conversation = { ...(item as unknown as AssistantConversation), unreadCount: unread }
  if (typeof item.running !== 'boolean') delete conversation.running
  return conversation
}

/**
 * Validates a conversation detail response.
 *
 * @param raw - The response body.
 * @returns The detail with valid messages only.
 */
export function normalizeConversationDetail(raw: unknown): AssistantConversationDetail {
  const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const messages = Array.isArray(body.messages) ? body.messages : []
  return {
    conversation: body.conversation as AssistantConversationDetail['conversation'],
    messages: messages.flatMap((message) => {
      const normalized = normalizeAssistantMessage(message)
      return normalized ? [normalized] : []
    }),
  }
}

// ─── Stream events ────────────────────────────────────────────────────────────

const positiveId = z.number().int()

/**
 * Validates one stream event's payload. An event missing the ids the client needs to apply it
 * is dropped (null); any other gap is filled with a safe default.
 *
 * @param event - The event with its type and seq already set.
 * @returns The repaired event, or null to skip it.
 */
export function normalizeStreamEvent(event: Record<string, unknown> & { type: AssistantStreamEvent['type'] }): AssistantStreamEvent | null {
  const ids = (...keys: string[]) => keys.every((key) => positiveId.safeParse(event[key]).success)
  switch (event.type) {
    case 'message.start':
      return ids('turnId', 'messageId') ? event as unknown as AssistantStreamEvent : null
    case 'text.delta':
      return { ...event, text: text.parse(event.text) } as unknown as AssistantStreamEvent
    case 'tool.start':
      return { ...event, toolCallId: text.parse(event.toolCallId), name: text.parse(event.name), summary: text.parse(event.summary) } as unknown as AssistantStreamEvent
    case 'tool.result': {
      const render = normalizeAssistantRender(event.render)
      const { render: _render, recordRefs, ...rest } = event
      void _render
      return {
        ...rest, toolCallId: text.parse(event.toolCallId), name: text.parse(event.name), summary: text.parse(event.summary),
        outcome: toolOutcome.parse(event.outcome) ?? 'ERROR',
        ...(render ? { render } : {}),
        ...(recordRefs !== undefined ? { recordRefs: normalizeRecordRefs(recordRefs) } : {}),
      } as unknown as AssistantStreamEvent
    }
    case 'presentation': {
      if (!ids('messageId')) return null
      const part = event.part && typeof event.part === 'object' && !Array.isArray(event.part) ? (event.part as Record<string, unknown>) : null
      return part ? { ...event, part: normalizePresentationPart(part) } as unknown as AssistantStreamEvent : null
    }
    case 'ui.navigate':
      return { ...event, href: text.parse(event.href) } as unknown as AssistantStreamEvent
    case 'notice':
      return { ...event, level: noticeLevel.parse(event.level), text: text.parse(event.text) } as unknown as AssistantStreamEvent
    case 'error':
      return { ...event, message: text.parse(event.message) || 'The assistant could not answer.' } as unknown as AssistantStreamEvent
    case 'message.end':
      return { ...event, status: z.enum(['COMPLETE', 'CANCELLED', 'ERROR']).catch('ERROR').parse(event.status) } as unknown as AssistantStreamEvent
    case 'turn.phase':
      return { ...event, phase: z.enum(['thinking', 'tool', 'writing']).catch('thinking').parse(event.phase) } as unknown as AssistantStreamEvent
    default:
      return event as unknown as AssistantStreamEvent
  }
}
