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
import { Sparkles } from 'lucide-react'

import { useAssistant } from './assistant-context'

/**
 * Toggles the assistant panel; the badge counts unread replies.
 *
 * @returns The button, or null when the assistant is unavailable.
 */
export function AssistantHeaderButton() {
  const assistant = useAssistant()
  if (!assistant?.enabled) return null
  const { open, unreadCount, toggle, triggerRef } = assistant
  const label = unreadCount > 0 ? `Assistant, ${unreadCount} unread (Ctrl+J or ⌘J)` : 'Assistant (Ctrl+J or ⌘J)'
  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={(event) => {
        // WebKit can activate a button without focusing it; focus returns here on close
        event.currentTarget.focus({ preventScroll: true })
        toggle()
      }}
      className="relative flex items-center justify-center rounded-lg p-2 hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={label}
      aria-pressed={open}
      data-qqq-id="button-assistant"
    >
      <Sparkles className="h-5 w-5 text-foreground/60" aria-hidden="true" />
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
