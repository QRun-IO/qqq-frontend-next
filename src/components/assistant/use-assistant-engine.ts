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

/** @file Runs and reattaches assistant turns independently of the visible conversation. */

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isCancelledError, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import type { ActiveAssistantTurn, AssistantConcurrency, AssistantConversation, AssistantConversationDetail, AssistantMessage, AssistantPageContext, AssistantPhase, AssistantStreamEvent } from '@/types/assistant'
import { AssistantStreamLostError, cancelAssistantTurn, createAssistantConversation, getAssistantConversation, listActiveAssistantTurns, resumeAssistantTurn, streamAssistantTurn, type AssistantTurnResult } from '@/lib/api/assistant'
import { internalAppHref } from '@/lib/utils/assistant-links'
import { getErrorMessage } from '@/lib/utils/error-utils'
import { assistantKeys, useAssistant } from './assistant-context'
import { endReply, optimisticTurnMessages, reduceStreamEvent, type TurnMessageIds } from './message-reducer'

/** A single independently streamed answer. */
export interface AssistantRun {
  key: number
  conversationId: number
  assistantMessageId: number
  turnId: number | null
  status: 'running' | 'cancelling'
  phase: AssistantPhase | 'starting'
  toolLabel?: string
  startedAt: string
}

/** The panel's turn runner. */
export interface AssistantEngine {
  /** Runs grouped by conversation, newest first. */
  runs: Record<number, AssistantRun[]>
  /** Conversations whose connection needs checking. */
  lostConversations: number[]
  /** Sends another question, even while earlier answers are running. */
  send: (text: string, conversationId: number | null, pageContext?: AssistantPageContext | null, concurrency?: AssistantConcurrency) => Promise<void>
  /** Stops every answer in the conversation. */
  cancel: (conversationId: number) => void
  /** Replays a persisted streaming reply, once per turn. */
  attach: (conversationId: number, message: AssistantMessage, active?: ActiveAssistantTurn) => void
  /** Discovers active turns and refreshes finished or disconnected conversations. */
  reconcile: () => Promise<void>
}

let nextTemporaryId = -1
let nextRunKey = 0

/**
 * Owns the streams while the assistant is available, including while its panel is closed.
 *
 * @returns Runs and actions for the panel.
 */
export function useAssistantEngine(): AssistantEngine {
  const queryClient = useQueryClient()
  const router = useRouter()
  const assistant = useAssistant()
  const assistantRef = useRef(assistant)
  assistantRef.current = assistant
  const [runState, setRunState] = useState<Record<number, AssistantRun>>({})
  const [lostConversations, setLostConversations] = useState<number[]>([])
  const activeRuns = useRef(new Map<number, { run: AssistantRun; controller: AbortController }>())
  const attempted = useRef(new Set<number>())
  const lost = useRef(new Set<number>())
  const mounted = useRef(true)
  const checking = useRef<Promise<void> | null>(null)

  const publish = useCallback(() => {
    if (!mounted.current) return
    setRunState(Object.fromEntries([...activeRuns.current].map(([key, value]) => [key, { ...value.run }])))
    queryClient.setQueryData(assistantKeys.busy(), activeRuns.current.size > 0)
  }, [queryClient])

  useEffect(() => {
    mounted.current = true
    const active = activeRuns.current
    const attempts = attempted.current
    return () => {
      mounted.current = false
      active.forEach(({ controller }) => controller.abort())
      active.clear()
      attempts.clear()
      queryClient.setQueryData(assistantKeys.busy(), false)
    }
  }, [queryClient])

  const setMessages = useCallback((conversationId: number, update: (messages: AssistantMessage[]) => AssistantMessage[]) => {
    queryClient.setQueryData<AssistantConversationDetail>(assistantKeys.conversation(conversationId), (detail) =>
      detail ? { ...detail, messages: update(detail.messages) } : detail)
  }, [queryClient])

  const handleEvent = useCallback((key: number, event: AssistantStreamEvent, ids: TurnMessageIds) => {
    const entry = activeRuns.current.get(key)
    if (!entry || !mounted.current) return
    const run = entry.run
    setMessages(run.conversationId, (messages) => reduceStreamEvent(messages, event, ids))
    if (event.type === 'message.start') {
      run.turnId = event.turnId
      attempted.current.add(event.turnId)
      run.assistantMessageId = event.messageId
      run.startedAt = event.startedAt ?? run.startedAt
      run.phase = 'thinking'
    } else if (event.type === 'turn.phase') {
      run.phase = event.phase
      run.toolLabel = event.label || event.toolName
    } else if (event.type === 'tool.start') {
      run.phase = 'tool'
      run.toolLabel = event.summary || event.name
    } else if (event.type === 'text.delta') {
      run.phase = 'writing'
    }
    publish()
    if (event.type === 'ui.navigate') {
      const href = internalAppHref(event.href)
      if (href) router.push(href)
    }
  }, [publish, router, setMessages])

  const run = useCallback(async (entry: AssistantRun, ids: TurnMessageIds, start: (controller: AbortController) => Promise<AssistantTurnResult>) => {
    const controller = new AbortController()
    activeRuns.current.set(entry.key, { run: entry, controller })
    publish()
    let result: AssistantTurnResult | null = null
    try {
      result = await start(controller)
      if (mounted.current && result.status === 'ABORTED') setMessages(entry.conversationId, (messages) => endReply(messages, ids.assistantId, 'CANCELLED'))
    } catch (error) {
      if (!mounted.current) return
      setMessages(entry.conversationId, (messages) => endReply(messages, ids.assistantId, 'ERROR', getErrorMessage(error, 'The assistant could not answer.')))
      if (error instanceof AssistantStreamLostError) {
        lost.current.add(entry.conversationId)
        setLostConversations([...lost.current])
      }
    } finally {
      controller.abort()
      activeRuns.current.delete(entry.key)
      publish()
      if (mounted.current) {
        // Do not refetch over another stream's optimistic messages or partial reply.
        if (result && ![...activeRuns.current.values()].some(({ run }) => run.conversationId === entry.conversationId)) {
          void queryClient.invalidateQueries({ queryKey: assistantKeys.conversation(entry.conversationId) })
        }
        void queryClient.invalidateQueries({ queryKey: [...assistantKeys.all(), 'conversations'] })
        const current = assistantRef.current
        if (result?.status === 'COMPLETE' && current && (!current.open || current.activeConversationId !== entry.conversationId)) {
          queryClient.setQueryData<AssistantConversation[]>(assistantKeys.conversations(), (list) =>
            list?.map((conversation) => conversation.id === entry.conversationId ? { ...conversation, unreadCount: conversation.unreadCount + 1 } : conversation))
          toast('Assistant finished', { action: { label: 'View', onClick: () => {
            assistantRef.current?.setActiveConversationId(entry.conversationId)
            assistantRef.current?.setOpen(true)
          } } })
        }
      }
    }
  }, [publish, queryClient, setMessages])

  const send = useCallback(async (text: string, conversationId: number | null, pageContext?: AssistantPageContext | null, concurrency: AssistantConcurrency = 'supersede') => {
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
      if (!mounted.current) return
      id = conversation.id
      queryClient.setQueryData<AssistantConversationDetail>(assistantKeys.conversation(id), { conversation, messages: [] })
      queryClient.setQueryData<AssistantConversation[]>(assistantKeys.conversations(), (list) => [conversation, ...(list ?? []).filter((item) => item.id !== conversation.id)])
      assistantRef.current?.setActiveConversationId(id)
    }
    try {
      await queryClient.ensureQueryData({ queryKey: assistantKeys.conversation(id), queryFn: () => getAssistantConversation(id as number) })
      // A detail request started before this send must not replace the optimistic messages.
      await queryClient.cancelQueries({ queryKey: assistantKeys.conversation(id), exact: true }, { revert: false })
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not load the conversation.'))
      return
    }
    if (!mounted.current) return
    const ids: TurnMessageIds = { userId: nextTemporaryId--, assistantId: nextTemporaryId-- }
    const startedAt = new Date().toISOString()
    const optimistic = optimisticTurnMessages(trimmed, { userId: ids.userId as number, assistantId: ids.assistantId }, startedAt)
    setMessages(id, (messages) => [...messages, ...optimistic])
    const entry: AssistantRun = { key: ++nextRunKey, conversationId: id, assistantMessageId: ids.assistantId, turnId: null, status: 'running', phase: 'starting', startedAt }
    await run(entry, ids, (controller) => streamAssistantTurn(entry.conversationId,
      { text: trimmed, ...(pageContext ? { pageContext } : {}), concurrency },
      { signal: controller.signal, onEvent: (event) => handleEvent(entry.key, event, ids) }))
  }, [handleEvent, queryClient, run, setMessages])

  const attach = useCallback((conversationId: number, message: AssistantMessage, active?: ActiveAssistantTurn) => {
    if (!mounted.current || message.turnId === null || attempted.current.has(message.turnId) || [...activeRuns.current.values()].some(({ run }) => run.turnId === message.turnId || (run.conversationId === conversationId && run.turnId === null))) return
    const turnId = message.turnId
    attempted.current.add(turnId)
    const ids: TurnMessageIds = { userId: null, assistantId: message.id }
    setMessages(conversationId, (messages) => messages.map((item) => item.id === message.id ? { ...item, status: 'STREAMING', parts: [] } : item))
    const entry: AssistantRun = {
      key: ++nextRunKey, conversationId, assistantMessageId: message.id, turnId,
      status: active?.status === 'CANCELLING' ? 'cancelling' : 'running',
      phase: active?.phase ?? 'starting', startedAt: active?.startedAt ?? message.createDate,
    }
    void run(entry, ids, (controller) => resumeAssistantTurn(turnId, 0, {
      signal: controller.signal, onEvent: (event) => handleEvent(entry.key, event, ids),
    }))
  }, [handleEvent, run, setMessages])

  const reconcile = useCallback((): Promise<void> => {
    if (checking.current) return checking.current
    checking.current = (async () => {
      try {
        const turns = await queryClient.fetchQuery({ queryKey: assistantKeys.activeTurns(), queryFn: listActiveAssistantTurns, staleTime: 0, retry: false })
        const conversationIds = new Set([...turns.map((turn) => turn.conversationId), ...lost.current])
        const selected = assistantRef.current?.activeConversationId
        if (selected != null) conversationIds.add(selected)
        for (const conversationId of conversationIds) {
          if (!mounted.current) return
          const attached = [...activeRuns.current.values()].filter(({ run }) => run.conversationId === conversationId)
          const cached = queryClient.getQueryData<AssistantConversationDetail>(assistantKeys.conversation(conversationId))
          const detail = attached.length && cached ? cached : await queryClient.fetchQuery({
            queryKey: assistantKeys.conversation(conversationId), queryFn: () => getAssistantConversation(conversationId), staleTime: 0,
          })
          if (!mounted.current) return
          for (const turn of turns.filter((item) => item.conversationId === conversationId)) {
            // The local start POST may already have inserted this turn but not delivered its id.
            if ([...activeRuns.current.values()].some(({ run }) => run.turnId === turn.turnId || (run.conversationId === conversationId && run.turnId === null))) continue
            attempted.current.delete(turn.turnId)
            const message = detail.messages.find((item) => item.id === turn.assistantMessageId) ?? {
              id: turn.assistantMessageId, role: 'ASSISTANT' as const, status: 'STREAMING' as const,
              turnId: turn.turnId, createDate: turn.startedAt, parts: [],
            }
            setMessages(conversationId, (messages) => messages.some((item) => item.id === message.id) ? messages : [...messages, message])
            attach(conversationId, { ...message, turnId: turn.turnId }, turn)
          }
          // Old servers have no active-turn route; their persisted STREAMING messages still attach.
          for (const message of detail.messages) {
            if (message.role === 'ASSISTANT' && message.status === 'STREAMING' && ![...activeRuns.current.values()].some(({ run }) => run.turnId === message.turnId)) {
              if (lost.current.has(conversationId) && message.turnId !== null) attempted.current.delete(message.turnId)
              if (![...activeRuns.current.values()].some(({ run }) => run.turnId === message.turnId)) attach(conversationId, message)
            }
          }
          lost.current.delete(conversationId)
        }
        if (mounted.current) setLostConversations([...lost.current])
      } catch (error) {
        if (mounted.current && !isCancelledError(error)) toast.error(getErrorMessage(error, 'Could not check running answers.'))
      }
    })().finally(() => { checking.current = null })
    return checking.current
  }, [attach, queryClient, setMessages])

  useEffect(() => {
    void reconcile()
    let hiddenAt: number | null = document.hidden ? Date.now() : null
    const checkFocus = () => {
      if (!document.hidden && hiddenAt !== null) {
        if (Date.now() - hiddenAt > 30_000) void reconcile()
        hiddenAt = null
      }
    }
    const visibility = () => {
      if (document.hidden) hiddenAt = Date.now()
      else checkFocus()
    }
    const online = () => { void reconcile() }
    window.addEventListener('focus', checkFocus)
    window.addEventListener('online', online)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      window.removeEventListener('focus', checkFocus)
      window.removeEventListener('online', online)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [reconcile])

  const cancel = useCallback((conversationId: number) => {
    for (const { run, controller } of activeRuns.current.values()) {
      if (run.conversationId !== conversationId) continue
      run.status = 'cancelling'
      if (run.turnId === null) {
        controller.abort()
        continue
      }
      const timer = setTimeout(() => controller.abort(), 15_000)
      controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true })
      void cancelAssistantTurn(run.turnId).then(({ status }) => {
        // Old servers report 409 for a finished turn; abort its stale tail and reconcile.
        if (['FINISHED', 'COMPLETE', 'CANCELLED', 'ERROR'].includes(status)) controller.abort()
      }).catch((error) => {
        clearTimeout(timer)
        run.status = 'running'
        publish()
        toast.error(getErrorMessage(error, 'Could not stop the answer.'))
      })
    }
    publish()
  }, [publish])

  const runs = useMemo(() => {
    const grouped: Record<number, AssistantRun[]> = {}
    for (const entry of Object.values(runState).sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt) || b.key - a.key)) (grouped[entry.conversationId] ??= []).push(entry)
    return grouped
  }, [runState])
  return { runs, lostConversations, send, cancel, attach, reconcile }
}
