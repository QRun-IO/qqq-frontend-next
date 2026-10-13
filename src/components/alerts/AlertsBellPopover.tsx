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
 * @file AlertsBellPopover — the bell's popover (loaded on first open): the latest
 * notifications, newest first (severity icon, title, source, relative time), each with mark
 * read/unread and dismiss when the backend sends its recipient id, plus "Mark all read" and
 * "View all". Opening an item marks it read. Focus stays inside while it is open; Escape or a
 * click outside closes it.
 */

'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useInboxActions } from '@/lib/hooks/use-inbox-actions'
import type { AlertsInboxSummary, InboxItem } from '@/types/alerts'
import { ItemActions, SeverityIcon, itemMeta, linkKind, readRequest } from './NotificationParts'

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
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>('a,button:not([disabled])'))
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

  const actions = useInboxActions()

  const openItem = (item: InboxItem) => {
    const read = readRequest(item)
    if (read) actions.mutate(read)
    onClose()
    if (item.href) router.push(item.href)
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label="Notifications"
      className="z-50 overflow-y-auto rounded-xl border border-border bg-card shadow-lg"
      style={placement}
      data-qqq-id="alerts-popover"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
        <span className="text-xs text-muted-foreground">{summary.unreadCount > 0 ? `${summary.unreadCount} unread` : 'All read'}</span>
      </div>
      {summary.items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground" data-qqq-id="alerts-popover-empty">You have no notifications.</p>
      ) : (
        <ul className="divide-y divide-border">
          {summary.items.map((item) => {
            const kind = linkKind(item.href)
            const title = <span className={`block break-words text-foreground ${item.unread ? 'font-semibold' : ''}`}>{item.title}</span>
            const meta = <span className="block text-xs text-muted-foreground">{itemMeta(item)}</span>
            const linkClass = 'block min-w-0 flex-1 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:underline'
            return (
              <li key={item.key} className={`flex items-start gap-3 py-3 pl-4 pr-2 text-sm ${item.unread ? '' : 'opacity-75'}`} data-qqq-id={`alerts-popover-item-${item.key}`}>
                <SeverityIcon severity={item.severity} />
                {kind === 'app' ? (
                  <a
                    href={item.href ?? undefined}
                    onClick={(event) => {
                      event.preventDefault()
                      openItem(item)
                    }}
                    className={linkClass}
                  >
                    {title}
                    {meta}
                    {item.unread && <span className="sr-only">(unread)</span>}
                  </a>
                ) : kind === 'external' ? (
                  <a href={item.href ?? undefined} target="_blank" rel="noopener noreferrer" onClick={() => openItem({ ...item, href: null })} className={linkClass}>
                    {title}
                    {meta}
                    {item.unread && <span className="sr-only">(unread)</span>}
                  </a>
                ) : (
                  <span className="min-w-0 flex-1">
                    {title}
                    {meta}
                    {item.unread && <span className="sr-only">(unread)</span>}
                  </span>
                )}
                <ItemActions item={item} onAction={(request) => actions.mutate(request)} />
              </li>
            )
          })}
        </ul>
      )}
      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3 text-sm">
        <button
          type="button"
          disabled={summary.unreadCount === 0}
          onClick={() => actions.mutate({ action: 'read', target: { all: true } })}
          className="rounded-md px-2 py-1 text-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          data-qqq-id="alerts-mark-all-read"
        >
          Mark all read
        </button>
        <a
          href={summary.notificationsHref}
          onClick={(event) => {
            event.preventDefault()
            onClose()
            router.push(summary.notificationsHref)
          }}
          className="rounded-md px-2 py-1 font-medium text-primary hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-qqq-id="alerts-view-all"
        >
          View all
        </a>
      </div>
    </div>
  )
}
