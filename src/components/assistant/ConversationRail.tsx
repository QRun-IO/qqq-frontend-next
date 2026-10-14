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
 * @file ConversationRail — the panel's conversation list (pinned, recent, archived) as a
 * listbox: arrow keys move, Enter or Space opens, unread conversations show a dot.
 */

'use client'

import React, { useId, useRef } from 'react'
import { Pin } from 'lucide-react'

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

/**
 * The conversation list.
 *
 * @param props - Component properties.
 * @returns The rail.
 */
export function ConversationRail({ conversations, loading, activeId, status, onStatusChange, onSelect, className }: ConversationRailProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const labelId = useId()
  const list = conversations ?? []
  const pinned = list.filter((conversation) => conversation.pinned)
  const recent = list.filter((conversation) => !conversation.pinned)
  const ordered = [...pinned, ...recent]
  const focusIndex = Math.max(0, ordered.findIndex((conversation) => conversation.id === activeId))

  /**
   * Arrow-key navigation between options.
   *
   * @param event - The key event.
   */
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const options = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])
    const current = options.indexOf(document.activeElement as HTMLElement)
    let next = -1
    if (event.key === 'ArrowDown') next = Math.min(options.length - 1, current + 1)
    else if (event.key === 'ArrowUp') next = Math.max(0, current - 1)
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = options.length - 1
    else if ((event.key === 'Enter' || event.key === ' ') && current >= 0) {
      event.preventDefault()
      onSelect(Number(options[current].dataset.conversationId))
      return
    }
    if (next >= 0 && options[next]) {
      event.preventDefault()
      options.forEach((option, index) => option.setAttribute('tabindex', index === next ? '0' : '-1'))
      options[next].focus()
    }
  }

  /**
   * One option.
   *
   * @param conversation - The conversation.
   * @param index - Its position in keyboard order.
   * @returns The option.
   */
  const option = (conversation: AssistantConversation, index: number) => {
    const selected = conversation.id === activeId
    const unread = conversation.unreadCount > 0 && !selected
    return (
      <div
        key={conversation.id}
        role="option"
        aria-selected={selected}
        tabIndex={index === focusIndex ? 0 : -1}
        data-conversation-id={conversation.id}
        onClick={() => onSelect(conversation.id)}
        className={cn(
          'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11',
          selected ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-accent'
        )}
        data-qqq-id="assistant-conversation"
      >
        {conversation.pinned && <Pin className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />}
        <span className={cn('min-w-0 flex-1 truncate', unread && 'font-semibold')}>{conversationTitle(conversation)}</span>
        {unread && (
          <>
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" data-qqq-id="assistant-conversation-unread" />
            <span className="sr-only">, unread</span>
          </>
        )}
      </div>
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
      <span id={labelId} className="sr-only">{status === 'ACTIVE' ? 'Conversations' : 'Archived conversations'}</span>
      <div ref={listRef} role="listbox" aria-labelledby={labelId} onKeyDown={onKeyDown} className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1.5" data-qqq-id="assistant-conversation-list">
        {loading && <p className="px-2 py-1 text-xs text-muted-foreground" role="status">Loading...</p>}
        {!loading && ordered.length === 0 && (
          <p className="px-2 py-1 text-xs text-muted-foreground">{status === 'ACTIVE' ? 'No conversations yet.' : 'No archived conversations.'}</p>
        )}
        {pinned.length > 0 && (
          <div role="group" aria-label="Pinned">
            <p className="px-2 pb-0.5 pt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground" aria-hidden="true">Pinned</p>
            {pinned.map((conversation, index) => option(conversation, index))}
          </div>
        )}
        {recent.length > 0 && (
          <div role="group" aria-label={status === 'ACTIVE' ? 'Recent' : 'Archived'}>
            {pinned.length > 0 && <p className="px-2 pb-0.5 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground" aria-hidden="true">Recent</p>}
            {recent.map((conversation, index) => option(conversation, pinned.length + index))}
          </div>
        )}
      </div>
    </nav>
  )
}
