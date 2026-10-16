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
 * @file Row actions of the conversation rail (archive, restore, delete): the row leaves the lists
 * at once, the request follows, and a failure puts everything back with a toast.
 */

'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import type { AssistantConversation } from '@/types/assistant'
import { deleteAssistantConversation, updateAssistantConversation } from '@/lib/api/assistant'
import { getErrorMessage } from '@/lib/utils/error-utils'
import { assistantKeys } from './assistant-context'
import { conversationTitle } from './ConversationRail'

/** What {@link useRailActions} needs from the panel. */
interface RailActionsOptions {
  activeConversationId: number | null
  /**
   * Shows a conversation (null: the empty state).
   *
   * @param id - The conversation id.
   */
  setActiveConversationId: (id: number | null) => void
}

/**
 * Archive/restore and delete for rail rows, with optimistic updates and rollback.
 *
 * @param options - The active conversation and how to change it.
 * @returns The actions.
 */
export function useRailActions({ activeConversationId, setActiveConversationId }: RailActionsOptions) {
  const queryClient = useQueryClient()

  const run = useCallback(async (conversation: AssistantConversation, request: () => Promise<unknown>, failure: string) => {
    const listsKey = [...assistantKeys.all(), 'conversations']
    await queryClient.cancelQueries({ queryKey: listsKey })
    const snapshots = queryClient.getQueriesData<AssistantConversation[]>({ queryKey: listsKey })
    queryClient.setQueriesData<AssistantConversation[]>({ queryKey: listsKey }, (list) => list?.filter((item) => item.id !== conversation.id))
    const wasActive = activeConversationId === conversation.id
    if (wasActive) setActiveConversationId(null)
    try {
      await request()
      queryClient.removeQueries({ queryKey: assistantKeys.conversation(conversation.id) })
    } catch (error) {
      snapshots.forEach(([key, data]) => queryClient.setQueryData(key, data))
      if (wasActive) setActiveConversationId(conversation.id)
      toast.error(`${failure} "${conversationTitle(conversation)}": ${getErrorMessage(error, 'try again.')}`)
    } finally {
      void queryClient.invalidateQueries({ queryKey: listsKey })
    }
  }, [queryClient, activeConversationId, setActiveConversationId])

  /** Archives a conversation, or restores an archived one. */
  const archive = useCallback((conversation: AssistantConversation) => {
    const restoring = conversation.status === 'ARCHIVED'
    return run(conversation, () => updateAssistantConversation(conversation.id, { status: restoring ? 'ACTIVE' : 'ARCHIVED' }), restoring ? 'Could not restore' : 'Could not archive')
  }, [run])

  /** Deletes a conversation (the caller has confirmed). */
  const remove = useCallback((conversation: AssistantConversation) =>
    run(conversation, () => deleteAssistantConversation(conversation.id), 'Could not delete'), [run])

  return { archive, remove }
}
