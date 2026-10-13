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
 * @file NotificationBanners — sticky notifications shown above the page (loaded on demand):
 * severity, title, markdown body (rendered without HTML), an optional link, and Dismiss
 * (`POST /alerts/inbox/dismiss`), which hides it at once.
 */

'use client'

import React from 'react'
import Link from 'next/link'

import { useInboxActions } from '@/lib/hooks/use-inbox-actions'
import type { InboxItem } from '@/types/alerts'
import { MarkdownView } from '@/components/sql-workbench/MarkdownView'
import { ItemActions, SeverityIcon, linkKind, severityLabel } from './NotificationParts'

// the severity's accent as a left border, on the card surface so it reads in light and dark mode
const ACCENT: Record<string, string> = { INFO: '#2563eb', SUCCESS: '#16a34a', WARNING: '#d97706', ERROR: '#ef4444', CRITICAL: '#dc2626' }

/**
 * The banners.
 *
 * @param props - `banners`: the summary's sticky items.
 * @returns A region with one banner per item.
 */
export default function NotificationBanners({ banners }: { banners: InboxItem[] }) {
  const actions = useInboxActions()
  return (
    <section aria-label="Notification banners" className="mb-4 space-y-2" data-qqq-id="notification-banners">
      {banners.map((item) => {
        const kind = linkKind(item.href)
        const label = item.linkLabel ?? 'Open'
        return (
          <div
            key={item.key}
            role={item.severity === 'CRITICAL' || item.severity === 'ERROR' ? 'alert' : 'status'}
            aria-label={`${severityLabel(item.severity)}: ${item.title}`}
            className="flex items-start gap-3 rounded-lg border border-border bg-card py-3 pl-4 pr-2 text-sm shadow-sm"
            style={{ borderLeftWidth: '4px', borderLeftColor: ACCENT[item.severity] ?? ACCENT.INFO }}
            data-qqq-id={`notification-banner-${item.key}`}
          >
            <SeverityIcon severity={item.severity} />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="break-words font-semibold text-foreground">{item.title}</p>
              {item.body && <MarkdownView source={item.body} />}
              {kind === 'app' && (
                <Link href={item.href ?? ''} className="inline-block font-medium text-primary underline underline-offset-2">{label}</Link>
              )}
              {kind === 'external' && (
                <a href={item.href ?? ''} target="_blank" rel="noopener noreferrer" className="inline-block font-medium text-primary underline underline-offset-2">{label}</a>
              )}
            </div>
            <ItemActions item={item} onAction={(request) => actions.mutate(request)} dismissOnly />
          </div>
        )
      })}
    </section>
  )
}
