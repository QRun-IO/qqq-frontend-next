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
 * @file Assistant context — the shell-level state of the assistant panel (feature probe,
 * open state, active conversation, unread count, hand-over requests), shared by the header
 * button, the command palette, the keyboard shortcut and the lazily loaded panel.
 */

'use client'

import { createContext, useContext, type RefObject } from 'react'

import type { QInstance } from '@/types'
import type { AssistantConfig, AssistantConversationStatus, AssistantPageContext } from '@/types/assistant'

/** The panel docks beside the page at this width and up; below it opens as a sheet. */
export const ASSISTANT_DOCKED_MEDIA_QUERY = '(min-width: 1024px)'

/** TanStack Query keys of the assistant. */
export const assistantKeys = {
  /**
   * Root of every assistant query.
   *
   * @returns The key.
   */
  all: () => ['qqq', 'assistant'] as const,
  /**
   * The feature probe.
   *
   * @returns The key.
   */
  config: () => [...assistantKeys.all(), 'config'] as const,
  /**
   * A conversation list.
   *
   * @param status - Active or archived conversations.
   * @returns The key.
   */
  conversations: (status: AssistantConversationStatus = 'ACTIVE') => [...assistantKeys.all(), 'conversations', status] as const,
  /**
   * One conversation and its messages.
   *
   * @param id - The conversation id.
   * @returns The key.
   */
  conversation: (id: number) => [...assistantKeys.all(), 'conversation', id] as const,
}

/**
 * A prompt handed to the panel in a new conversation: sent at once (command palette "Ask
 * Assistant") or only pre-filled in the composer (the `?assistant=open` deep link).
 */
export interface AssistantRequest {
  /** Distinguishes requests with the same text. */
  id: number
  prompt: string
  /** `send` asks right away; `prefill` puts the prompt in the composer for the user to send. */
  mode: 'send' | 'prefill'
  /** Page context for the request; `undefined` uses the current page. */
  context?: AssistantPageContext | null
}

/** The shell-level assistant state and actions. */
export interface AssistantController {
  /** The probe result; null while loading or when the qbit is absent. */
  config: AssistantConfig | null
  /** Whether the assistant is available: everything is hidden and inert otherwise. */
  enabled: boolean
  open: boolean
  /**
   * Opens or closes the panel; closing returns focus to where it was.
   *
   * @param open - The new state.
   */
  setOpen: (open: boolean) => void
  /** Opens a closed panel, closes an open one. */
  toggle: () => void
  activeConversationId: number | null
  /**
   * Shows a conversation (null: a new, empty one).
   *
   * @param id - The conversation id.
   */
  setActiveConversationId: (id: number | null) => void
  /** Unread replies across conversations, for the header badge. */
  unreadCount: number
  /**
   * Opens the panel on a new conversation and asks `prompt` (or only pre-fills it).
   *
   * @param prompt - The question.
   * @param options - The page context to send (defaults to the current page) and whether to send.
   * @param options.context - The context, or null for none.
   * @param options.mode - `send` (default) or `prefill`.
   */
  openWith: (prompt: string, options?: { context?: AssistantPageContext | null; mode?: 'send' | 'prefill' }) => void
  /** A hand-over the panel has not processed yet. */
  pendingRequest: AssistantRequest | null
  /**
   * Marks a hand-over as processed.
   *
   * @param id - The request id.
   */
  consumeRequest: (id: number) => void
  /** The header button, where focus returns when nothing else had it. */
  triggerRef: RefObject<HTMLButtonElement | null>
  /** Instance metadata, for record previews. */
  metaData?: QInstance
}

/** Context carrying the {@link AssistantController}; null outside the dashboard shell. */
export const AssistantContext = createContext<AssistantController | null>(null)

/**
 * Reads the assistant controller.
 *
 * @returns The controller, or null outside the dashboard shell.
 */
export function useAssistant(): AssistantController | null {
  return useContext(AssistantContext)
}
