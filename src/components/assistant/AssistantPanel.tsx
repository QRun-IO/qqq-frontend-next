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
 * @file AssistantPanel — the assistant chat panel (loaded lazily by AssistantMount). From
 * 1024 px it docks beside the page as a resizable column (360-640 px) with its own scrolling
 * message list; below that it is a full-height dialog sheet that follows the on-screen keyboard.
 */

'use client'

import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { usePathname } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, ArchiveRestore, Eye, MoreHorizontal, PanelLeft, Pencil, PencilLine, Pin, PinOff, SquarePen, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

import type { QInstance } from '@/types'
import type { AssistantConversation, AssistantConversationDetail, AssistantConversationStatus, AssistantConversationUpdate } from '@/types/assistant'
import {
  deleteAssistantConversation,
  getAssistantConversation,
  listAssistantConversations,
  updateAssistantConversation,
} from '@/lib/api/assistant'
import { useMediaQuery } from '@/lib/hooks/use-media-query'
import { useLocalStorage } from '@/lib/hooks/use-local-storage'
import { getErrorMessage } from '@/lib/utils/error-utils'
import { assistantPageInfo, type AssistantPageInfo } from '@/lib/utils/assistant-links'
import { getRecentRecords } from '@/lib/utils/recent-records'
import { cn } from '@/lib/utils/cn'
import { ASSISTANT_DOCKED_MEDIA_QUERY, assistantKeys, useAssistant, type AssistantController } from './assistant-context'
import { AssistantComposer } from './AssistantComposer'
import { AssistantMessageView } from './AssistantMessageView'
import { ConversationRail, conversationTitle } from './ConversationRail'
import { useAssistantEngine, type AssistantEngine } from './use-assistant-engine'
import { useStreamAnnouncer } from './use-stream-announcer'

/** Docked width limits, in pixels. */
export const PANEL_MIN_WIDTH = 360
export const PANEL_MAX_WIDTH = 640
const PANEL_DEFAULT_WIDTH = 400
/** Below this panel width the conversation list replaces the messages instead of sitting beside them. */
const SIDE_BY_SIDE_MIN_WIDTH = 560
/** Room kept for the sidebar (16rem) and a readable page (25rem) beside the docked panel. */
const PAGE_RESERVE = '41rem'

/**
 * Clamps a docked width.
 *
 * @param width - Requested width.
 * @returns The width within 360-640 px.
 */
export function clampPanelWidth(width: number): number {
  if (!Number.isFinite(width)) return PANEL_DEFAULT_WIDTH
  return Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, Math.round(width)))
}

/**
 * The visual viewport's height and top offset, so the sheet stays above the on-screen keyboard.
 *
 * @param active - Whether to track it.
 * @returns The height and offset, or null without `visualViewport`.
 */
function useVisualViewport(active: boolean): { height: number; top: number } | null {
  const [box, setBox] = useState<{ height: number; top: number } | null>(null)
  useEffect(() => {
    const viewport = typeof window === 'undefined' ? undefined : window.visualViewport
    if (!active || !viewport) return
    /**
     * Copies the viewport's box.
     *
     * @returns Nothing.
     */
    const update = () => setBox({ height: viewport.height, top: viewport.offsetTop })
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [active])
  return active ? box : null
}

/**
 * The current page as assistant context, read from the location (the query filter can change
 * without a navigation, so callers re-read it before sending).
 *
 * @param metaData - Instance metadata.
 * @returns The page info now.
 */
function readPageInfo(metaData: QInstance | undefined): AssistantPageInfo | null {
  if (typeof window === 'undefined') return null
  const segments = window.location.pathname.split('/').filter(Boolean)
  let recordLabel: string | undefined
  if (segments.length >= 3) {
    let recordId = segments[2]
    try {
      recordId = decodeURIComponent(recordId)
    } catch {
      // keep the raw segment
    }
    recordLabel = getRecentRecords().find((record) => record.tableName === segments[1] && record.recordId === recordId)?.recordLabel
  }
  return assistantPageInfo(window.location.pathname, window.location.search, metaData, recordLabel)
}

/** Props of {@link PanelBody}. */
interface PanelBodyProps {
  assistant: AssistantController
  engine: AssistantEngine
  /** Whether the list and the messages fit side by side. */
  wide: boolean
  /** The title element id (labels the panel). */
  titleId: string
  composerRef: React.RefObject<HTMLTextAreaElement | null>
}

/**
 * Header, conversation list, messages and composer, shared by the docked panel and the sheet.
 *
 * @param props - Component properties.
 * @returns The panel body.
 */
function PanelBody({ assistant, engine, wide, titleId, composerRef }: PanelBodyProps) {
  const queryClient = useQueryClient()
  const { activeConversationId, setActiveConversationId, pendingRequest, consumeRequest, metaData } = assistant
  const pathname = usePathname()
  const [railOpen, setRailOpen] = useState(false)
  const [railStatus, setRailStatus] = useState<AssistantConversationStatus>('ACTIVE')
  const [renaming, setRenaming] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [dismissedRoute, setDismissedRoute] = useState<string | null>(null)
  const [pageInfo, setPageInfo] = useState(() => readPageInfo(metaData))
  const [prefill, setPrefill] = useState<{ id: number; text: string } | null>(null)
  const listId = useId()
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)

  useEffect(() => setPageInfo(readPageInfo(metaData)), [pathname, metaData])

  const conversationsQuery = useQuery({
    queryKey: assistantKeys.conversations(railStatus),
    queryFn: () => listAssistantConversations(railStatus),
    staleTime: 1000 * 60,
  })
  const run = activeConversationId !== null ? engine.runs[activeConversationId] : undefined
  const detailQuery = useQuery({
    queryKey: assistantKeys.conversation(activeConversationId ?? 0),
    queryFn: () => getAssistantConversation(activeConversationId as number),
    enabled: activeConversationId !== null,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
  const detail = activeConversationId !== null ? detailQuery.data : undefined
  const messages = useMemo(() => detail?.messages ?? [], [detail])
  const conversation: AssistantConversation | undefined = detail?.conversation
    ?? conversationsQuery.data?.find((item) => item.id === activeConversationId)
  const announcement = useStreamAnnouncer(messages)

  // Opening a conversation reads it: the badge drops its unread replies
  useEffect(() => {
    if (activeConversationId === null || !assistant.open) return
    queryClient.setQueryData<AssistantConversation[]>(assistantKeys.conversations(), (list) =>
      list?.map((item) => (item.id === activeConversationId && item.unreadCount ? { ...item, unreadCount: 0 } : item)))
  }, [activeConversationId, assistant.open, queryClient, messages.length])

  // A reply still streaming on the server (another tab, a reload): follow it
  useEffect(() => {
    if (activeConversationId === null || run) return
    const streaming = messages.find((message) => message.role === 'ASSISTANT' && message.status === 'STREAMING' && message.id > 0 && message.turnId !== null)
    if (streaming) engine.attach(activeConversationId, streaming)
  }, [activeConversationId, messages, run, engine])

  // Hand-overs: the command palette sends at once, the deep link only pre-fills
  useEffect(() => {
    if (!pendingRequest) return
    consumeRequest(pendingRequest.id)
    setActiveConversationId(null)
    setRailOpen(false)
    if (pendingRequest.mode === 'prefill') {
      setPrefill({ id: pendingRequest.id, text: pendingRequest.prompt })
      return
    }
    const context = pendingRequest.context === undefined ? readPageInfo(metaData)?.context ?? null : pendingRequest.context
    void engine.send(pendingRequest.prompt, null, context)
  }, [pendingRequest, consumeRequest, setActiveConversationId, metaData, engine])

  // Keep the newest message in view while the user has not scrolled up
  useLayoutEffect(() => {
    const element = scrollRef.current
    if (element && stickToBottom.current) element.scrollTop = element.scrollHeight
  }, [messages])
  useEffect(() => {
    stickToBottom.current = true
  }, [activeConversationId])

  const contextDismissed = pageInfo !== null && dismissedRoute === pageInfo.context.route

  /**
   * Sends from the composer, with the page context unless dismissed.
   *
   * @param text - The message.
   */
  const send = (text: string) => {
    const info = readPageInfo(metaData)
    const context = info && dismissedRoute !== info.context.route ? info.context : null
    stickToBottom.current = true
    void engine.send(text, activeConversationId, context)
  }

  /**
   * Applies a change to the active conversation.
   *
   * @param update - The change.
   */
  const updateConversation = async (update: AssistantConversationUpdate) => {
    if (activeConversationId === null) return
    try {
      const updated = await updateAssistantConversation(activeConversationId, update)
      queryClient.setQueryData<AssistantConversationDetail>(assistantKeys.conversation(updated.id), (current) => (current ? { ...current, conversation: updated } : current))
      await queryClient.invalidateQueries({ queryKey: [...assistantKeys.all(), 'conversations'] })
      if (update.status && update.status !== railStatus) setActiveConversationId(null)
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not update the conversation.'))
    }
  }

  /** Deletes the active conversation. */
  const deleteConversation = async () => {
    if (activeConversationId === null) return
    const id = activeConversationId
    try {
      await deleteAssistantConversation(id)
      setActiveConversationId(null)
      queryClient.removeQueries({ queryKey: assistantKeys.conversation(id) })
      await queryClient.invalidateQueries({ queryKey: [...assistantKeys.all(), 'conversations'] })
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not delete the conversation.'))
    }
  }

  const showMessages = wide || !railOpen
  const profile = assistant.config?.profile
  const assistantName = profile?.displayName?.trim() || 'Assistant'
  const title = activeConversationId === null ? assistantName : conversationTitle(conversation)
  const iconButton = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:h-11 pointer-coarse:w-11'
  const menuItem = 'flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground outline-none data-[highlighted]:bg-accent pointer-coarse:min-h-11'

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-2" style={{ minHeight: 'var(--qqq-header-height)' }}>
        <button
          type="button"
          className={iconButton}
          onClick={() => setRailOpen((value) => !value)}
          aria-expanded={railOpen}
          aria-controls={listId}
          aria-label={railOpen ? 'Hide conversations' : 'Show conversations'}
          data-qqq-id="assistant-rail-toggle"
        >
          <PanelLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        {renaming && conversation ? (
          <form
            className="min-w-0 flex-1"
            onSubmit={(event) => {
              event.preventDefault()
              const value = String(new FormData(event.currentTarget).get('title') ?? '').trim()
              setRenaming(false)
              if (value && value !== conversation.title) void updateConversation({ title: value })
            }}
          >
            <label className="sr-only" htmlFor={`${titleId}-rename`}>Conversation name</label>
            <input
              id={`${titleId}-rename`}
              name="title"
              defaultValue={conversation.title ?? ''}
              autoFocus
              maxLength={200}
              onBlur={(event) => event.currentTarget.form?.requestSubmit()}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.stopPropagation()
                  setRenaming(false)
                }
              }}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-base text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
              data-qqq-id="assistant-rename-input"
            />
          </form>
        ) : (
          <h2 id={titleId} className="min-w-0 flex-1 truncate px-1 text-sm font-semibold text-foreground" data-qqq-id="assistant-title">{title}</h2>
        )}
        {conversation && activeConversationId !== null && assistant.config?.features?.writeMode && (
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(conversation.writeMode)}
            onClick={() => void updateConversation({ writeMode: !conversation.writeMode })}
            title={conversation.writeMode
              ? 'Write mode: the assistant may propose changes, which you confirm. It acts only with your own permissions.'
              : 'Read-only: the assistant cannot change anything. Switch to Write to let it propose changes you confirm.'}
            className={cn(
              'inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-medium pointer-coarse:min-h-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              conversation.writeMode ? 'border-amber-500/60 bg-amber-500/10 text-amber-800 dark:text-amber-300' : 'border-border text-muted-foreground hover:bg-accent'
            )}
            data-qqq-id="assistant-write-mode"
          >
            {conversation.writeMode ? <PencilLine className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
            {conversation.writeMode ? 'Write' : 'Read-only'}
          </button>
        )}
        {conversation && activeConversationId !== null && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button type="button" className={iconButton} aria-label="Conversation actions" data-qqq-id="assistant-conversation-menu">
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={4} className="z-[2100] min-w-44 rounded-lg border border-border bg-popover p-1 shadow-lg" data-qqq-id="assistant-conversation-menu-content">
                <DropdownMenu.Item className={menuItem} onSelect={() => setRenaming(true)} data-qqq-id="assistant-rename">
                  <Pencil className="h-4 w-4 text-muted-foreground" aria-hidden="true" />Rename
                </DropdownMenu.Item>
                <DropdownMenu.Item className={menuItem} onSelect={() => void updateConversation({ pinned: !conversation.pinned })} data-qqq-id="assistant-pin">
                  {conversation.pinned ? <PinOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> : <Pin className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                  {conversation.pinned ? 'Unpin' : 'Pin'}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={menuItem}
                  onSelect={() => void updateConversation({ status: conversation.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED' })}
                  data-qqq-id="assistant-archive"
                >
                  {conversation.status === 'ARCHIVED' ? <ArchiveRestore className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> : <Archive className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                  {conversation.status === 'ARCHIVED' ? 'Unarchive' : 'Archive'}
                </DropdownMenu.Item>
                <DropdownMenu.Item className={cn(menuItem, 'text-destructive')} onSelect={() => setConfirmDelete(true)} data-qqq-id="assistant-delete">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />Delete
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
        <button
          type="button"
          className={iconButton}
          onClick={() => {
            setActiveConversationId(null)
            setRailOpen(false)
            requestAnimationFrame(() => composerRef.current?.focus())
          }}
          aria-label="New conversation"
          data-qqq-id="assistant-new"
        >
          <SquarePen className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" className={iconButton} onClick={() => assistant.setOpen(false)} aria-label="Close assistant" data-qqq-id="assistant-close">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {railOpen && (
          <div id={listId} className={cn('flex min-h-0', wide ? 'w-52 shrink-0 border-r border-border' : 'min-w-0 flex-1')}>
            <ConversationRail
              className="min-w-0 flex-1"
              conversations={conversationsQuery.data}
              loading={conversationsQuery.isLoading}
              activeId={activeConversationId}
              status={railStatus}
              onStatusChange={setRailStatus}
              onSelect={(id) => {
                setActiveConversationId(id)
                if (!engine.runs[id]) void queryClient.invalidateQueries({ queryKey: assistantKeys.conversation(id) })
                if (!wide) setRailOpen(false)
              }}
            />
          </div>
        )}
        {showMessages && (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div
              ref={scrollRef}
              onScroll={(event) => {
                const element = event.currentTarget
                stickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48
              }}
              className="@container min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 py-3"
              tabIndex={0}
              role="log"
              aria-live="off"
              aria-label="Messages"
              data-qqq-id="assistant-messages"
            >
              {activeConversationId === null && (
                <div className="py-6 text-center text-sm text-muted-foreground" data-qqq-id="assistant-empty">
                  <p className="font-medium text-foreground">{profile?.greeting?.trim() || 'Ask about your data'}</p>
                  <p className="mt-1">Find records, count and explain them, or ask to be taken to a screen. {assistantName} sees and does only what you can, through the same API as these screens.</p>
                  {(profile?.starterPrompts?.length ?? 0) > 0 && (
                    <ul className="mt-4 flex flex-wrap justify-center gap-2" aria-label="Suggested questions" data-qqq-id="assistant-starters">
                      {profile?.starterPrompts?.map((prompt) => (
                        <li key={prompt} className="max-w-full">
                          <button
                            type="button"
                            onClick={() => send(prompt)}
                            disabled={Boolean(run)}
                            className="max-w-full rounded-full border border-border bg-background px-3 py-1.5 text-left text-xs text-foreground hover:bg-accent pointer-coarse:min-h-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                          >
                            {prompt}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {activeConversationId !== null && detailQuery.isLoading && <p className="text-xs text-muted-foreground" role="status">Loading conversation...</p>}
              {activeConversationId !== null && detailQuery.isError && (
                <p className="text-xs text-destructive" role="alert">{getErrorMessage(detailQuery.error, 'Could not load the conversation.')}</p>
              )}
              {messages.map((message) => <AssistantMessageView key={message.id} message={message} />)}
            </div>
            <AssistantComposer
              ref={composerRef}
              pageInfo={pageInfo}
              contextDismissed={contextDismissed}
              onDismissContext={() => setDismissedRoute(pageInfo?.context.route ?? null)}
              onRefreshContext={() => setPageInfo(readPageInfo(metaData))}
              streaming={Boolean(run)}
              stopping={run?.status === 'cancelling'}
              onSend={send}
              onStop={() => activeConversationId !== null && engine.cancel(activeConversationId)}
              prefill={prefill}
            />
          </div>
        )}
      </div>
      <div className="sr-only" aria-live="polite" aria-atomic="true" data-qqq-id="assistant-announcer">{announcement}</div>

      <AlertDialog.Root open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-[2200] bg-black/40" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[2201] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-5 shadow-lg focus:outline-none" data-qqq-id="assistant-delete-dialog">
            <AlertDialog.Title className="text-base font-semibold text-foreground">Delete this conversation?</AlertDialog.Title>
            <AlertDialog.Description className="mt-1 text-sm text-muted-foreground">{conversationTitle(conversation)} and its messages are deleted. This cannot be undone.</AlertDialog.Description>
            <div className="mt-4 flex justify-end gap-2">
              <AlertDialog.Cancel className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11">Cancel</AlertDialog.Cancel>
              <AlertDialog.Action
                className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
                onClick={() => void deleteConversation()}
                data-qqq-id="assistant-delete-confirm"
              >
                Delete
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  )
}

/**
 * The docked panel: a resizable complementary column beside the page.
 *
 * @param props - Component properties.
 * @param props.assistant - The controller.
 * @param props.engine - The turn runner.
 * @returns The panel.
 */
function DockedPanel({ assistant, engine }: { assistant: AssistantController; engine: AssistantEngine }) {
  const [storedWidth, setStoredWidth] = useLocalStorage<number>('qqq-assistant-width', PANEL_DEFAULT_WIDTH)
  const width = clampPanelWidth(storedWidth)
  const titleId = useId()
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const drag = useRef<{ x: number; width: number } | null>(null)

  useEffect(() => {
    composerRef.current?.focus()
  }, [])

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    if (!drag.current) return
    setStoredWidth(clampPanelWidth(drag.current.width + drag.current.x - event.clientX))
  }, [setStoredWidth])

  return (
    <aside
      className="relative flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-l border-border bg-card"
      style={{ width, maxWidth: `max(${PANEL_MIN_WIDTH}px, calc(100vw - ${PAGE_RESERVE}))` }}
      aria-labelledby={titleId}
      data-qqq-id="assistant-panel"
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || event.defaultPrevented) return
        if ((event.target as HTMLElement).closest('[role="menu"]')) return
        event.preventDefault()
        assistant.setOpen(false)
      }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize assistant panel"
        aria-valuemin={PANEL_MIN_WIDTH}
        aria-valuemax={PANEL_MAX_WIDTH}
        aria-valuenow={width}
        tabIndex={0}
        onPointerDown={(event) => {
          drag.current = { x: event.clientX, width }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={onPointerMove}
        onPointerUp={() => { drag.current = null }}
        onPointerCancel={() => { drag.current = null }}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 64 : 16
          if (event.key === 'ArrowLeft') setStoredWidth(clampPanelWidth(width + step))
          else if (event.key === 'ArrowRight') setStoredWidth(clampPanelWidth(width - step))
          else if (event.key === 'Home') setStoredWidth(PANEL_MIN_WIDTH)
          else if (event.key === 'End') setStoredWidth(PANEL_MAX_WIDTH)
          else return
          event.preventDefault()
        }}
        className="absolute inset-y-0 left-0 z-10 w-1.5 -translate-x-1/2 cursor-col-resize touch-none hover:bg-primary/30 focus:outline-none focus-visible:bg-primary/40"
        data-qqq-id="assistant-resize"
      />
      <PanelBody assistant={assistant} engine={engine} wide={width >= SIDE_BY_SIDE_MIN_WIDTH} titleId={titleId} composerRef={composerRef} />
    </aside>
  )
}

/**
 * The sheet below 1024 px: a modal dialog, full screen on phones and a side sheet on tablets.
 *
 * @param props - Component properties.
 * @param props.assistant - The controller.
 * @param props.engine - The turn runner.
 * @returns The dialog.
 */
function SheetPanel({ assistant, engine }: { assistant: AssistantController; engine: AssistantEngine }) {
  const titleId = useId()
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const viewport = useVisualViewport(assistant.open)
  return (
    <Dialog.Root open={assistant.open} onOpenChange={(next) => { if (!next) assistant.setOpen(false) }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[var(--qqq-z-modal,1000)] bg-black/40 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-labelledby={titleId}
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            composerRef.current?.focus({ preventScroll: true })
          }}
          // focus returns to the opener through the controller
          onCloseAutoFocus={(event) => event.preventDefault()}
          className="fixed inset-x-0 top-0 z-[var(--qqq-z-modal,1000)] flex h-dvh flex-col overflow-hidden bg-card shadow-lg focus:outline-none md:left-auto md:w-[min(30rem,100vw)] md:border-l md:border-border"
          style={viewport ? { top: viewport.top, height: viewport.height } : undefined}
          data-qqq-id="assistant-panel"
          data-variant="sheet"
        >
          <Dialog.Title className="sr-only">Assistant</Dialog.Title>
          <PanelBody assistant={assistant} engine={engine} wide={false} titleId={titleId} composerRef={composerRef} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/**
 * The assistant panel: docked on wide screens, a sheet below 1024 px. The turn runner lives
 * here, above both, so a reply keeps streaming while the panel is closed.
 *
 * @returns The panel, or null when closed on a wide screen.
 */
export default function AssistantPanel() {
  const assistant = useAssistant()
  const docked = useMediaQuery(ASSISTANT_DOCKED_MEDIA_QUERY)
  const engine = useAssistantEngine()
  if (!assistant) return null
  if (docked) return assistant.open ? <DockedPanel assistant={assistant} engine={engine} /> : null
  return <SheetPanel assistant={assistant} engine={engine} />
}
