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
import type { ClientErrorReport } from '@/lib/errors/client-errors'
import { getErrorStatusCode } from '@/lib/utils/error-utils'
import apiClient from './client'
import { isUiApiExtensionAtLeast, isUiApiExtensionInstalled, UI_API_EXTENSION } from './ui-api-extensions'

/**
 * Loads the assistant configuration, the feature probe for the whole UI. Like the ESB probe,
 * 403 and 404 mean the qbit is absent or not for this user, and a 2xx body that is not a
 * config (the root-SPA not-found page of a server without the route) means the same.
 *
 * @returns The configuration, or `null` when the assistant is not available.
 * @throws The request error for any other failure.
 */
export async function getAssistantConfig(): Promise<AssistantConfig | null> {
  if (!(await isUiApiExtensionInstalled(UI_API_EXTENSION.assistant))) return null
  let data: unknown
  try {
    data = await apiClient.get<unknown>('/assistant/config')
  } catch (error) {
    const status = getErrorStatusCode(error)
    if (status === 403 || status === 404) return null
    throw error
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  return typeof (data as { enabled?: unknown }).enabled === 'boolean' ? normalizeAttachmentSettings(data as AssistantConfig) : null
}

/**
 * Repairs the attachment fields of the config (`features.attachments`,
 * `limits.maxAttachmentBytes`, `limits.attachmentTypes`): a value of the wrong type is dropped,
 * so the panel falls back to the bulk-load attach behaviour of older servers.
 *
 * @param config - The config as received.
 * @returns The config with valid attachment fields only.
 */
export function normalizeAttachmentSettings(config: AssistantConfig): AssistantConfig {
  const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
  const features = isObject(config.features) ? { ...config.features } : undefined
  const limits = isObject(config.limits) ? { ...config.limits } : undefined
  if (features && typeof features.attachments !== 'boolean') delete features.attachments
  if (limits) {
    const max = limits.maxAttachmentBytes
    if (typeof max !== 'number' || !Number.isFinite(max) || max <= 0) delete limits.maxAttachmentBytes
    const types = limits.attachmentTypes
    if (Array.isArray(types)) {
      const names = types.filter((type): type is string => typeof type === 'string' && type.trim() !== '').map((type) => type.trim())
      if (names.length) limits.attachmentTypes = names
      else delete limits.attachmentTypes
    } else {
      delete limits.attachmentTypes
    }
  }
  return { ...config, features, limits }
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

/** The assistant extension version that added `POST /assistant/client-errors`. */
export const ASSISTANT_CLIENT_ERRORS_VERSION = '1.5.0'

/**
 * Whether the server takes client error reports (assistant extension 1.5.0 or later).
 *
 * @returns True when `POST /assistant/client-errors` exists.
 */
export function supportsAssistantClientErrors(): Promise<boolean> {
  return isUiApiExtensionAtLeast(UI_API_EXTENSION.assistant, ASSISTANT_CLIENT_ERRORS_VERSION)
}

/**
 * Sends one PII-safe client error report (`POST /assistant/client-errors`), so UI failures
 * show up in Admin.
 *
 * @param report - The report (see `lib/errors/client-errors`).
 * @returns Whether the server accepted it (false when rate limited).
 */
export async function reportAssistantClientError(report: ClientErrorReport): Promise<boolean> {
  const data = await apiClient.post<{ accepted?: boolean }>('/assistant/client-errors', report)
  return data?.accepted !== false
}
