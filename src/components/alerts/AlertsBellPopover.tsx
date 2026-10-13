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
 * @file AlertsBellPopover — the bell's popover (loaded on first open): one column of the latest
 * alerts (severity dot, title, group, age), "Mark all read" and "Open Alerts". Opening an item
 * marks it read. Focus stays inside while it is open; Escape or a click outside closes it.
 */

'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'

import { markAlertsRead } from '@/lib/api/alerts'
import { queryKeys } from '@/lib/query-client'
import type { AlertsInboxSummary } from '@/types/alerts'
import { SeverityDot } from './SeverityDot'

/** Props for the popover. */
export interface AlertsBellPopoverProps {
  /** The inbox summary to show. */
  summary: AlertsInboxSummary
  /** Close the popover (focus returns to the bell). */
  onClose: () => void
}

/**
 * The bell popover.
 *
 * @param props - Component properties.
 * @returns The popover dialog.
 */
export default function AlertsBellPopover({ summary, onClose }: AlertsBellPopoverProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const panelRef = useRef<HTMLDivElement>(null)
  // a dropdown under the bell from 640 px; full width under the header below that (inline, so no new CSS)
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 640px)').matches)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(min-width: 640px)')
    const onChange = () => setWide(query.matches)
    query.addEventListener?.('change', onChange)
    return () => query.removeEventListener?.('change', onChange)
  }, [])
  const placement: React.CSSProperties = wide
    ? { position: 'absolute', right: 0, top: '100%', marginTop: '0.5rem', width: '24rem', maxHeight: '70vh' }
    : { position: 'fixed', left: '0.5rem', right: '0.5rem', top: 'calc(var(--qqq-header-height) + 0.25rem)', maxHeight: '70vh' }

  useEffect(() => {
    const panel = panelRef.current
    panel?.querySelector<HTMLElement>('a,button')?.focus({ preventScroll: true })

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>('a,button'))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    const onPointer = (event: PointerEvent) => {
      if (panel && !panel.contains(event.target as Node) && !(event.target as HTMLElement).closest?.('[data-qqq-id="button-notifications"]')) onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [onClose])

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.alertsInbox() })

  const open = async (alertId: number, href: string, unread: boolean | undefined) => {
    onClose()
    router.push(href)
    if (unread) {
      try {
        await markAlertsRead({ alertId })
      } finally {
        refresh()
      }
    }
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label="Alerts"
      className="z-50 overflow-y-auto rounded-xl border border-border bg-card shadow-lg"
      style={placement}
      data-qqq-id="alerts-popover"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Alerts</h2>
        <span className="text-xs text-muted-foreground">{summary.unreadCount > 0 ? `${summary.unreadCount} unread` : 'All read'}</span>
      </div>
      {summary.items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground" data-qqq-id="alerts-popover-empty">Nothing needs you right now.</p>
      ) : (
        <ul className="divide-y divide-border">
          {summary.items.map((item) => (
            <li key={item.alertId}>
              <a
                href={item.href}
                onClick={(event) => {
                  event.preventDefault()
                  void open(item.alertId, item.href, item.unread)
                }}
                className={`flex items-start gap-3 px-4 py-3 text-sm hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${item.unread ? '' : 'opacity-75'}`}
                data-qqq-id={`alerts-popover-item-${item.alertId}`}
              >
                <SeverityDot severity={item.severity} />
                <span className="min-w-0 flex-1">
                  <span className={`block break-words text-foreground ${item.unread ? 'font-semibold' : ''}`}>{item.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {[item.group, item.age === 'just now' ? 'just now' : `${item.age} ago`].filter(Boolean).join(' · ')}
                  </span>
                </span>
                {item.unread && <span className="sr-only">(unread)</span>}
              </a>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3 text-sm">
        <button
          type="button"
          disabled={summary.unreadCount === 0}
          onClick={async () => {
            try {
              await markAlertsRead({ all: true })
            } finally {
              refresh()
            }
          }}
          className="rounded-md px-2 py-1 text-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          data-qqq-id="alerts-mark-all-read"
        >
          Mark all read
        </button>
        <a
          href={summary.alertsHref}
          onClick={(event) => {
            event.preventDefault()
            onClose()
            router.push(summary.alertsHref)
          }}
          className="rounded-md px-2 py-1 font-medium text-primary hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-qqq-id="alerts-open-app"
        >
          Open Alerts
        </a>
      </div>
    </div>
  )
}
