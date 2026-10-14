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
 * @file FieldFooter — the quiet line under a form field: its error, an optional hint that shows
 * while the field has focus, and a length counter that appears only near a limit. The line opens
 * and closes smoothly, so the form does not jump when a message arrives.
 */

'use client'

import React from 'react'
import { useWatch } from 'react-hook-form'
import type { Control } from 'react-hook-form'

import { cn } from '@/lib/utils/cn'
import { lengthMeter, truncateNote } from '@/lib/utils/field-validation'
import type { LengthMeter, TooLongPolicy } from '@/lib/utils/field-validation'

/** What a text field needs to count its characters against `maxLength`. */
export interface LengthLimit {
  control: Control<Record<string, unknown>>
  name: string
  max: number
  policy: TooLongPolicy
}

/** Props for {@link FieldFooter}. */
interface FieldFooterProps {
  /** The field's id; the error gets `${id}-error` and the hint `${id}-hint`. */
  id: string
  /** The field's current error message. */
  error?: string
  /** Guidance shown while the field has focus and has no error (the parent needs the `group` class). */
  hint?: string
  /** A length counter, shown only when {@link lengthMeter} found one useful. */
  meter?: LengthMeter
  /** A quiet note, such as the server trimming extra characters. */
  note?: string
  /** Counts a text field's characters; the counter and the trim note then come from the live value. */
  limit?: LengthLimit
}

/**
 * Renders the field's footer: the error first, then any note or hint, with the counter at the end.
 * Errors are announced politely; the counter is not announced at all.
 *
 * @param props - See {@link FieldFooterProps}.
 * @returns The footer, collapsed to no height while it has nothing to say.
 */
export function FieldFooter({ limit, ...props }: FieldFooterProps) {
  return limit ? <CountingFooter limit={limit} {...props} /> : <FooterLine {...props} />
}

/**
 * Only a field that refuses over-long values marks its counter as an error; for others it is just information.
 *
 * @param meter - The counter, if one is showing.
 * @param policy - The field's too-long policy.
 * @returns The counter with its error styling decided.
 */
function refusedOnly(meter: LengthMeter | undefined, policy: TooLongPolicy): LengthMeter | undefined {
  return meter && { ...meter, over: meter.over && policy === 'error' }
}

/**
 * The footer of a field with a length limit: it watches the value, so only these fields re-render per keystroke.
 *
 * @param props - The footer props with the field's limit.
 * @returns The footer with its live counter.
 */
function CountingFooter({ limit, ...props }: FieldFooterProps & { limit: LengthLimit }) {
  const value: unknown = useWatch({ control: limit.control, name: limit.name })
  const length = typeof value === 'string' ? value.length : 0
  return <FooterLine {...props} meter={refusedOnly(lengthMeter(length, limit.max), limit.policy)} note={truncateNote(limit.policy, length, limit.max)} />
}

/**
 * The footer's markup: the message line and the counter.
 *
 * @param props - The footer props without a limit (the counter is already worked out).
 * @returns The footer line.
 */
function FooterLine({ id, error, hint, meter, note }: Omit<FieldFooterProps, 'limit'>) {
  const open = Boolean(error || note || meter)
  return (
    <div
      className={cn(
        '-mt-1 grid transition-[grid-template-rows] duration-150 motion-reduce:transition-none',
        open ? 'grid-rows-[1fr]' : hint ? 'grid-rows-[0fr] group-focus-within:grid-rows-[1fr]' : 'grid-rows-[0fr]'
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="flex items-start justify-between gap-3 pt-1">
          <div className="min-w-0" aria-live="polite">
            {error ? (
              <p id={`${id}-error`} className="text-sm text-destructive">{error}</p>
            ) : (
              <>
                {note && <p className="text-xs text-muted-foreground">{note}</p>}
                {hint && !note && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
              </>
            )}
          </div>
          {meter && (
            <span aria-hidden="true" className={cn('ml-auto shrink-0 text-xs tabular-nums', meter.over ? 'font-medium text-destructive' : 'text-muted-foreground')}>
              {meter.text}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
