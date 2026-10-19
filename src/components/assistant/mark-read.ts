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
 * @file Marking an assistant conversation read: the badge and rail drop its unread count at once
 * and the server is told (`PATCH {read:true}`), so a reply the user watched arrive never counts.
 */

import type { QueryClient } from '@tanstack/react-query'

import type { AssistantConversation } from '@/types/assistant'
import { updateAssistantConversation } from '@/lib/api/assistant'
import { assistantKeys } from './assistant-context'

/**
 * Marks a conversation read locally (every cached list) and on the server. A failed request is
 * not shown: the next refetch simply reports the server's count.
 *
 * @param queryClient - The query client.
 * @param id - The conversation id.
 */
export function markConversationRead(queryClient: QueryClient, id: number): void {
  queryClient.setQueriesData<AssistantConversation[]>({ queryKey: [...assistantKeys.all(), 'conversations'] }, (list) =>
    list?.map((item) => (item.id === id && item.unreadCount ? { ...item, unreadCount: 0 } : item)))
  updateAssistantConversation(id, { read: true })
    .catch(() => undefined)
    .finally(() => { void queryClient.invalidateQueries({ queryKey: [...assistantKeys.all(), 'conversations'] }) })
}
