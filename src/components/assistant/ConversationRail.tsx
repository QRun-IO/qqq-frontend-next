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
 * @file ConversationRail — the panel's conversation list (pinned, recent, archived). A list of
 * rows, each a main button that opens the conversation plus Archive/Restore and Delete buttons.
 * (A listbox cannot hold buttons, so the rows are plain buttons with arrow-key navigation:
 * Up/Down/Home/End move between rows, Right reaches a row's actions, Left returns.) Running
 * conversations show a spinner, unread ones a dot and a bold title.
 */

'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { Archive, ArchiveRestore, ExternalLink, Loader2, Pin, Trash2 } from 'lucide-react'

import type { AssistantConversation, AssistantConversationStatus } from '@/types/assistant'
import { cn } from '@/lib/utils/cn'

/** Props of {@link ConversationRail}. */
interface ConversationRailProps {
  conversations: AssistantConversation[] | undefined
  loading: boolean
  activeId: number | null
  /** Which list is shown. */
  status: AssistantConversationStatus
  /**
   * Switches between active and archived conversations.
   *
   * @param status - The list to show.
   */
  onStatusChange: (status: AssistantConversationStatus) => void
  /**
   * Opens a conversation.
   *
   * @param id - The conversation id.
   */
  onSelect: (id: number) => void
  /**
   * Archives a conversation (or restores it, in the archived list).
   *
   * @param conversation - The conversation.
   */
  onArchive: (conversation: AssistantConversation) => void
  /**
   * Asks to delete a conversation (the panel confirms first).
   *
   * @param conversation - The conversation.
   */
  onDelete: (conversation: AssistantConversation) => void
  /** Path of the standard table screen listing all conversations; the link is hidden without it. */
  manageHref?: string | null
  /** Called when the manage link is followed. */
  onManage?: () => void
  className?: string
}

/**
 * A conversation's display title.
 *
 * @param conversation - The conversation.
 * @returns Its title, or a placeholder for an untitled one.
 */
export function conversationTitle(conversation: AssistantConversation | undefined | null): string {
  return conversation?.title?.trim() || 'New conversation'
}

/** Classes of a row's small icon buttons. */
const ACTION_BUTTON = 'inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:h-11 pointer-coarse:w-11'

/**
 * The conversation list.
 *
 * @param props - Component properties.
 * @returns The rail.
 */
export function ConversationRail({ conversations, loading, activeId, status, onStatusChange, onSelect, onArchive, onDelete, manageHref, onManage, className }: ConversationRailProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const labelId = useId()
  const list = conversations ?? []
  const pinned = list.filter((conversation) => conversation.pinned)
  const recent = list.filter((conversation) => !conversation.pinned)
  const ordered = [...pinned, ...recent]
  const [focusedId, setFocusedId] = useState<number | null>(null)
  const tabId = [focusedId, activeId].find((id) => id !== null && ordered.some((conversation) => conversation.id === id)) ?? ordered[0]?.id
  const lastIndex = useRef(0)
  lastIndex.current = Math.max(0, ordered.findIndex((conversation) => conversation.id === focusedId))

  // A row that disappears under the keyboard (archived, deleted) hands focus to its neighbour
  const count = ordered.length
  const previousCount = useRef(count)
  useEffect(() => {
    const shrank = count < previousCount.current
    previousCount.current = count
    if (!shrank || count === 0) return
    const active = document.activeElement
    if (active && active !== document.body && active.isConnected) return
    const mains = listRef.current?.querySelectorAll<HTMLElement>('[data-conversation-main]')
    mains?.[Math.min(lastIndex.current, count - 1)]?.focus()
  }, [count])

  /**
   * Arrow-key navigation between rows and from a row to its actions.
   *
   * @param event - The key event.
   */
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    const rowElement = target.closest<HTMLElement>('[data-conversation-row]')
    if (!rowElement) return
    const mains = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-conversation-main]') ?? [])
    const actions = Array.from(rowElement.querySelectorAll<HTMLElement>('[data-conversation-action]'))
    const onMain = target.hasAttribute('data-conversation-main')
    const main = rowElement.querySelector<HTMLElement>('[data-conversation-main]') as HTMLElement
    const current = mains.indexOf(main)
    let next: HTMLElement | undefined
    if (event.key === 'ArrowDown') next = mains[Math.min(mains.length - 1, current + 1)]
    else if (event.key === 'ArrowUp') next = mains[Math.max(0, current - 1)]
    else if (event.key === 'Home') next = mains[0]
    else if (event.key === 'End') next = mains[mains.length - 1]
    else if (event.key === 'ArrowRight') next = onMain ? actions[0] : actions[actions.indexOf(target) + 1]
    else if (event.key === 'ArrowLeft' && !onMain) next = actions[actions.indexOf(target) - 1] ?? main
    if (next) {
      event.preventDefault()
      next.focus()
    }
  }

  /**
   * One row.
   *
   * @param conversation - The conversation.
   * @returns The row.
   */
  const row = (conversation: AssistantConversation) => {
    const selected = conversation.id === activeId
    const unread = conversation.unreadCount > 0 && !selected
    const running = conversation.running === true
    const title = conversationTitle(conversation)
    const tabIndex = conversation.id === tabId ? 0 : -1
    const archived = conversation.status === 'ARCHIVED'
    return (
      <li
        key={conversation.id}
        data-conversation-row
        data-conversation-id={conversation.id}
        onFocus={() => setFocusedId(conversation.id)}
        className={cn('group relative flex items-center rounded-md', selected ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-accent')}
      >
        <button
          type="button"
          data-conversation-main
          aria-current={selected ? 'true' : undefined}
          tabIndex={tabIndex}
          onClick={() => onSelect(conversation.id)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
          data-qqq-id="assistant-conversation"
        >
          <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
            {running ? (
              <>
                <Loader2 className="h-3.5 w-3.5 text-primary motion-safe:animate-spin" aria-hidden="true" data-qqq-id="assistant-conversation-running" />
                <span className="sr-only">Working: </span>
              </>
            ) : null}
            {!running && unread ? <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" data-qqq-id="assistant-conversation-unread" /> : null}
          </span>
          {conversation.pinned && <Pin className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />}
          <span className={cn('min-w-0 flex-1 truncate', unread && 'font-semibold')}>
            {title}
            {unread && <span className="sr-only">, unread</span>}
          </span>
          {running && unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" data-qqq-id="assistant-conversation-unread" />}
        </button>
        <div
          className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded-md bg-sidebar opacity-0 shadow-sm focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:static pointer-coarse:translate-y-0 pointer-coarse:bg-transparent pointer-coarse:opacity-100 pointer-coarse:shadow-none"
          data-qqq-id="assistant-conversation-actions"
        >
          <button
            type="button"
            data-conversation-action
            tabIndex={tabIndex}
            aria-label={`${archived ? 'Restore' : 'Archive'} ${title}`}
            title={archived ? 'Restore' : 'Archive'}
            onClick={() => onArchive(conversation)}
            className={ACTION_BUTTON}
            data-qqq-id="assistant-conversation-archive"
          >
            {archived ? <ArchiveRestore className="h-3.5 w-3.5" aria-hidden="true" /> : <Archive className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>
          <button
            type="button"
            data-conversation-action
            tabIndex={tabIndex}
            aria-label={`Delete ${title}`}
            title="Delete"
            onClick={() => onDelete(conversation)}
            className={cn(ACTION_BUTTON, 'hover:text-destructive')}
            data-qqq-id="assistant-conversation-delete"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </li>
    )
  }

  return (
    <nav className={cn('flex min-h-0 flex-col bg-sidebar', className)} aria-label="Conversations" data-qqq-id="assistant-rail">
      <div className="flex shrink-0 gap-1 border-b border-border p-1.5" role="group" aria-label="Show">
        {(['ACTIVE', 'ARCHIVED'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={status === value}
            onClick={() => onStatusChange(value)}
            className="flex-1 rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-background aria-pressed:text-foreground pointer-coarse:min-h-11"
          >
            {value === 'ACTIVE' ? 'Recent' : 'Archived'}
          </button>
        ))}
      </div>
      <div ref={listRef} onKeyDown={onKeyDown} className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1.5" data-qqq-id="assistant-conversation-list">
        {loading && <p className="px-2 py-1 text-xs text-muted-foreground" role="status">Loading...</p>}
        {!loading && ordered.length === 0 && (
          <p className="px-2 py-1 text-xs text-muted-foreground">{status === 'ACTIVE' ? 'No conversations yet.' : 'No archived conversations.'}</p>
        )}
        {pinned.length > 0 && (
          <section aria-labelledby={`${labelId}-pinned`}>
            <h3 id={`${labelId}-pinned`} className="px-2 pb-0.5 pt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Pinned</h3>
            <ul className="space-y-0.5">{pinned.map(row)}</ul>
          </section>
        )}
        {recent.length > 0 && (
          <section aria-labelledby={`${labelId}-recent`}>
            <h3 id={`${labelId}-recent`} className={cn('px-2 pb-0.5 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground', pinned.length === 0 && 'sr-only')}>
              {status === 'ACTIVE' ? 'Recent' : 'Archived'}
            </h3>
            <ul className="space-y-0.5">{recent.map(row)}</ul>
          </section>
        )}
      </div>
      {manageHref && (
        <Link
          href={manageHref}
          onClick={onManage}
          className="flex shrink-0 items-center gap-1.5 border-t border-border px-3 py-2 text-xs font-medium text-primary hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
          data-qqq-id="assistant-manage-conversations"
        >
          Manage all conversations
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </Link>
      )}
    </nav>
  )
}
