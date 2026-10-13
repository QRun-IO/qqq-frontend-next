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
 * @file Assistant API — the qbit-assistant routes under `/qqq/v1/assistant`: the feature
 * probe, conversations, feedback, and turns streamed as server-sent events (read with
 * `fetch`, because axios cannot stream and `EventSource` cannot POST), with resume after a
 * dropped connection through `/turns/{id}/events?after={seq}`.
 */

import type {
  AssistantConversation,
  AssistantConversationDetail,
  AssistantConversationUpdate,
  AssistantFeedback,
  AssistantPageContext,
  AssistantPendingAction,
  AssistantStreamEvent,
} from '@/types/assistant'
import apiClient, { apiUrl, CLIENT_CHANNEL_HEADER } from './client'
import { SseParser, type SseEvent } from './sse-parser'

/** Stream event types this client understands; others (later phases) are skipped. */
const KNOWN_EVENTS = new Set<AssistantStreamEvent['type']>([
  'message.start', 'text.delta', 'tool.start', 'tool.result', 'ui.navigate', 'notice', 'usage', 'message.end', 'error', 'ping',
])

/** An HTTP error from a streamed request, with the backend's `{ error }` message. */
export class AssistantHttpError extends Error {
  /** The HTTP status code. */
  readonly status: number

  /**
   * Creates the error.
   *
   * @param status - The HTTP status code.
   * @param message - The backend's message, or a generic one.
   */
  constructor(status: number, message: string) {
    super(message)
    this.name = 'AssistantHttpError'
    this.status = status
  }
}

/** The stream ended without `message.end` and could not be resumed. */
export class AssistantStreamLostError extends Error {
  /**
   * Creates the error.
   *
   * @param message - What happened, for the user.
   */
  constructor(message = 'The connection to the assistant was lost.') {
    super(message)
    this.name = 'AssistantStreamLostError'
  }
}

// ─── Probe and conversations ──────────────────────────────────────────────────

// The probe and the conversation list live in a small module of their own: the dashboard shell
// loads them on every page, while the rest of this module loads with the panel.
export { getAssistantConfig, listAssistantConversations } from './assistant-probe'

/**
 * Starts a conversation.
 *
 * @param body - Optional title and the page context it starts from.
 * @param body.title - The title.
 * @param body.context - The page context.
 * @returns The new conversation.
 */
export async function createAssistantConversation(body: { title?: string; context?: AssistantPageContext } = {}): Promise<AssistantConversation> {
  return apiClient.post<AssistantConversation>('/assistant/conversations', body)
}

/**
 * Loads a conversation and a page of its messages.
 *
 * @param id - The conversation id.
 * @param page - Paging: messages before `before`, at most `limit`.
 * @param page.before - Only messages older than this message id.
 * @param page.limit - The page size (server default 50).
 * @returns The conversation and its messages, oldest first.
 */
export async function getAssistantConversation(id: number, page: { before?: number; limit?: number } = {}): Promise<AssistantConversationDetail> {
  const params: Record<string, number> = {}
  if (page.before !== undefined) params.before = page.before
  if (page.limit !== undefined) params.limit = page.limit
  const data = await apiClient.get<AssistantConversationDetail>(
    `/assistant/conversations/${id}`,
    Object.keys(params).length ? { params } : undefined
  )
  return { conversation: data.conversation, messages: Array.isArray(data.messages) ? data.messages : [] }
}

/**
 * Renames, pins or archives a conversation.
 *
 * @param id - The conversation id.
 * @param update - The changed properties.
 * @returns The updated conversation.
 */
export async function updateAssistantConversation(id: number, update: AssistantConversationUpdate): Promise<AssistantConversation> {
  return apiClient.patch<AssistantConversation>(`/assistant/conversations/${id}`, update)
}

/**
 * Deletes a conversation.
 *
 * @param id - The conversation id.
 */
export async function deleteAssistantConversation(id: number): Promise<void> {
  await apiClient.delete(`/assistant/conversations/${id}`)
}

/**
 * Asks the server to stop a running turn. The stream then ends with a `CANCELLED` `message.end`.
 *
 * @param turnId - The turn id from `message.start`.
 * @returns The server's acknowledgement.
 */
export async function cancelAssistantTurn(turnId: number): Promise<{ status: string }> {
  return apiClient.post<{ status: string }>(`/assistant/turns/${turnId}/cancel`)
}

/**
 * Records thumbs up or down on an assistant message.
 *
 * @param messageId - The assistant message id.
 * @param feedback - The rating and an optional reason or comment.
 */
export async function sendAssistantFeedback(messageId: number, feedback: AssistantFeedback): Promise<void> {
  await apiClient.post(`/assistant/messages/${messageId}/feedback`, feedback)
}

/**
 * Loads a pending action (a write the assistant proposed) and its current state.
 *
 * @param actionId - The action id from the `pending_action` render.
 * @returns The action.
 */
export async function getAssistantAction(actionId: number): Promise<AssistantPendingAction> {
  return apiClient.get<AssistantPendingAction>(`/assistant/actions/${actionId}`)
}

/**
 * Confirms a pending action: the server runs the write through the UI API with this session.
 *
 * @param actionId - The action id.
 * @returns The action after it ran, with the outcome and message.
 */
export async function confirmAssistantAction(actionId: number): Promise<AssistantPendingAction> {
  return apiClient.post<AssistantPendingAction>(`/assistant/actions/${actionId}/confirm`)
}

/**
 * Cancels a pending action; nothing changes.
 *
 * @param actionId - The action id.
 * @returns The rejected action.
 */
export async function rejectAssistantAction(actionId: number): Promise<AssistantPendingAction> {
  return apiClient.post<AssistantPendingAction>(`/assistant/actions/${actionId}/reject`)
}

// ─── Streaming ────────────────────────────────────────────────────────────────

/**
 * Converts one SSE event into a typed stream event.
 *
 * @param sse - The parsed server-sent event.
 * @returns The typed event and its sequence number; `event` is null for unknown types and
 *   malformed data (the sequence number still advances the resume position).
 */
export function toAssistantEvent(sse: SseEvent): { event: AssistantStreamEvent | null; seq?: number } {
  const idSeq = sse.id !== undefined && /^\d+$/.test(sse.id) ? Number(sse.id) : undefined
  let data: unknown
  try {
    data = JSON.parse(sse.data)
  } catch {
    return { event: null, seq: idSeq }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { event: null, seq: idSeq }
  const body = data as Record<string, unknown>
  const seq = typeof body.seq === 'number' ? body.seq : idSeq
  const type = sse.event as AssistantStreamEvent['type']
  if (!KNOWN_EVENTS.has(type)) return { event: null, seq }
  if (type !== 'ping' && seq === undefined) return { event: null }
  return { event: { ...body, type, ...(seq !== undefined ? { seq } : {}) } as AssistantStreamEvent, seq }
}

/** Options of {@link streamAssistantTurn} and {@link resumeAssistantTurn}. */
export interface AssistantStreamOptions {
  /** Called with every event, in order and without duplicates (pings excluded). */
  onEvent: (event: AssistantStreamEvent) => void
  /** Aborts the request (not the turn: use {@link cancelAssistantTurn} for that). */
  signal?: AbortSignal
  /** Resume attempts after a dropped connection without progress (default 3). */
  maxResumeAttempts?: number
  /** Base delay before a resume attempt, multiplied by the attempt number (default 1000 ms). */
  resumeDelayMs?: number
}

/** How a streamed turn ended. */
export interface AssistantTurnResult {
  /** `ABORTED` when the request was aborted locally before `message.end`. */
  status: 'COMPLETE' | 'CANCELLED' | 'ERROR' | 'ABORTED'
  turnId: number | null
  /** The last sequence number received. */
  lastSeq: number
}

/** Mutable progress shared by the first request and its resumes. */
interface StreamState {
  turnId: number | null
  lastSeq: number
  endStatus: 'COMPLETE' | 'CANCELLED' | 'ERROR' | null
}

/**
 * Starts a turn: posts the user's text and streams the reply. When the connection drops
 * before `message.end`, the stream resumes from the last sequence number received.
 *
 * @param conversationId - The conversation.
 * @param body - The user's text and the page context hint.
 * @param body.text - The user's message.
 * @param body.pageContext - Where the user is, when they have not dismissed it.
 * @param options - Event callback, abort signal and resume tuning.
 * @returns How the turn ended.
 * @throws {AssistantHttpError} When the server refuses the turn (400/403/409/429/503...).
 * @throws {AssistantStreamLostError} When the stream cannot be resumed.
 */
export async function streamAssistantTurn(
  conversationId: number,
  body: { text: string; pageContext?: AssistantPageContext },
  options: AssistantStreamOptions
): Promise<AssistantTurnResult> {
  const state: StreamState = { turnId: null, lastSeq: 0, endStatus: null }
  try {
    const response = await openStream(`/assistant/conversations/${conversationId}/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, options.signal)
    await readStream(response, state, options)
  } catch (error) {
    if (isAbort(error, options.signal)) return result(state, 'ABORTED')
    if (error instanceof AssistantHttpError) throw error
    // a network failure: resume below when the turn id is known
  }
  return finishWithResume(state, options)
}

/**
 * Attaches to a turn that is already running (or replays a finished one): events after
 * `after` are replayed, then the live tail follows.
 *
 * @param turnId - The turn id.
 * @param after - The last sequence number already applied (0 for all).
 * @param options - Event callback, abort signal and resume tuning.
 * @returns How the turn ended.
 * @throws {AssistantHttpError} When the server refuses (403/404).
 * @throws {AssistantStreamLostError} When the stream cannot be resumed.
 */
export async function resumeAssistantTurn(turnId: number, after: number, options: AssistantStreamOptions): Promise<AssistantTurnResult> {
  const state: StreamState = { turnId, lastSeq: after, endStatus: null }
  return finishWithResume(state, options, true)
}

/**
 * Resumes until `message.end` arrives, the request is aborted, or attempts run out.
 *
 * @param state - Stream progress.
 * @param options - Stream options.
 * @param immediate - Whether to make the first attempt without delay.
 * @returns How the turn ended.
 */
async function finishWithResume(state: StreamState, options: AssistantStreamOptions, immediate = false): Promise<AssistantTurnResult> {
  const maxAttempts = options.maxResumeAttempts ?? 3
  const baseDelay = options.resumeDelayMs ?? 1000
  let attempts = 0
  let first = immediate
  while (!state.endStatus) {
    if (options.signal?.aborted) return result(state, 'ABORTED')
    if (state.turnId === null || attempts >= maxAttempts) throw new AssistantStreamLostError()
    attempts++
    if (!first) {
      try {
        await delay(baseDelay * attempts, options.signal)
      } catch {
        return result(state, 'ABORTED')
      }
    }
    first = false
    const before = state.lastSeq
    try {
      const response = await openStream(`/assistant/turns/${state.turnId}/events?after=${state.lastSeq}`, { method: 'GET' }, options.signal)
      await readStream(response, state, options)
    } catch (error) {
      if (isAbort(error, options.signal)) return result(state, 'ABORTED')
      if (error instanceof AssistantHttpError && error.status !== 503 && error.status < 500) throw error
    }
    if (state.lastSeq > before) attempts = 0
  }
  return result(state, state.endStatus)
}

/**
 * Builds the turn result.
 *
 * @param state - Stream progress.
 * @param status - The final status.
 * @returns The result.
 */
function result(state: StreamState, status: AssistantTurnResult['status']): AssistantTurnResult {
  return { status, turnId: state.turnId, lastSeq: state.lastSeq }
}

/**
 * Sends a streamed request with the session cookie.
 *
 * @param path - Path under the API base URL.
 * @param init - Method, headers and body.
 * @param signal - Abort signal.
 * @returns The successful response, which has a body.
 * @throws {AssistantHttpError} For a non-2xx response (a 401 also starts the sign-in flow).
 */
async function openStream(path: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
  const url = typeof window === 'undefined' ? apiUrl(path) : new URL(apiUrl(path), window.location.href).toString()
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'text/event-stream', ...CLIENT_CHANNEL_HEADER, ...(init.headers as Record<string, string> | undefined) },
    signal,
  })
  if (!response.ok) {
    if (response.status === 401) apiClient.notifyUnauthorized()
    throw new AssistantHttpError(response.status, await errorMessage(response))
  }
  if (!response.body) throw new AssistantStreamLostError('This browser cannot read streamed responses.')
  return response
}

/**
 * Reads the backend's `{ error }` message from a failed response.
 *
 * @param response - The failed response.
 * @returns The message, or a generic one with the status.
 */
async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown }
    if (typeof body?.error === 'string' && body.error.trim()) return body.error.trim()
  } catch {
    // not JSON
  }
  return `The assistant request failed (HTTP ${response.status}).`
}

/**
 * Reads a response body to its end, applying each new event in order.
 *
 * @param response - A streaming response.
 * @param state - Stream progress, updated in place.
 * @param options - The event callback.
 */
async function readStream(response: Response, state: StreamState, options: AssistantStreamOptions): Promise<void> {
  const reader = (response.body as ReadableStream<Uint8Array>).getReader()
  const decoder = new TextDecoder()
  const parser = new SseParser()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      const text = done ? decoder.decode() : decoder.decode(value, { stream: true })
      for (const sse of parser.push(text)) {
        applyEvent(sse, state, options)
        if (state.endStatus) return
      }
      if (done) return
    }
  } finally {
    parser.end()
    reader.cancel().catch(() => undefined)
  }
}

/**
 * Applies one event: skips replayed duplicates, tracks the turn and its end, and forwards it.
 *
 * @param sse - The parsed server-sent event.
 * @param state - Stream progress.
 * @param options - The event callback.
 */
function applyEvent(sse: SseEvent, state: StreamState, options: AssistantStreamOptions): void {
  const { event, seq } = toAssistantEvent(sse)
  if (event?.type === 'ping') return
  if (seq !== undefined) {
    if (seq <= state.lastSeq) return
    state.lastSeq = seq
  }
  if (!event) return
  if (event.type === 'message.start') state.turnId = event.turnId
  if (event.type === 'message.end') state.endStatus = event.status
  options.onEvent(event)
}

/**
 * Whether an error is the abort of this request.
 *
 * @param error - The thrown value.
 * @param signal - The request's abort signal.
 * @returns True when the signal is aborted or the error is an `AbortError`.
 */
function isAbort(error: unknown, signal?: AbortSignal): boolean {
  return Boolean(signal?.aborted) || (error instanceof Error && error.name === 'AbortError')
}

/**
 * Waits, unless aborted first.
 *
 * @param ms - Milliseconds.
 * @param signal - Abort signal.
 * @returns A promise that resolves after `ms`, or rejects on abort.
 */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    /** Stops waiting. */
    function onAbort() {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
