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
 * @file message-reducer — applies turn stream events to a conversation's messages (pure, so
 * the live reply can be kept in the TanStack Query cache and survive the panel closing).
 */

import type { AssistantMessage, AssistantPart, AssistantRecordRef, AssistantStreamEvent } from '@/types/assistant'

/** The messages a running turn writes: the user's (until the server id is known) and the reply. */
export interface TurnMessageIds {
  /** The user message id (a temporary negative id until `message.start`), or null when attaching. */
  userId: number | null
  /** The assistant message id (temporary until `message.start`). */
  assistantId: number
}

/**
 * Builds the optimistic messages of a new turn.
 *
 * @param text - The user's text.
 * @param ids - Temporary ids.
 * @param now - Creation time (ISO).
 * @returns The user message and the empty streaming reply.
 */
export function optimisticTurnMessages(text: string, ids: { userId: number; assistantId: number }, now: string): AssistantMessage[] {
  return [
    { id: ids.userId, role: 'USER', status: 'COMPLETE', turnId: null, createDate: now, parts: [{ type: 'text', text }] },
    { id: ids.assistantId, role: 'ASSISTANT', status: 'STREAMING', turnId: null, createDate: now, parts: [] },
  ]
}

/**
 * Applies one stream event to the messages. `ids` is updated in place on `message.start`.
 *
 * @param messages - The conversation's messages.
 * @param event - The stream event.
 * @param ids - The ids of the running turn's messages.
 * @returns The new messages (the same array when nothing changed).
 */
export function reduceStreamEvent(messages: AssistantMessage[], event: AssistantStreamEvent, ids: TurnMessageIds): AssistantMessage[] {
  switch (event.type) {
    case 'message.start': {
      const userId = ids.userId
      const assistantId = ids.assistantId
      ids.assistantId = event.messageId
      if (userId !== null) ids.userId = event.userMessageId
      return messages.map((message) => {
        if (userId !== null && message.id === userId) return { ...message, id: event.userMessageId, turnId: event.turnId }
        if (message.id === assistantId) return { ...message, id: event.messageId, turnId: event.turnId }
        return message
      })
    }
    case 'text.delta':
      return updateMessage(messages, ids.assistantId, (message) => {
        const last = message.parts[message.parts.length - 1]
        if (last?.type === 'text') return { ...message, parts: [...message.parts.slice(0, -1), { type: 'text', text: last.text + event.text }] }
        return { ...message, parts: [...message.parts, { type: 'text', text: event.text }] }
      })
    case 'tool.start':
      return updateMessage(messages, ids.assistantId, (message) => {
        if (message.parts.some((part) => part.type === 'tool' && part.toolCallId === event.toolCallId)) return message
        return { ...message, parts: [...message.parts, { type: 'tool', toolCallId: event.toolCallId, name: event.name, summary: event.summary }] }
      })
    case 'tool.result':
      return updateMessage(messages, ids.assistantId, (message) => {
        const parts = [...message.parts]
        const tool: AssistantPart = { type: 'tool', toolCallId: event.toolCallId, name: event.name, summary: event.summary, outcome: event.outcome, ...(event.render ? { render: event.render } : {}) }
        let index = parts.findIndex((part) => part.type === 'tool' && part.toolCallId === event.toolCallId)
        if (index === -1) {
          parts.push(tool)
          index = parts.length - 1
        } else {
          parts[index] = tool
        }
        if (event.recordRefs?.length) {
          const next = parts[index + 1]
          if (next?.type === 'record_refs') parts[index + 1] = { type: 'record_refs', refs: mergeRefs(next.refs, event.recordRefs) }
          else parts.splice(index + 1, 0, { type: 'record_refs', refs: mergeRefs([], event.recordRefs) })
        }
        return { ...message, parts }
      })
    case 'presentation':
      return appendPart(messages, event.messageId, event.part)
    case 'ui.navigate':
      return appendPart(messages, ids.assistantId, { type: 'navigate', href: event.href })
    case 'notice':
      return appendPart(messages, ids.assistantId, { type: 'notice', level: event.level, text: event.text })
    case 'error':
      return appendPart(messages, ids.assistantId, { type: 'notice', level: 'error', text: event.message })
    case 'message.end':
      return updateMessage(messages, ids.assistantId, (message) => ({ ...message, status: event.status }))
    default:
      return messages
  }
}

/**
 * Ends a reply locally (the stream failed or was aborted), with an optional error notice.
 *
 * @param messages - The conversation's messages.
 * @param assistantId - The reply.
 * @param status - Its final status.
 * @param notice - An error to show in the reply.
 * @returns The new messages.
 */
export function endReply(messages: AssistantMessage[], assistantId: number, status: AssistantMessage['status'], notice?: string): AssistantMessage[] {
  return updateMessage(messages, assistantId, (message) => ({
    ...message,
    status: message.status === 'STREAMING' ? status : message.status,
    parts: notice ? [...message.parts, { type: 'notice', level: 'error', text: notice }] : message.parts,
  }))
}

/**
 * Text and presentation summaries for the streaming screen-reader announcer.
 *
 * @param message - A message.
 * @returns The concatenated text.
 */
export function messageText(message: AssistantMessage): string {
  return partsOf(message).map((part) => {
    if (part?.type === 'text') return typeof part.text === 'string' ? part.text : ''
    if (part?.type === 'presentation') return typeof part.summary === 'string' ? `\n${part.summary}\n` : ''
    return ''
  }).join('')
}

/**
 * A message's parts, or none when a malformed message has no list.
 *
 * @param message - A message.
 * @returns Its parts.
 */
export function partsOf(message: AssistantMessage): AssistantPart[] {
  return Array.isArray(message.parts) ? message.parts : []
}

/**
 * Replaces one message.
 *
 * @param messages - The messages.
 * @param id - The message id.
 * @param update - Produces the new message.
 * @returns The new messages, or the same array when the id is absent.
 */
function updateMessage(messages: AssistantMessage[], id: number, update: (message: AssistantMessage) => AssistantMessage): AssistantMessage[] {
  const index = messages.findIndex((message) => message?.id === id)
  if (index === -1) return messages
  const next = [...messages]
  // a message without a part list (malformed) is repaired rather than failing the event
  next[index] = update({ ...messages[index], parts: partsOf(messages[index]) })
  return next
}

/**
 * Appends a part to a message.
 *
 * @param messages - The messages.
 * @param id - The message id.
 * @param part - The part.
 * @returns The new messages.
 */
function appendPart(messages: AssistantMessage[], id: number, part: AssistantPart): AssistantMessage[] {
  if (!part || typeof part !== 'object' || typeof part.type !== 'string') return messages
  return updateMessage(messages, id, (message) => ({ ...message, parts: [...message.parts, part] }))
}

/**
 * Adds record references, skipping ones already present.
 *
 * @param existing - References already shown.
 * @param added - New references.
 * @returns The merged list.
 */
function mergeRefs(existing: AssistantRecordRef[], added: AssistantRecordRef[]): AssistantRecordRef[] {
  const seen = new Set(existing.map((ref) => `${ref.tableName}:${ref.id}`))
  const merged = [...existing]
  for (const ref of added) {
    const key = `${ref.tableName}:${ref.id}`
    if (!seen.has(key)) {
      seen.add(key)
      merged.push(ref)
    }
  }
  return merged
}
