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
 * @file Assistant probe — `GET /assistant/config` (whether the QQQ Assistant is available to
 * this user) and the conversation list behind the header badge. Kept apart from the streaming
 * client in `assistant.ts` so the dashboard shell stays small.
 */

import type { AssistantConfig, AssistantConversation, AssistantConversationStatus } from '@/types/assistant'
import { getErrorStatusCode } from '@/lib/utils/error-utils'
import apiClient from './client'

/**
 * Loads the assistant configuration, the feature probe for the whole UI. Like the ESB probe,
 * 403 and 404 mean the qbit is absent or not for this user, and a 2xx body that is not a
 * config (the root-SPA not-found page of a server without the route) means the same.
 *
 * @returns The configuration, or `null` when the assistant is not available.
 * @throws The request error for any other failure.
 */
export async function getAssistantConfig(): Promise<AssistantConfig | null> {
  let data: unknown
  try {
    data = await apiClient.get<unknown>('/assistant/config')
  } catch (error) {
    const status = getErrorStatusCode(error)
    if (status === 403 || status === 404) return null
    throw error
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  return typeof (data as { enabled?: unknown }).enabled === 'boolean' ? (data as AssistantConfig) : null
}

/**
 * Lists the user's own conversations, newest first.
 *
 * @param status - `ARCHIVED` for archived conversations; active ones by default.
 * @returns The conversations.
 */
export async function listAssistantConversations(status?: AssistantConversationStatus): Promise<AssistantConversation[]> {
  const data = await apiClient.get<{ conversations?: AssistantConversation[] }>(
    '/assistant/conversations',
    status ? { params: { status } } : undefined
  )
  return Array.isArray(data?.conversations) ? data.conversations : []
}
