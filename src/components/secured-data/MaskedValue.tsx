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

/** @file Server-masked text; never applies a visual blur to an underlying value. */
import { LockKeyhole } from 'lucide-react'
import { SECURE_VALUE_ATTRIBUTES } from '@/lib/qa-capture/secure-attributes'

/**
 * Display a server mask without parsing it as the field's underlying type.
 * @param props - Component inputs.
 * @returns The rendered UI or current secured-data context.
 */
export function MaskedValue({ value, tier }: { value: unknown; tier: 'MASKED' | 'REVEALABLE' }) {
  return (
    <span
      className="inline-flex max-w-full flex-wrap items-center gap-1.5 text-muted-foreground"
      data-qqq-id="masked-value"
      {...SECURE_VALUE_ATTRIBUTES}
      aria-label={`Masked value: ${String(value ?? '—')}`}
    >
      <span className="min-w-0 break-all font-mono text-sm">{String(value ?? '—')}</span>
      <span className="inline-flex shrink-0 items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-xs">
        <LockKeyhole className="h-3 w-3" aria-hidden="true" />
        {tier === 'MASKED' ? 'Masked' : 'Restricted'}
      </span>
    </span>
  )
}
