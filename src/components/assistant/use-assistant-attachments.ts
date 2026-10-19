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
 * @file useAssistantAttachments — the panel's attached files: checks a picked file (count, size),
 * uploads it as the user (POST /uploads) and keeps its ref. Every failure is a soft, inline
 * message in the composer; nothing here throws into the panel.
 */

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { AssistantAttachment, AssistantConfig } from '@/types/assistant'
import { uploadFile } from '@/lib/api/uploads'
import { attachmentPolicy, checkAttachment, type AttachmentPolicy } from '@/lib/utils/assistant-attachments'
import { getErrorMessage } from '@/lib/utils/error-utils'
import { reportClientError } from '@/lib/errors/client-errors'

/** What the composer needs to offer attaching. */
export interface AssistantAttachments {
  policy: AttachmentPolicy
  attachments: AssistantAttachment[]
  attaching: boolean
  /** The last problem, shown inline until dismissed or the next attach. */
  error: string | null
  /**
   * Checks and uploads a file.
   *
   * @param file - The picked file.
   */
  attach: (file: File) => Promise<void>
  /**
   * Removes an attachment.
   *
   * @param uploadRef - Its ref.
   */
  remove: (uploadRef: string) => void
  /** Clears files and invalidates uploads when explicitly opening another conversation. */
  clear: () => void
  /** Clears the inline problem. */
  dismissError: () => void
  /**
   * The attachments as a turn sends them: refs and names only.
   *
   * @returns The list, or undefined when nothing is attached.
   */
  forTurn: () => AssistantAttachment[] | undefined
}

/**
 * Tracks the files attached in the panel.
 *
 * @param config - The assistant config (attachment feature and limits).
 * @param bulkLoadAvailable - Whether saved bulk load profiles exist (the fallback gate).
 * @param conversationId - The open conversation: attachments belong to it.
 * @returns The attachments and actions.
 */
export function useAssistantAttachments(config: AssistantConfig | null | undefined, bulkLoadAvailable: boolean, conversationId: number | null): AssistantAttachments {
  const policy = useMemo(() => attachmentPolicy(config, bulkLoadAvailable), [config, bulkLoadAvailable])
  const [attachments, setAttachments] = useState<AssistantAttachment[]>([])
  const [attaching, setAttaching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const previous = useRef(conversationId)
  const generation = useRef(0)
  const pending = useRef(false)
  const count = useRef(0)
  count.current = attachments.length

  const clear = useCallback(() => {
    generation.current++
    pending.current = false
    count.current = 0
    setAttachments([])
    setAttaching(false)
    setError(null)
  }, [])

  useEffect(() => () => { generation.current++ }, [])

  // Attachments belong to one conversation. The first message of a new conversation creates
  // it (null -> id): the files stay attached for its next messages.
  useEffect(() => {
    const before = previous.current
    previous.current = conversationId
    if (before === conversationId || (before === null && conversationId !== null)) return
    clear()
  }, [conversationId, clear])

  const attach = useCallback(async (file: File) => {
    if (pending.current) {
      setError('Wait for the current upload to finish before attaching another file.')
      return
    }
    const problem = checkAttachment(file, policy, count.current)
    if (problem) {
      setError(problem)
      return
    }
    const startedIn = generation.current
    pending.current = true
    setError(null)
    setAttaching(true)
    try {
      const uploaded = await uploadFile(file)
      if (startedIn !== generation.current) return
      count.current++
      setAttachments((current) => [
        ...current.filter((item) => item.uploadRef !== uploaded.ref),
        {
          uploadRef: uploaded.ref,
          fileName: typeof uploaded.fileName === 'string' && uploaded.fileName ? uploaded.fileName : file.name,
          sizeBytes: typeof uploaded.sizeBytes === 'number' ? uploaded.sizeBytes : file.size,
          contentType: typeof uploaded.contentType === 'string' && uploaded.contentType ? uploaded.contentType : file.type,
        },
      ])
    } catch (failure) {
      if (startedIn !== generation.current) return
      // the report carries the error only: never the file or its name
      reportClientError(failure, { scope: 'assistant-upload' })
      setError(`Could not attach ${file.name}: ${getErrorMessage(failure, 'the upload failed.')}`)
    } finally {
      if (startedIn === generation.current) {
        pending.current = false
        setAttaching(false)
      }
    }
  }, [policy])

  const remove = useCallback((uploadRef: string) => {
    setAttachments((current) => current.filter((item) => item.uploadRef !== uploadRef))
    setError(null)
  }, [])

  const dismissError = useCallback(() => setError(null), [])

  const forTurn = useCallback(() => (attachments.length
    ? attachments.map(({ uploadRef, fileName }) => (fileName ? { uploadRef, fileName } : { uploadRef }))
    : undefined), [attachments])

  return { policy, attachments, attaching, error, attach, remove, clear, dismissError, forTurn }
}
