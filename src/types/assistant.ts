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
 * @file Types of the QQQ Assistant HTTP/SSE contract (`/qqq/v1/assistant/*`, served by
 * the qbit-assistant route provider). Field names match the wire format exactly.
 */

/** Why the assistant is unavailable to the current user. */
export type AssistantDisabledReason = 'DISABLED' | 'NO_PERMISSION' | 'KILL_SWITCH' | 'NOT_CONFIGURED'

/** `GET /assistant/config`: the feature probe plus UI configuration. */
export interface AssistantConfig {
  enabled: boolean
  reason?: AssistantDisabledReason
  /** Keyboard shortcut, e.g. `mod+j`. */
  shortcut?: string
  model?: string
  limits?: { maxTurnSeconds?: number; maxToolCallsPerTurn?: number }
  features?: { writes?: boolean; pendingActions?: boolean; writeMode?: boolean; autoConfirm?: boolean }
  /** The user's own preferences. */
  preferences?: { defaultWriteMode?: boolean; autoConfirmLowRisk?: boolean }
  /** The assistant's persona (admin-configured profile); text only, it never changes access. */
  profile?: AssistantProfile
}

/** How the assistant presents itself. */
export interface AssistantProfile {
  displayName?: string
  /** A Material icon name. */
  icon?: string
  greeting?: string | null
  starterPrompts?: string[]
}

/** Lifecycle of a conversation. */
export type AssistantConversationStatus = 'ACTIVE' | 'ARCHIVED'

/** One conversation (own conversations only). */
export interface AssistantConversation {
  id: number
  title: string | null
  status: AssistantConversationStatus
  pinned: boolean
  lastMessageAt: string | null
  unreadCount: number
  createDate: string
  /** Write mode (Read-only when false or absent): the assistant's write tools exist only in Write mode. */
  writeMode?: boolean
}

/** Page the user is on, sent as a hint with a turn (never trusted by the server). */
export interface AssistantPageContext {
  route?: string
  tableName?: string
  recordId?: string | number
  /** A QQueryFilter as JSON. */
  filter?: Record<string, unknown>
  selectedIds?: Array<string | number>
  /** Files the user attached in the panel (already uploaded): refs and names only. */
  attachments?: AssistantAttachment[]
}

/** A file attached in the panel: its upload ref (POST /uploads) and name. */
export interface AssistantAttachment {
  uploadRef: string
  fileName?: string
}

/** Outcome of one tool call. */
export type AssistantToolOutcome = 'OK' | 'DENIED' | 'NOT_FOUND' | 'INVALID_INPUT' | 'TRUNCATED' | 'ERROR'

/** A record the assistant referred to; `href` is built by the server. */
export interface AssistantRecordRef {
  tableName: string
  tableLabel: string
  id: string | number
  label: string
  href: string
}

/** Rows of a query, rendered as an inline table. */
export interface AssistantRecordsRender {
  type: 'records'
  tableName: string
  tableLabel: string
  columns: Array<{ name: string; label: string }>
  rows: Array<{ id: string | number; href: string; values: Record<string, string | null> }>
  totalCount?: number
  truncated: boolean
  openHref: string
}

/** One record's fields. */
export interface AssistantRecordRender {
  type: 'record'
  tableName: string
  tableLabel: string
  id: string | number
  href: string
  fields: Array<{ name: string; label: string; value: string | null }>
}

/** A record count. */
export interface AssistantCountRender {
  type: 'count'
  tableName: string
  tableLabel: string
  count: number
  openHref: string
}

/** A widget payload (the same shape the widget endpoint returns). */
export interface AssistantWidgetRender {
  type: 'widget'
  widgetName: string
  label: string
  widgetType: string
  data: Record<string, unknown>
}

/** One audit entry of a record's history. */
export interface AssistantHistoryEntry {
  timestamp: string
  user: string
  message: string
  details: Array<{ field: string; oldValue: string | null; newValue: string | null; truncated: boolean }>
}

/** A record's change history. */
export interface AssistantHistoryRender {
  type: 'history'
  tableName: string
  recordId: string | number
  entries: AssistantHistoryEntry[]
}

/** A write the assistant proposed; nothing changes until the user confirms it. */
export interface AssistantPendingActionRender {
  type: 'pending_action'
  actionId: number
  toolName: 'create_record' | 'update_record' | 'delete_record'
  tableName: string
  tableLabel: string
  recordId?: string | null
  summary: string
  changes: Array<{ field: string; label: string; value: string | null }>
  href?: string
}

/** A pending action's state on the server. */
export interface AssistantPendingAction {
  id: number
  status: 'PENDING' | 'RUNNING' | 'EXECUTED' | 'FAILED' | 'REJECTED' | 'EXPIRED'
  toolName: string
  tableName: string
  recordId?: string | null
  summary: string
  httpStatus?: number | null
  resultSummary?: string | null
  expiresAt?: string | null
  /** After a confirm: the tool outcome and message, and a link to the record. */
  outcome?: string
  message?: string
  href?: string
}

/**
 * A render this UI cannot show as designed: its type is unknown here, or it could not be
 * repaired (see `lib/api/assistant-normalize`). Shown as raw JSON.
 */
export interface AssistantUnknownRender {
  type: 'unknown'
  /** The type the server sent ('' when there was none). */
  originalType: string
  /** The payload as received. */
  raw: unknown
}

/** Structured UI payload of a tool result (never model-written HTML). */
export type AssistantRender =
  | AssistantRecordsRender
  | AssistantRecordRender
  | AssistantCountRender
  | AssistantWidgetRender
  | AssistantHistoryRender
  | AssistantPendingActionRender
  | AssistantUnknownRender

/** Markdown text written by the model. */
export interface AssistantTextPart { type: 'text'; text: string }

/** One tool call and, once finished, its outcome. */
export interface AssistantToolPart {
  type: 'tool'
  toolCallId: string
  name: string
  summary: string
  /** Absent while the tool is still running (streamed `tool.start`). */
  outcome?: AssistantToolOutcome
  render?: AssistantRender
}

/** Records referenced by the reply. */
export interface AssistantRecordRefsPart { type: 'record_refs'; refs: AssistantRecordRef[] }

/** The assistant took the user to a page. */
export interface AssistantNavigatePart { type: 'navigate'; href: string }

/** An informational, warning or error notice. */
export interface AssistantNoticePart { type: 'notice'; level: 'info' | 'warning' | 'error'; text: string }

/** A server-formatted value with an optional destination. */
export interface AssistantPresentationMetric {
  label: string
  value: string | number
  display?: string
  href?: string
}

/** A compact results table. */
export interface AssistantPresentationTable {
  kind: 'table'
  title?: string
  columns: Array<{ key: string; label: string; align?: 'left' | 'center' | 'right' }>
  rows: Array<{
    cells: Record<string, string | number | boolean | null>
    display?: Record<string, string>
    href?: string
  }>
}

/** A small chart with server-built point destinations. */
export interface AssistantPresentationChart {
  kind: 'chart'
  chartType: 'bar' | 'pie' | 'line'
  title?: string
  points: Array<{ label: string; value: number; display?: string; href?: string }>
}

/** Either sends the next user message or opens a server-built path. */
export type AssistantPresentationAction =
  | { label: string; prompt: string; href?: never }
  | { label: string; href: string; prompt?: never }

/** Known v1 blocks, discriminated by kind. */
export type AssistantPresentationBlock =
  | { kind: 'metrics'; items: AssistantPresentationMetric[] }
  | AssistantPresentationTable
  | AssistantPresentationChart
  | { kind: 'filterLinks'; items: Array<{ label: string; tableName: string; href: string }> }
  | { kind: 'recordLinks'; items: Array<{ label: string; tableName: string; recordId: string | number; href: string }> }
  | { kind: 'actions'; items: AssistantPresentationAction[] }

/** Forward-compatible answer from present_results; unknown blocks are skipped. */
export interface AssistantPresentationPart {
  type: 'presentation'
  summary: string
  markdown: string
  blocks: Array<AssistantPresentationBlock | { kind: string; [key: string]: unknown }>
}

/** A part of a type this UI does not know; shown as raw JSON behind a toggle. */
export interface AssistantUnknownPart { type: 'unknown'; originalType: string; raw: unknown }

/** One part of a message. Unknown part types are normalized to {@link AssistantUnknownPart}. */
export type AssistantPart =
  | AssistantPresentationPart
  | AssistantTextPart
  | AssistantToolPart
  | AssistantRecordRefsPart
  | AssistantNavigatePart
  | AssistantNoticePart
  | AssistantUnknownPart

/** Who wrote a message. */
export type AssistantRole = 'USER' | 'ASSISTANT' | 'SYSTEM_NOTICE'

/** Lifecycle of a message. */
export type AssistantMessageStatus = 'STREAMING' | 'COMPLETE' | 'CANCELLED' | 'ERROR'

/** One message of a conversation. */
export interface AssistantMessage {
  id: number
  role: AssistantRole
  status: AssistantMessageStatus
  turnId: number | null
  createDate: string
  parts: AssistantPart[]
}

/** `GET /assistant/conversations/{id}`. */
export interface AssistantConversationDetail {
  conversation: AssistantConversation
  messages: AssistantMessage[]
}

/** Body of `PATCH /assistant/conversations/{id}`. */
export interface AssistantConversationUpdate {
  title?: string
  pinned?: boolean
  status?: AssistantConversationStatus
  writeMode?: boolean
}

/** Body of `POST /assistant/messages/{id}/feedback`. */
export interface AssistantFeedback {
  rating: 1 | -1
  reason?: string
  comment?: string
}

/** Error codes of the `error` stream event. */
export type AssistantStreamErrorCode = 'KILL_SWITCH' | 'BUDGET' | 'RATE_LIMIT' | 'PROVIDER' | 'TIMEOUT' | 'INTERNAL'

/** Typed events of a turn stream; every event carries its `seq`. */
export type AssistantStreamEvent =
  | { type: 'presentation'; seq: number; messageId: number; part: AssistantPresentationPart }
  | { type: 'message.start'; seq: number; turnId: number; conversationId: number; userMessageId: number; messageId: number; startedAt?: string }
  | { type: 'turn.phase'; seq: number; phase: AssistantPhase; toolName?: string; label?: string }
  | { type: 'text.delta'; seq: number; messageId: number; text: string }
  | { type: 'tool.start'; seq: number; messageId: number; toolCallId: string; name: string; summary: string }
  | {
    type: 'tool.result'; seq: number; messageId: number; toolCallId: string; name: string
    outcome: AssistantToolOutcome; summary: string; render?: AssistantRender; recordRefs?: AssistantRecordRef[]
  }
  | { type: 'ui.navigate'; seq: number; messageId: number; href: string }
  | { type: 'notice'; seq: number; messageId: number; level: 'info' | 'warning' | 'error'; text: string }
  | {
    type: 'usage'; seq: number; turnId: number; inputTokens: number; outputTokens: number
    cacheReadTokens: number; cacheWriteTokens: number; costMicros: number
  }
  | { type: 'message.end'; seq: number; messageId: number; status: 'COMPLETE' | 'CANCELLED' | 'ERROR'; stopReason?: string }
  | { type: 'error'; seq: number; code: AssistantStreamErrorCode; message: string }
  | { type: 'ping'; seq?: number }

/** How sending during an answer affects existing turns. */
export type AssistantConcurrency = 'supersede' | 'concurrent'

/** The server's current stage of an answer. */
export type AssistantPhase = 'thinking' | 'tool' | 'writing'

/** A running turn discovered across backend replicas. */
export interface ActiveAssistantTurn {
  turnId: number
  conversationId: number
  assistantMessageId: number
  userMessageId: number
  status: 'RUNNING' | 'CANCELLING'
  phase: AssistantPhase
  startedAt: string
  heartbeatAt: string
  elapsedMs: number
  live: boolean
  concurrencyMode: AssistantConcurrency
}
