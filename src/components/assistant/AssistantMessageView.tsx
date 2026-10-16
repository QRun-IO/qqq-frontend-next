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
 * @file AssistantMessageView — one message of a conversation. Assistant messages render
 * their parts through {@link PART_RENDERERS}, so later part types (approval cards) slot in
 * by adding an entry; unknown part types are skipped.
 */

'use client'

import React, { useId, useState } from 'react'
import { AlertTriangle, Check, ChevronRight, CircleX, Info, Loader2, Navigation, RefreshCw, Square, ThumbsDown, ThumbsUp } from 'lucide-react'

import type {
  AssistantMessage,
  AssistantNavigatePart,
  AssistantNoticePart,
  AssistantPart,
  AssistantRecordRefsPart,
  AssistantTextPart,
  AssistantToolOutcome,
  AssistantToolPart,
  AssistantUnknownPart,
} from '@/types/assistant'
import { sendAssistantFeedback } from '@/lib/api/assistant'
import { internalAppHref } from '@/lib/utils/assistant-links'
import { cn } from '@/lib/utils/cn'
import { AssistantRunStatus } from './AssistantRunStatus'
import type { AssistantRun } from './use-assistant-engine'
import { AssistantMarkdown } from './AssistantMarkdown'
import { AssistantPresentation, type AssistantPresentationActions } from './AssistantPresentation'
import { AssistantRenderView, RawJsonView, RecordChips } from './AssistantRenders'
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary'
import { InlineFailure } from '@/components/feedback/InlineFailure'
import Link from 'next/link'

/** Plain-language outcome of a tool call. */
const INLINE_ACTION = 'inline-flex items-center gap-1 rounded px-1 text-xs font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 pointer-coarse:min-h-11'

const OUTCOME_LABEL: Record<AssistantToolOutcome, string> = {
  OK: 'Done',
  DENIED: 'Not permitted',
  NOT_FOUND: 'Not found',
  INVALID_INPUT: 'Invalid request',
  TRUNCATED: 'Partial result',
  ERROR: 'Failed',
}

/**
 * A tool call as a compact, expandable step, followed by its structured result.
 *
 * @param props - Component properties.
 * @param props.part - The tool part.
 * @param props.finished - Whether the answer has ended, even if no tool result arrived.
 * @returns The step.
 */
function ToolStep({ part, finished = false }: { part: AssistantToolPart; finished?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const detailsId = useId()
  const running = !part.outcome && !finished
  const outcome = part.outcome ? OUTCOME_LABEL[part.outcome] ?? part.outcome : 'Not completed'
  const ok = part.outcome === 'OK' || part.outcome === 'TRUNCATED'
  return (
    <div className="space-y-1.5" data-qqq-id="assistant-tool-step" data-outcome={part.outcome ?? (finished ? 'INCOMPLETE' : 'RUNNING')}>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls={detailsId}
        className="flex max-w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
      >
        {running ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 motion-safe:animate-spin" aria-hidden="true" />
        ) : ok ? (
          <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden="true" />
        )}
        <span className="min-w-0 truncate">{part.summary || part.name}</span>
        <span className="sr-only">{running ? ', running' : `, ${outcome}`}</span>
        <ChevronRight className={cn('h-3 w-3 shrink-0 motion-safe:transition-transform', expanded && 'rotate-90')} aria-hidden="true" />
      </button>
      <dl id={detailsId} hidden={!expanded} className="ml-5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 text-xs text-muted-foreground">
        <dt>Tool</dt>
        <dd className="break-all font-mono">{part.name}</dd>
        <dt>Result</dt>
        <dd>{running ? 'Running' : outcome}</dd>
      </dl>
      {part.render && (
        <ErrorBoundary
          scope="assistant-render"
          reportContext={{ renderType: part.render.type === 'unknown' ? part.render.originalType : part.render.type }}
          resetKeys={[part.render]}
          fallbackRender={({ report, error, reset }) => <InlineFailure message="This result couldn't be displayed." report={report} error={error} onRetry={reset} qqqId="assistant-render-error" />}
        >
          <AssistantRenderView render={part.render} />
        </ErrorBoundary>
      )}
    </div>
  )
}

/**
 * A notice inside a reply.
 *
 * @param props - Component properties.
 * @param props.part - The notice part.
 * @returns The notice.
 */
function NoticeView({ part }: { part: AssistantNoticePart }) {
  const Icon = part.level === 'error' ? CircleX : part.level === 'warning' ? AlertTriangle : Info
  return (
    <p
      className={cn(
        'flex items-start gap-1.5 rounded-md border px-2 py-1.5 text-xs',
        part.level === 'error' ? 'border-destructive/40 text-destructive' : 'border-border text-muted-foreground'
      )}
      role={part.level === 'error' ? 'alert' : undefined}
      data-qqq-id="assistant-notice"
      data-level={part.level}
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 break-words">{part.text}</span>
    </p>
  )
}

/**
 * Where the assistant took the user.
 *
 * @param props - Component properties.
 * @param props.part - The navigate part.
 * @returns A link back to that page.
 */
function NavigateView({ part }: { part: AssistantNavigatePart }) {
  const href = internalAppHref(part.href)
  if (!href) return null
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground" data-qqq-id="assistant-navigate">
      <Navigation className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>Opened</span>
      <Link href={href} className="min-w-0 truncate font-medium text-primary hover:underline">{href}</Link>
    </p>
  )
}

/** Renders one part type. */
type PartRenderer<T extends AssistantPart> = (props: { part: T; finished?: boolean } & AssistantPresentationActions) => React.ReactNode

/**
 * Renderers by part type. Phase 2 adds `approval` here; anything without a renderer is skipped.
 */
export const PART_RENDERERS: { [K in AssistantPart['type']]: PartRenderer<Extract<AssistantPart, { type: K }>> } = {
  presentation: ({ part, onSend, sending }) => <AssistantPresentation part={part} onSend={onSend} sending={sending} />,
  text: ({ part }: { part: AssistantTextPart }) => (part.text ? <AssistantMarkdown text={part.text} /> : null),
  tool: ({ part, finished }) => <ToolStep part={part} finished={finished} />,
  record_refs: ({ part }: { part: AssistantRecordRefsPart }) => <RecordChips refs={part.refs} />,
  navigate: ({ part }: { part: AssistantNavigatePart }) => <NavigateView part={part} />,
  notice: ({ part }: { part: AssistantNoticePart }) => <NoticeView part={part} />,
  unknown: ({ part }: { part: AssistantUnknownPart }) => <RawJsonView label={part.originalType ? `Unsupported content (${part.originalType})` : 'Unsupported content'} value={part.raw} />,
}

/**
 * Renders a part through {@link PART_RENDERERS}.
 *
 * @param props - Component properties.
 * @param props.part - Any part, including types this version does not know.
 * @param props.messageId - The message's id, for the failure report.
 * @returns The rendered part, or null.
 */
function PartView({ part, onSend, sending, finished, messageId }: { part: AssistantPart; finished?: boolean; messageId?: number } & AssistantPresentationActions) {
  const render = (PART_RENDERERS as Record<string, PartRenderer<AssistantPart> | undefined>)[part.type]
  if (!render) return null
  // One part that fails to render (for example, a malformed tool payload) must
  // not take down the reply - or the page - around it. A new payload (streaming) renders again.
  return (
    <ErrorBoundary
      scope="assistant-part"
      reportContext={{ messageId, partType: part.type }}
      resetKeys={[part]}
      fallbackRender={({ report, error }) => <InlineFailure message="This part couldn't be displayed." report={report} error={error} qqqId="assistant-part-error" />}
    >
      {render({ part, onSend, sending, finished })}
    </ErrorBoundary>
  )
}

/**
 * Thumbs up or down on a finished reply; thumbs down asks for an optional comment.
 *
 * @param props - Component properties.
 * @param props.messageId - The assistant message id.
 * @returns The feedback controls.
 */
function FeedbackButtons({ messageId }: { messageId: number }) {
  const [rating, setRating] = useState<1 | -1 | null>(null)
  const [asking, setAsking] = useState(false)
  const [comment, setComment] = useState('')
  const [sent, setSent] = useState(false)
  const commentId = useId()

  /**
   * Sends the rating.
   *
   * @param value - Up or down.
   * @param text - Optional comment.
   */
  const send = (value: 1 | -1, text?: string) => {
    setRating(value)
    setSent(true)
    sendAssistantFeedback(messageId, text ? { rating: value, comment: text } : { rating: value }).catch(() => setSent(false))
  }

  const buttonClass = 'inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:h-11 pointer-coarse:w-11 aria-pressed:text-primary'
  return (
    <div className="space-y-1" data-qqq-id="assistant-feedback">
      <div className="flex items-center gap-0.5">
        <button type="button" className={buttonClass} aria-label="Good response" aria-pressed={rating === 1} disabled={sent && rating === 1} onClick={() => { setAsking(false); send(1) }} data-qqq-id="assistant-feedback-up">
          <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button type="button" className={buttonClass} aria-label="Bad response" aria-pressed={rating === -1} disabled={sent && rating === -1} onClick={() => { setRating(-1); setAsking(true) }} data-qqq-id="assistant-feedback-down">
          <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        {sent && <span className="text-xs text-muted-foreground" role="status">Thanks for the feedback.</span>}
      </div>
      {asking && !sent && (
        <form
          className="flex items-center gap-1"
          onSubmit={(event) => {
            event.preventDefault()
            setAsking(false)
            send(-1, comment.trim() || undefined)
          }}
        >
          <label htmlFor={commentId} className="sr-only">What went wrong? (optional)</label>
          <input
            id={commentId}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="What went wrong? (optional)"
            className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            autoFocus
          />
          <button type="submit" className="h-8 rounded-md border border-border px-2 text-xs font-medium hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">Send</button>
        </form>
      )}
    </div>
  )
}

/**
 * One message.
 *
 * @param props - Component properties.
 * @param props.message - The message.
 * @param props.onRetry - Asks the question again (offered when the reply failed).
 * @param props.onStop - Stops the reply (offered while it is running, and for a reply left running).
 * @returns The message article.
 */
export function AssistantMessageView({ message, onSend, sending, run, onRetry, onStop }: { message: AssistantMessage; run?: AssistantRun; onRetry?: () => void; onStop?: () => void } & AssistantPresentationActions) {
  if (message.role === 'USER') {
    const text = message.parts.map((part) => (part.type === 'text' ? part.text : '')).join('')
    return (
      <article className="flex justify-end" aria-label="You" data-qqq-id="assistant-message" data-role="user">
        <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-muted px-3 py-2 text-sm text-foreground">{text}</p>
      </article>
    )
  }
  if (message.role === 'SYSTEM_NOTICE') {
    return (
      <article className="space-y-1" aria-label="Notice" data-qqq-id="assistant-message" data-role="notice">
        {message.parts.map((part, index) => <PartView key={index} part={part} messageId={message.id} />)}
      </article>
    )
  }
  const streaming = message.status === 'STREAMING'
  return (
    <article className="min-w-0 space-y-2" aria-label="Assistant" data-qqq-id="assistant-message" data-role="assistant" data-status={message.status}>
      {message.parts.length > 0 && (
        <div className="space-y-2" aria-busy={streaming}>
          {message.parts.map((part, index) => <PartView key={part.type === 'tool' && part.toolCallId ? part.toolCallId : index} part={part} messageId={message.id} onSend={onSend} sending={sending || streaming} finished={!streaming} />)}
        </div>
      )}
      {(run || streaming) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {run ? <AssistantRunStatus run={run} /> : message.parts.length === 0 && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground" data-qqq-id="assistant-thinking">
              <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden="true" />
              Working on it...
            </p>
          )}
          {onStop && (
            <button type="button" onClick={onStop} className={INLINE_ACTION} data-qqq-id="assistant-message-stop">
              <Square className="h-3 w-3 fill-current" aria-hidden="true" />
              {run?.status === 'cancelling' ? 'Stop now' : 'Stop'}
            </button>
          )}
        </div>
      )}
      {message.status === 'CANCELLED' && <p className="text-xs text-muted-foreground">Stopped.</p>}
      {message.status === 'ERROR' && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-qqq-id="assistant-reply-failed">
          {!message.parts.some((part) => part.type === 'notice' && part.level === 'error') && (
            <p className="text-xs text-destructive" role="alert">The reply did not finish.</p>
          )}
          {onRetry && (
            <button type="button" onClick={onRetry} disabled={sending} className={INLINE_ACTION} data-qqq-id="assistant-message-retry">
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              Retry
            </button>
          )}
        </div>
      )}
      {message.status === 'COMPLETE' && message.id > 0 && <FeedbackButtons messageId={message.id} />}
    </article>
  )
}
