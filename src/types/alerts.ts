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
 * @file Types for the Alerts qbit's notification center (bell, popover, `/app/notifications`,
 * banners) and record panel (`/qqq/v1/alerts/*`).
 */

/** An alert's severity, least to most severe. */
export type AlertSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'

/** A notification's severity: the alert severities plus SUCCESS. */
export type NotificationSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'CRITICAL'

/** The notification categories the page filters on. */
export const NOTIFICATION_CATEGORIES = ['SYSTEM', 'JOB', 'SECURITY', 'RELEASE', 'MARKETING', 'SHARE', 'ALERT'] as const

/** A notification category. */
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]

/** The notification severities, least to most severe. */
export const NOTIFICATION_SEVERITIES: readonly NotificationSeverity[] = ['INFO', 'SUCCESS', 'WARNING', 'ERROR', 'CRITICAL']

/**
 * One inbox item, normalized from either backend shape: the notification center
 * (`{id, notificationId, title, body, severity, category, source, href, linkLabel, deliveredAt,
 * age, unread, sticky}`) or qbit-alerts 0.1.0-RC.1 (`{alertId, title, severity, status, group,
 * age, href, unread}`). Without `id` and `alertId` the item has no per-item actions.
 */
export interface InboxItem {
  /** Stable React key. */
  key: string
  /** The recipient row id (the target of read, unread and dismiss). */
  id?: number
  /** The notification's id. */
  notificationId?: number
  /** Older backends: the alert id (`{alertId}` still marks it read). */
  alertId?: number
  /** Title. */
  title: string
  /** Markdown body (the page and banners only). */
  body?: string | null
  /** Severity. */
  severity: NotificationSeverity
  /** Category. */
  category?: string | null
  /** Who sent it (older backends: the alert group). */
  source?: string | null
  /** Where it links: a relative app path or https. */
  href?: string | null
  /** The link's label. */
  linkLabel?: string | null
  /** When it was delivered (ISO). */
  deliveredAt?: string | null
  /** Relative age from the server ("3 h"). */
  age?: string | null
  /** Not read yet. */
  unread: boolean
  /** A banner until dismissed. */
  sticky?: boolean
}

/** `GET /alerts/inbox`: one page of the inbox. */
export interface InboxPage {
  /** The items, newest first. */
  items: InboxItem[]
  /** Matching items in all. */
  total: number
  /** The page's offset. */
  offset: number
  /** The page size. */
  limit: number
}

/** The `/alerts/inbox` filters. */
export interface InboxFilter {
  /** `all` or `unread`. */
  status: 'all' | 'unread'
  /** A category, or empty for every category. */
  category: string
  /** A severity, or empty for every severity. */
  severity: string
  /** Offset of the first item. */
  offset: number
  /** Page size. */
  limit: number
}

/** The target of read, unread and dismiss. */
export type InboxTarget = { id: number } | { ids: number[] } | { all: true } | { alertId: number }

/** One alert as the bell and the record panel show it. */
export interface AlertItem {
  /** The alert record's id. */
  alertId: number
  /** External-safe title. */
  title: string
  /** Severity. */
  severity: AlertSeverity
  /** OPEN, ACKNOWLEDGED, SNOOZED or RESOLVED. */
  status: string
  /** The alert group's label, when the user can read groups. */
  group?: string | null
  /** Relative age ("3 h"). */
  age: string
  /** When it was first raised (ISO). */
  raisedAt?: string | null
  /** The alert record's path in the app. */
  href: string
  /** Inbox items only: not read yet. */
  unread?: boolean
}

/** `GET /alerts/inbox/summary`: the bell, normalized. */
export interface AlertsInboxSummary {
  /** Unread inbox items. */
  unreadCount: number
  /** The highest severity among unread items, or null. */
  highestUnreadSeverity: NotificationSeverity | null
  /** The latest items, newest first (at most 10). */
  items: InboxItem[]
  /** Sticky, undismissed, unexpired items shown as banners. */
  banners: InboxItem[]
  /** The notifications page path ("View all"). */
  notificationsHref: string
  /** Registered section offered by the notification settings shortcut. */
  preferencesSection?: string | null
  /** How often to poll (seconds). */
  pollSeconds?: number
}

/** An open alert with permission-aware actions supplied by the server. */
export interface AlertsRecordPanelAlert extends AlertItem {
  /** Available actions; only actions with complete hrefs are rendered as links. */
  actions?: Array<{
    name: string
    label: string
    href?: string
    processName?: string
    operationId?: string
  }>
}

/** `GET /alerts/record-panel`: the "Open alerts" panel for a record. */
export interface AlertsRecordPanel {
  /** False when there is nothing to show (the panel is hidden). */
  visible: boolean
  /** Open alerts that reference the record. */
  openCount: number
  /** The first few open alerts, most severe first. */
  open: AlertsRecordPanelAlert[]
  /** Alerts about the record resolved in the last 30 days. */
  resolvedLast30Days: number
  /** The filtered Alerts list for every alert about the record. */
  viewAllHref: string | null
  /** Whether the user may acknowledge and snooze. */
  canManage: boolean
  /** Whether the user already watches this record. */
  watching: boolean
}
