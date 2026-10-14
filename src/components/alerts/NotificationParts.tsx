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
 * @file Notification parts shared by the popover, the notifications page and the banners (all
 * loaded on demand): the severity icon, the relative time, the safe link target, and the
 * per-item read/unread and dismiss buttons (shown only for items with a recipient `id`).
 */

'use client'

import React from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Mail, MailOpen, OctagonAlert, X } from 'lucide-react'

import type { InboxItem, NotificationSeverity } from '@/types/alerts'
import type { InboxActionRequest } from '@/lib/hooks/use-inbox-actions'

// mid-tone colors that read on light and dark cards; inline so the icons add no CSS
const SEVERITY: Record<NotificationSeverity, { label: string; color: string; Icon: typeof Info }> = {
  INFO: { label: 'Info', color: '#2563eb', Icon: Info },
  SUCCESS: { label: 'Success', color: '#16a34a', Icon: CheckCircle2 },
  WARNING: { label: 'Warning', color: '#d97706', Icon: AlertTriangle },
  ERROR: { label: 'Error', color: '#ef4444', Icon: AlertCircle },
  CRITICAL: { label: 'Critical', color: '#dc2626', Icon: OctagonAlert },
}

/**
 * The severity's label ("Critical").
 *
 * @param severity - The severity.
 * @returns Its label.
 */
export function severityLabel(severity: string): string {
  return SEVERITY[severity as NotificationSeverity]?.label ?? severity
}

/**
 * A severity icon with its name for screen readers.
 *
 * @param props - The severity.
 * @returns The icon.
 */
export function SeverityIcon({ severity }: { severity: NotificationSeverity }) {
  const { label, color, Icon } = SEVERITY[severity] ?? SEVERITY.INFO
  return (
    <span className="flex shrink-0 items-center pt-0.5" data-qqq-id={`notification-severity-${severity}`}>
      <Icon className="h-4 w-4" style={{ color }} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  )
}

/**
 * The relative time of an item: the server's age ("3 h ago"), else from its delivery time.
 *
 * @param item - The item.
 * @param now - The current time (tests).
 * @returns The text, or empty.
 */
export function relativeTime(item: Pick<InboxItem, 'age' | 'deliveredAt'>, now: number = Date.now()): string {
  if (item.age) return item.age === 'just now' ? item.age : `${item.age} ago`
  const at = item.deliveredAt ? Date.parse(item.deliveredAt) : NaN
  if (Number.isNaN(at)) return ''
  const minutes = Math.round((now - at) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return `${Math.round(hours / 24)} d ago`
}

/**
 * Classifies an item's link: a same-origin path starting with a single `/` (client navigation),
 * https (a new tab), or none (rendered as plain text). Backslashes, whitespace and control
 * characters are refused outright, since browsers normalize `\` to `/` (`/\evil.com` would
 * leave the app), as is a second character of `/` or `\`.
 *
 * @param href - The link.
 * @returns The kind.
 */
export function linkKind(href: string | null | undefined): 'app' | 'external' | null {
  if (!href || /[\\\s\u0000-\u001f\u007f]/.test(href) || href[1] === '/' || href[1] === '\\') return null
  let url: URL
  try {
    url = new URL(href, window.location.origin)
  } catch {
    return null
  }
  if (href.startsWith('/')) return url.origin === window.location.origin ? 'app' : null
  return url.protocol === 'https:' ? 'external' : null
}

/**
 * The secondary line: source and relative time (and the category on the page).
 *
 * @param item - The item.
 * @param withCategory - Include the category.
 * @returns The text.
 */
export function itemMeta(item: InboxItem, withCategory = false): string {
  const category = withCategory && item.category ? item.category.charAt(0) + item.category.slice(1).toLowerCase() : null
  return [category, item.source, relativeTime(item)].filter(Boolean).join(' · ')
}

/** Props for {@link ItemActions}. */
export interface ItemActionsProps {
  /** The item. */
  item: InboxItem
  /** Runs an action. */
  onAction: (request: InboxActionRequest) => void
  /** Hide the read/unread toggle (banners). */
  dismissOnly?: boolean
}

const ICON_BUTTON = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/**
 * Mark read/unread and dismiss for one item; nothing for items without a recipient id (older
 * backends).
 *
 * @param props - Component properties.
 * @returns The buttons, or null.
 */
export function ItemActions({ item, onAction, dismissOnly = false }: ItemActionsProps) {
  const id = item.id
  if (id === undefined) return null
  return (
    <span className="flex shrink-0 items-start gap-0.5">
      {!dismissOnly && (
        <button
          type="button"
          className={ICON_BUTTON}
          onClick={() => onAction({ action: item.unread ? 'read' : 'unread', target: { id } })}
          aria-label={`${item.unread ? 'Mark read' : 'Mark unread'}: ${item.title}`}
          title={item.unread ? 'Mark read' : 'Mark unread'}
          data-qqq-id={`notification-toggle-read-${id}`}
        >
          {item.unread ? <MailOpen className="h-4 w-4" aria-hidden="true" /> : <Mail className="h-4 w-4" aria-hidden="true" />}
        </button>
      )}
      <button
        type="button"
        className={ICON_BUTTON}
        onClick={() => onAction({ action: 'dismiss', target: { id } })}
        aria-label={`Dismiss: ${item.title}`}
        title="Dismiss"
        data-qqq-id={`notification-dismiss-${id}`}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </span>
  )
}

/**
 * The read target for opening an item: its recipient id, else (older backends) its alert id.
 *
 * @param item - The item.
 * @returns The request, or null when it cannot be marked read.
 */
export function readRequest(item: InboxItem): InboxActionRequest | null {
  if (!item.unread) return null
  if (item.id !== undefined) return { action: 'read', target: { id: item.id } }
  if (item.alertId !== undefined) return { action: 'read', target: { alertId: item.alertId } }
  return null
}
