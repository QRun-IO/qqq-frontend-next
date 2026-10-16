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
 * @file AssistantHeaderButton — the header's assistant toggle with its unread badge; renders
 * nothing when the assistant is unavailable.
 */

'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'

import { HEADER_BUTTON_CLASS } from '@/components/layout/HeaderMenu'
import { cn } from '@/lib/utils/cn'
import { assistantKeys, useAssistant } from './assistant-context'

/**
 * Toggles the assistant panel ("Ask"); the badge counts unread replies. The sparkles icon alone is
 * ambiguous, so from 1440 px it carries the text label "Ask" (its tooltip says so below that).
 *
 * @returns The button, or null when the assistant is unavailable.
 */
export function AssistantHeaderButton() {
  const assistant = useAssistant()
  const { data: busy = false } = useQuery({ queryKey: assistantKeys.busy(), queryFn: () => false, enabled: false })
  if (!assistant?.enabled) return null
  const { open, unreadCount, toggle, triggerRef } = assistant
  const label = unreadCount > 0 ? `Ask the assistant, ${unreadCount} unread (Ctrl+J or ⌘J)` : 'Ask the assistant (Ctrl+J or ⌘J)'
  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={(event) => {
        // WebKit can activate a button without focusing it; focus returns here on close
        event.currentTarget.focus({ preventScroll: true })
        toggle()
      }}
      className={cn(HEADER_BUTTON_CLASS, 'gap-1.5')}
      aria-label={label}
      title="Ask the assistant (Ctrl+J or ⌘J)"
      aria-pressed={open}
      data-qqq-id="button-assistant"
    >
      <Sparkles className="h-5 w-5" aria-hidden="true" />
      <span className="hidden text-sm font-medium min-[1440px]:inline" aria-hidden="true">Ask</span>
      {busy && <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-primary motion-safe:animate-pulse" role="status" aria-label="Assistant is answering" data-qqq-id="assistant-busy" />}
      {unreadCount > 0 && (
        <span
          className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
          aria-hidden="true"
          data-qqq-id="assistant-unread-badge"
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  )
}
