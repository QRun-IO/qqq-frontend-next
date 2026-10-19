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
 * @file AssistantProvider — creates the shell-level assistant controller (probe, open state,
 * unread count, hand-over) for the dashboard layout. The panel itself loads lazily.
 */

'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'

import type { QInstance } from '@/types'
import type { AssistantPageContext } from '@/types/assistant'
import { getAssistantConfig, listAssistantConversations, reportAssistantClientError, supportsAssistantClientErrors } from '@/lib/api/assistant-probe'
import { setClientErrorSink } from '@/lib/errors/client-errors'
import { readAssistantDeepLink } from '@/lib/utils/assistant-deep-link'
import { ASSISTANT_DOCKED_MEDIA_QUERY, AssistantContext, assistantKeys, type AssistantController, type AssistantRequest } from './assistant-context'

/** localStorage key remembering that the docked panel was open. */
const OPEN_STORAGE_KEY = 'qqq-assistant-open'

/**
 * Reads a localStorage flag; storage can be unavailable (private mode, blocked site data).
 *
 * @param key - The key.
 * @returns Whether the stored value is `true`.
 */
function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === 'true'
  } catch {
    return false
  }
}

/**
 * Writes a localStorage flag, ignoring unavailable storage.
 *
 * @param key - The key.
 * @param value - The value.
 */
function writeFlag(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, String(value))
  } catch {
    // storage unavailable: the panel just does not reopen on the next visit
  }
}

/**
 * Whether the instance metadata announces the assistant qbit (`supplementalInstanceMetaData.assistant`,
 * published by qbit-assistant), the precondition for probing `/assistant/config`.
 *
 * @param metaData - Instance metadata.
 * @returns True when the entry is present.
 */
export function isAssistantInstalled(metaData: QInstance | undefined): boolean {
  const entry = metaData?.supplementalInstanceMetaData?.assistant
  return Boolean(entry) && typeof entry === 'object'
}

/**
 * Creates the assistant controller. Call it once in the dashboard layout (which also needs it
 * for the Ctrl/⌘+J shortcut) and pass the result to {@link AssistantProvider}.
 *
 * @param metaData - Instance metadata (tables, for the panel's page context).
 * @param isAuthenticated - The probe runs only for a signed-in user.
 * @returns The controller.
 */
export function useAssistantController(metaData: QInstance | undefined, isAuthenticated: boolean): AssistantController {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  // Only an instance that announces the qbit is probed: elsewhere /assistant/config would answer
  // 404 on every page load (a console error in every browser)
  const installed = isAssistantInstalled(metaData)
  const { data: config = null } = useQuery({
    queryKey: assistantKeys.config(),
    queryFn: getAssistantConfig,
    enabled: isAuthenticated && installed,
    staleTime: 1000 * 60 * 10,
    retry: false,
  })
  const enabled = installed && Boolean(config?.enabled)

  // UI failures (error boundaries, stream errors) go to Admin through the assistant's
  // client-error operation when the server has it; otherwise they are only logged.
  useEffect(() => {
    if (!enabled) return
    let active = true
    void supportsAssistantClientErrors().then((supported) => {
      if (active && supported) setClientErrorSink(reportAssistantClientError)
    })
    return () => {
      active = false
      setClientErrorSink(null)
    }
  }, [enabled])

  const { data: conversations } = useQuery({
    queryKey: assistantKeys.conversations(),
    queryFn: () => listAssistantConversations(),
    enabled,
    staleTime: 1000 * 60,
    // Replies landing in background threads (another tab, a long turn): refetch while the server
    // reports one running, so the badge and rail catch up; idle, only the usual refetch on focus
    refetchInterval: (query) => ((query.state.data ?? []).some((conversation) => conversation.running) ? 8000 : false),
  })
  const unreadCount = useMemo(() => (conversations ?? []).reduce((total, conversation) => total + (conversation.unreadCount || 0), 0), [conversations])

  const [open, setOpenState] = useState(false)
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null)
  const [pendingRequest, setPendingRequest] = useState<AssistantRequest | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const originRef = useRef<HTMLElement | null>(null)
  const wasOpen = useRef(false)

  const setOpen = useCallback((next: boolean) => {
    if (next && typeof document !== 'undefined') {
      const active = document.activeElement
      originRef.current = active instanceof HTMLElement && active !== document.body && !active.closest('[data-qqq-id="assistant-panel"]') ? active : null
    }
    setOpenState(next)
    if (typeof window !== 'undefined' && window.matchMedia?.(ASSISTANT_DOCKED_MEDIA_QUERY)?.matches) writeFlag(OPEN_STORAGE_KEY, next)
  }, [])

  // Closing returns focus to what had it before opening, else to the header button
  useEffect(() => {
    if (open || !wasOpen.current) {
      wasOpen.current = open
      return
    }
    wasOpen.current = false
    const frame = requestAnimationFrame(() => {
      const target = originRef.current?.isConnected ? originRef.current : triggerRef.current
      originRef.current = null
      const active = document.activeElement
      if (target && (!active || active === document.body || !active.isConnected)) target.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [open])

  // The docked panel reopens on the next visit when it was left open
  useEffect(() => {
    if (enabled && readFlag(OPEN_STORAGE_KEY) && window.matchMedia?.(ASSISTANT_DOCKED_MEDIA_QUERY)?.matches) setOpenState(true)
  }, [enabled])

  // Disabled (kill switch, permission removed): close and hide everything
  useEffect(() => {
    if (!enabled) setOpenState(false)
  }, [enabled])

  const toggle = useCallback(() => setOpen(!open), [open, setOpen])
  const openWith = useCallback((prompt: string, options?: { context?: AssistantPageContext | null; mode?: 'send' | 'prefill' }) => {
    const mode = options?.mode ?? 'send'
    if (mode === 'send' && !prompt.trim()) return
    setPendingRequest({ id: Date.now(), prompt: prompt.trim(), context: options?.context, mode })
    setOpen(true)
  }, [setOpen])

  // Deep link `?assistant=open&assistantPrompt=...` (the record Developer screen's "Ask the
  // assistant about this record"): a new conversation on this page with the prompt pre-filled,
  // not sent; both parameters are then removed from the URL. Inert while the assistant is unavailable.
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    const deepLink = readAssistantDeepLink(window.location.search)
    if (!deepLink) return
    openWith(deepLink.prompt, { mode: 'prefill' })
    router.replace(`${window.location.pathname}${deepLink.remainingSearch}${window.location.hash}`, { scroll: false })
  }, [enabled, pathname, openWith, router])
  const consumeRequest = useCallback((id: number) => {
    setPendingRequest((current) => (current?.id === id ? null : current))
  }, [])

  return useMemo<AssistantController>(() => ({
    config,
    enabled,
    open: enabled && open,
    setOpen,
    toggle,
    activeConversationId,
    setActiveConversationId,
    unreadCount: enabled ? unreadCount : 0,
    openWith,
    pendingRequest,
    consumeRequest,
    triggerRef,
    metaData,
  }), [config, enabled, open, setOpen, toggle, activeConversationId, unreadCount, openWith, pendingRequest, consumeRequest, metaData])
}

/**
 * Provides the assistant controller to the dashboard shell.
 *
 * @param props - Component properties.
 * @param props.value - The controller from {@link useAssistantController}.
 * @param props.children - The shell.
 * @returns The provider.
 */
export function AssistantProvider({ value, children }: { value: AssistantController; children: React.ReactNode }) {
  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>
}
