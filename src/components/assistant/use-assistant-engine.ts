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
 * @file useAssistantEngine — runs assistant turns: creates the conversation when needed, adds
 * the optimistic messages, streams the reply into the TanStack Query cache (so it survives the
 * panel closing and route changes), follows `ui.navigate`, cancels, and resumes a reply that
 * was still streaming when the conversation was opened.
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import type {
  AssistantConversation,
  AssistantConversationDetail,
  AssistantMessage,
  AssistantPageContext,
  AssistantStreamEvent,
} from '@/types/assistant'
import {
  AssistantHttpError,
  cancelAssistantTurn,
  createAssistantConversation,
  resumeAssistantTurn,
  streamAssistantTurn,
  type AssistantTurnResult,
} from '@/lib/api/assistant'
import { internalAppHref } from '@/lib/utils/assistant-links'
import { getErrorMessage } from '@/lib/utils/error-utils'
import { assistantKeys, useAssistant } from './assistant-context'
import { endReply, optimisticTurnMessages, reduceStreamEvent, type TurnMessageIds } from './message-reducer'

/** Give up waiting for the server to confirm a cancel after this long, and drop the stream. */
const CANCEL_TIMEOUT_MS = 15_000

/** A turn streaming in one conversation. */
export interface AssistantRun {
  turnId: number | null
  status: 'running' | 'cancelling'
}

/** The turn runner used by the panel. */
export interface AssistantEngine {
  /** Running turns by conversation id. */
  runs: Record<number, AssistantRun>
  /**
   * Sends the user's text, starting a conversation when `conversationId` is null.
   *
   * @param text - The user's message.
   * @param conversationId - The conversation, or null for a new one.
   * @param pageContext - Where the user is (omitted when dismissed).
   */
  send: (text: string, conversationId: number | null, pageContext?: AssistantPageContext | null) => Promise<void>
  /**
   * Stops the running turn of a conversation.
   *
   * @param conversationId - The conversation.
   */
  cancel: (conversationId: number) => void
  /**
   * Re-attaches to a reply that is still streaming on the server.
   *
   * @param conversationId - The conversation.
   * @param message - The streaming assistant message.
   */
  attach: (conversationId: number, message: AssistantMessage) => void
}

/** Temporary ids of optimistic messages, below any server id. */
let nextTemporaryId = -1

/**
 * Creates the turn runner.
 *
 * @returns The engine.
 */
export function useAssistantEngine(): AssistantEngine {
  const queryClient = useQueryClient()
  const router = useRouter()
  const assistant = useAssistant()
  const [runs, setRuns] = useState<Record<number, AssistantRun>>({})
  const controllers = useRef(new Map<number, AbortController>())
  const turnIds = useRef(new Map<number, number>())
  const assistantRef = useRef(assistant)
  assistantRef.current = assistant

  // Abort every stream when the panel unmounts (sign-out); turns keep running on the server
  useEffect(() => {
    const active = controllers.current
    return () => active.forEach((controller) => controller.abort())
  }, [])

  const setMessages = useCallback((conversationId: number, update: (messages: AssistantMessage[]) => AssistantMessage[]) => {
    queryClient.setQueryData<AssistantConversationDetail>(assistantKeys.conversation(conversationId), (detail) =>
      detail ? { ...detail, messages: update(detail.messages) } : detail)
  }, [queryClient])

  const setRun = useCallback((conversationId: number, run: AssistantRun | null) => {
    setRuns((current) => {
      const next = { ...current }
      if (run) next[conversationId] = run
      else delete next[conversationId]
      return next
    })
  }, [])

  /** Applies one event to the cache and follows navigation. */
  const handleEvent = useCallback((conversationId: number, event: AssistantStreamEvent, ids: TurnMessageIds) => {
    setMessages(conversationId, (messages) => reduceStreamEvent(messages, event, ids))
    if (event.type === 'message.start') {
      turnIds.current.set(conversationId, event.turnId)
      setRuns((current) => (current[conversationId] ? { ...current, [conversationId]: { ...current[conversationId], turnId: event.turnId } } : current))
    }
    if (event.type === 'ui.navigate') {
      const href = internalAppHref(event.href)
      if (href) router.push(href)
    }
  }, [router, setMessages])

  /** Reconciles with the server and reports a finished reply the user is not looking at. */
  const finish = useCallback((conversationId: number, result: AssistantTurnResult | null) => {
    controllers.current.get(conversationId)?.abort()
    controllers.current.delete(conversationId)
    turnIds.current.delete(conversationId)
    setRun(conversationId, null)
    // a refused or lost turn keeps its local error (the server may have nothing to show for it)
    if (result) void queryClient.invalidateQueries({ queryKey: assistantKeys.conversation(conversationId) })
    void queryClient.invalidateQueries({ queryKey: [...assistantKeys.all(), 'conversations'] })
    const current = assistantRef.current
    if (result?.status !== 'COMPLETE' || !current) return
    if (current.open && current.activeConversationId === conversationId) return
    queryClient.setQueryData<AssistantConversation[]>(assistantKeys.conversations(), (list) =>
      list?.map((conversation) => (conversation.id === conversationId ? { ...conversation, unreadCount: conversation.unreadCount + 1 } : conversation)))
    toast('Assistant finished', {
      action: {
        label: 'View',
        onClick: () => {
          assistantRef.current?.setActiveConversationId(conversationId)
          assistantRef.current?.setOpen(true)
        },
      },
    })
  }, [queryClient, setRun])

  /** Streams a turn (new or resumed) and handles its end. */
  const run = useCallback(async (conversationId: number, ids: TurnMessageIds, start: (controller: AbortController) => Promise<AssistantTurnResult>) => {
    const controller = new AbortController()
    controllers.current.set(conversationId, controller)
    let result: AssistantTurnResult | null = null
    try {
      result = await start(controller)
      if (result.status === 'ABORTED') setMessages(conversationId, (messages) => endReply(messages, ids.assistantId, 'CANCELLED'))
    } catch (error) {
      const message = error instanceof AssistantHttpError || error instanceof Error ? error.message : 'The assistant could not answer.'
      setMessages(conversationId, (messages) => endReply(messages, ids.assistantId, 'ERROR', message))
    } finally {
      finish(conversationId, result)
    }
  }, [finish, setMessages])

  const send = useCallback(async (text: string, conversationId: number | null, pageContext?: AssistantPageContext | null) => {
    const trimmed = text.trim()
    if (!trimmed) return
    let id = conversationId
    if (id === null) {
      let conversation: AssistantConversation
      try {
        conversation = await createAssistantConversation(pageContext ? { context: pageContext } : {})
      } catch (error) {
        toast.error(getErrorMessage(error, 'Could not start a conversation.'))
        return
      }
      id = conversation.id
      queryClient.setQueryData<AssistantConversationDetail>(assistantKeys.conversation(id), { conversation, messages: [] })
      queryClient.setQueryData<AssistantConversation[]>(assistantKeys.conversations(), (list) => [conversation, ...(list ?? []).filter((item) => item.id !== conversation.id)])
      assistantRef.current?.setActiveConversationId(id)
    }
    const conversation = id
    if (controllers.current.has(conversation)) return
    const ids: TurnMessageIds = { userId: nextTemporaryId--, assistantId: nextTemporaryId-- }
    const optimistic = optimisticTurnMessages(trimmed, { userId: ids.userId as number, assistantId: ids.assistantId }, new Date().toISOString())
    queryClient.setQueryData<AssistantConversationDetail>(assistantKeys.conversation(conversation), (detail) =>
      detail ? { ...detail, messages: [...detail.messages, ...optimistic] } : detail)
    setRun(conversation, { turnId: null, status: 'running' })
    await run(conversation, ids, (controller) => streamAssistantTurn(
      conversation,
      pageContext ? { text: trimmed, pageContext } : { text: trimmed },
      { signal: controller.signal, onEvent: (event) => handleEvent(conversation, event, ids) }
    ))
  }, [handleEvent, queryClient, run, setRun])

  const attach = useCallback((conversationId: number, message: AssistantMessage) => {
    if (controllers.current.has(conversationId) || message.turnId === null) return
    const turnId = message.turnId
    const ids: TurnMessageIds = { userId: null, assistantId: message.id }
    // the replay rebuilds the reply from its first event
    setMessages(conversationId, (messages) => messages.map((item) => (item.id === message.id ? { ...item, parts: [] } : item)))
    turnIds.current.set(conversationId, turnId)
    setRun(conversationId, { turnId, status: 'running' })
    void run(conversationId, ids, (controller) => resumeAssistantTurn(turnId, 0, {
      signal: controller.signal,
      onEvent: (event) => handleEvent(conversationId, event, ids),
    }))
  }, [handleEvent, run, setMessages, setRun])

  const cancel = useCallback((conversationId: number) => {
    const controller = controllers.current.get(conversationId)
    if (!controller) return
    const turnId = turnIds.current.get(conversationId)
    setRuns((current) => (current[conversationId] ? { ...current, [conversationId]: { ...current[conversationId], status: 'cancelling' } } : current))
    if (turnId === undefined) {
      // the server has not started the turn yet: drop the request
      controller.abort()
      return
    }
    // the stream ends with a CANCELLED message.end; drop it if the server does not confirm in time
    const timer = setTimeout(() => controller.abort(), CANCEL_TIMEOUT_MS)
    controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true })
    cancelAssistantTurn(turnId).catch(() => controller.abort())
  }, [])

  return { runs, send, cancel, attach }
}
