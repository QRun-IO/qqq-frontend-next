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
 * @file AssistantComposer — the message box: the dismissible page-context chip, a growing
 * textarea (Enter sends, Shift+Enter adds a line), and Send or Stop.
 */

'use client'

import React, { forwardRef, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { FileText, Loader2, MapPin, Paperclip, SendHorizontal, Square, X } from 'lucide-react'

import type { AssistantAttachment } from '@/types/assistant'
import type { AssistantPageInfo } from '@/lib/utils/assistant-links'

/** Props of {@link AssistantComposer}. */
interface AssistantComposerProps {
  /** The current page as context, or null. */
  pageInfo: AssistantPageInfo | null
  /** Whether the user removed the context for this page. */
  contextDismissed: boolean
  /** Removes the page context. */
  onDismissContext: () => void
  /** Re-reads the page context (the filter can change without a navigation). */
  onRefreshContext: () => void
  /** Whether a reply is streaming in this conversation. */
  streaming: boolean
  /** Whether a stop was requested. */
  stopping: boolean
  /**
   * Sends the text.
   *
   * @param text - The message.
   */
  onSend: (text: string) => void
  /** Stops the reply. */
  onStop: () => void
  /** Text to put in the box (not sent); a new `id` replaces the current text. */
  prefill?: { id: number; text: string } | null
  /** Files attached to this conversation (sent with each message). */
  attachments?: AssistantAttachment[]
  /**
   * Uploads and attaches a file; when absent, the attach button is not shown.
   *
   * @param file - The picked file.
   */
  onAttach?: (file: File) => void
  /**
   * Removes an attachment.
   *
   * @param uploadRef - Its upload ref.
   */
  onRemoveAttachment?: (uploadRef: string) => void
  /** Whether an upload is in progress. */
  attaching?: boolean
}

/** File types the attach button offers (bulk load files). */
const ATTACH_ACCEPT = '.csv,.tsv,.txt,.xlsx'

/** Tallest the textarea grows before it scrolls, in pixels. */
const MAX_TEXTAREA_HEIGHT = 160

/**
 * The composer.
 *
 * @param props - Component properties.
 * @param ref - The textarea, focused when the panel opens.
 * @returns The composer form.
 */
function AssistantComposerInner(
  { pageInfo, contextDismissed, onDismissContext, onRefreshContext, streaming, stopping, onSend, onStop, prefill, attachments = [], onAttach, onRemoveAttachment, attaching = false }: AssistantComposerProps,
  ref: React.ForwardedRef<HTMLTextAreaElement>
) {
  const [text, setText] = useState('')
  const inputId = useId()
  const hintId = useId()
  const localRef = useRef<HTMLTextAreaElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  // A deep link pre-fills the box; the user reviews and sends it
  useEffect(() => {
    if (!prefill) return
    setText(prefill.text)
    const element = localRef.current
    if (element) {
      element.focus()
      element.setSelectionRange(prefill.text.length, prefill.text.length)
    }
  }, [prefill])

  // Grow with the text up to MAX_TEXTAREA_HEIGHT
  useLayoutEffect(() => {
    const element = localRef.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
  }, [text])

  /** Sends the text unless empty or a reply is streaming. */
  const submit = () => {
    if (!text.trim() || streaming) return
    onSend(text)
    setText('')
  }

  const showContext = pageInfo && !contextDismissed
  return (
    <form
      className="shrink-0 border-t border-border bg-card px-3 pb-3 pt-2"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      data-qqq-id="assistant-composer-form"
    >
      {showContext && (
        <div className="mb-2 flex min-w-0">
          <span className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-border bg-muted py-0.5 pl-2 pr-0.5 text-xs text-muted-foreground" data-qqq-id="assistant-context-chip">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">On: {pageInfo.label}</span>
            <button
              type="button"
              onClick={onDismissContext}
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:h-8 pointer-coarse:w-8"
              aria-label={`Don't send page context (${pageInfo.label})`}
              data-qqq-id="assistant-context-dismiss"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        </div>
      )}
      {(attachments.length > 0 || attaching) && (
        <ul className="mb-2 flex min-w-0 flex-wrap gap-1.5" aria-label="Attached files" data-qqq-id="assistant-attachments">
          {attachments.map((attachment) => (
            <li key={attachment.uploadRef} className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-border bg-muted py-0.5 pl-2 pr-0.5 text-xs text-muted-foreground" data-qqq-id="assistant-attachment-chip">
              <FileText className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{attachment.fileName ?? 'Attached file'}</span>
              {onRemoveAttachment && (
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(attachment.uploadRef)}
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:h-8 pointer-coarse:w-8"
                  aria-label={`Remove ${attachment.fileName ?? 'the attached file'}`}
                  data-qqq-id="assistant-attachment-remove"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
          {attaching && (
            <li className="inline-flex items-center gap-1 rounded-full border border-border py-0.5 pl-2 pr-2 text-xs text-muted-foreground" role="status" data-qqq-id="assistant-attaching">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              Uploading...
            </li>
          )}
        </ul>
      )}
      <div className="flex items-end gap-2 rounded-lg border border-input bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring">
        {onAttach && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept={ATTACH_ACCEPT}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) onAttach(file)
              }}
              data-qqq-id="assistant-attach-input"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={attaching}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 pointer-coarse:h-11 pointer-coarse:w-11"
              aria-label="Attach a file"
              title="Attach a file (CSV or Excel) for a bulk load"
              data-qqq-id="assistant-attach"
            >
              <Paperclip className="h-4 w-4" aria-hidden="true" />
            </button>
          </>
        )}
        <label htmlFor={inputId} className="sr-only">Message the assistant</label>
        <textarea
          id={inputId}
          ref={(element) => {
            localRef.current = element
            if (typeof ref === 'function') ref(element)
            else if (ref) ref.current = element
          }}
          rows={1}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onFocus={onRefreshContext}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              submit()
            }
          }}
          placeholder="Ask about your data..."
          aria-describedby={hintId}
          className="max-h-40 min-h-6 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent py-1 text-base text-foreground placeholder:text-muted-foreground focus:outline-none md:text-sm"
          data-qqq-id="assistant-composer"
        />
        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            disabled={stopping}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 pointer-coarse:h-11 pointer-coarse:w-11"
            aria-label={stopping ? 'Stopping' : 'Stop the reply'}
            data-qqq-id="assistant-stop"
          >
            <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!text.trim()}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 pointer-coarse:h-11 pointer-coarse:w-11"
            aria-label="Send"
            data-qqq-id="assistant-send"
          >
            <SendHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <p id={hintId} className="mt-1 hidden text-[11px] text-muted-foreground pointer-fine:block">Enter to send, Shift+Enter for a new line</p>
    </form>
  )
}

/** The assistant composer; its ref is the textarea. */
export const AssistantComposer = forwardRef(AssistantComposerInner)
