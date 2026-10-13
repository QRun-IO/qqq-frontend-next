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
 * @file Types for the Alerts qbit's bell and record panel (`/qqq/v1/alerts/*`).
 */

/** An alert's severity, least to most severe. */
export type AlertSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'

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

/** `GET /alerts/inbox/summary`: the bell. */
export interface AlertsInboxSummary {
  /** Unread inbox items. */
  unreadCount: number
  /** The highest severity among unread items, or null. */
  highestUnreadSeverity: AlertSeverity | null
  /** The latest items, newest first (at most 10). */
  items: AlertItem[]
  /** The Alerts app path. */
  alertsHref: string
  /** How often to poll (seconds). */
  pollSeconds?: number
}

/** `GET /alerts/record-panel`: the "Open alerts" panel for a record. */
export interface AlertsRecordPanel {
  /** False when there is nothing to show (the panel is hidden). */
  visible: boolean
  /** Open alerts that reference the record. */
  openCount: number
  /** The first few open alerts, most severe first. */
  open: AlertItem[]
  /** Alerts about the record resolved in the last 30 days. */
  resolvedLast30Days: number
  /** The filtered Alerts list for every alert about the record. */
  viewAllHref: string | null
  /** Whether the user may acknowledge and snooze. */
  canManage: boolean
  /** Whether the user already watches this record. */
  watching: boolean
}
