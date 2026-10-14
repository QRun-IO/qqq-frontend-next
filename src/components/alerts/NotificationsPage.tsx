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
 * @file NotificationsPage — the notification center's full list at `/app/notifications`
 * (loaded on demand): All/Unread, category and severity filters, paging, markdown bodies
 * (rendered without HTML), and the bell's actions. Filters and the offset live in the URL.
 * Like the bell, it sends no request unless the instance metadata announces Alerts.
 */

'use client'

import React, { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

import { getAlertsInbox } from '@/lib/api/alerts'
import { useQContext } from '@/lib/context/q-context'
import { useInboxActions } from '@/lib/hooks/use-inbox-actions'
import { queryKeys } from '@/lib/query-client'
import type { InboxFilter, InboxItem } from '@/types/alerts'
import { NOTIFICATION_CATEGORIES, NOTIFICATION_SEVERITIES } from '@/types/alerts'
import { BUTTON_CLASS } from '@/components/ui/controls'
import { MarkdownView } from '@/components/sql-workbench/MarkdownView'
import { useAlertsInstalled } from './AlertsBell'
import { ItemActions, SeverityIcon, itemMeta, linkKind, readRequest, severityLabel } from './NotificationParts'

/** Items per page. */
export const PAGE_SIZE = 25

const SELECT_CLASS = 'rounded-md border border-input bg-card px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring'

/**
 * "SECURITY" → "Security".
 *
 * @param value - An upper-case name.
 * @returns The label.
 */
const titleCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase()

/**
 * Reads the filter from the URL.
 *
 * @param params - The search params.
 * @returns The filter.
 */
export function filterFromParams(params: URLSearchParams): InboxFilter {
  const offset = Number.parseInt(params.get('offset') ?? '0', 10)
  return {
    status: params.get('status') === 'unread' ? 'unread' : 'all',
    category: params.get('category') ?? '',
    severity: params.get('severity') ?? '',
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    limit: PAGE_SIZE,
  }
}

/**
 * The page's URL for a filter (defaults left out).
 *
 * @param filter - The filter.
 * @returns The path with its query.
 */
function pagePath(filter: InboxFilter): string {
  const params = new URLSearchParams()
  if (filter.status === 'unread') params.set('status', 'unread')
  if (filter.category) params.set('category', filter.category)
  if (filter.severity) params.set('severity', filter.severity)
  if (filter.offset > 0) params.set('offset', String(filter.offset))
  const query = params.toString()
  return `/app/notifications${query ? `?${query}` : ''}`
}

/**
 * The loading indicator.
 *
 * @returns The indicator.
 */
function Loading() {
  return (
    <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground" role="status" data-qqq-id="notifications-loading">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      Loading notifications…
    </p>
  )
}

/**
 * The notifications page.
 *
 * @returns The page.
 */
export function NotificationsPage() {
  const { setPageHeader } = useQContext()
  useEffect(() => setPageHeader('Notifications'), [setPageHeader])
  const installed = useAlertsInstalled()
  if (!installed) {
    return (
      <p className="p-6 text-sm text-muted-foreground" data-qqq-id="notifications-unavailable">
        Notifications are not available.
      </p>
    )
  }
  return <NotificationsList />
}

/**
 * The filters, list and paging.
 *
 * @returns The list.
 */
function NotificationsList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const filter = filterFromParams(new URLSearchParams(searchParams?.toString() ?? ''))
  const navigate = (next: Partial<InboxFilter>) => router.replace(pagePath({ ...filter, offset: 0, ...next }), { scroll: false })
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.alertsInboxPage(filter),
    queryFn: () => getAlertsInbox(filter),
    placeholderData: keepPreviousData,
    retry: false,
  })
  const actions = useInboxActions()

  const first = data && data.total > 0 ? data.offset + 1 : 0
  const last = data ? Math.min(data.offset + data.items.length, data.total) : 0
  const filtered = filter.status === 'unread' || filter.category !== '' || filter.severity !== ''

  /**
   * Follows an item's link, marking it read.
   *
   * @param item - The item.
   * @param event - The click.
   */
  const follow = (item: InboxItem, event: React.MouseEvent) => {
    const read = readRequest(item)
    if (read) actions.mutate(read)
    if (linkKind(item.href) === 'app' && item.href) {
      event.preventDefault()
      router.push(item.href)
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4" data-qqq-id="notifications-page">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Show" className="inline-flex rounded-md border border-input bg-card p-0.5">
          {(['all', 'unread'] as const).map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={filter.status === status}
              onClick={() => navigate({ status })}
              className={`rounded px-3 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${filter.status === status ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent'}`}
              data-qqq-id={`notifications-status-${status}`}
            >
              {status === 'all' ? 'All' : 'Unread'}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Category
          <select value={filter.category} onChange={(event) => navigate({ category: event.target.value })} className={SELECT_CLASS} data-qqq-id="notifications-category">
            <option value="">All</option>
            {NOTIFICATION_CATEGORIES.map((category) => (
              <option key={category} value={category}>{titleCase(category)}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Severity
          <select value={filter.severity} onChange={(event) => navigate({ severity: event.target.value })} className={SELECT_CLASS} data-qqq-id="notifications-severity">
            <option value="">All</option>
            {NOTIFICATION_SEVERITIES.map((severity) => (
              <option key={severity} value={severity}>{severityLabel(severity)}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={`${BUTTON_CLASS} sm:ml-auto`}
          disabled={!data?.items.some((item) => item.unread)}
          onClick={() => actions.mutate({ action: 'read', target: { all: true } })}
          data-qqq-id="notifications-mark-all-read"
        >
          Mark all read
        </button>
      </div>

      {isLoading ? (
        <Loading />
      ) : isError ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          Could not load notifications.
          <button type="button" className={BUTTON_CLASS} onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      ) : !data || data.items.length === 0 ? (
        <p className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground" data-qqq-id="notifications-empty">
          {filtered ? 'No notifications match these filters.' : 'You have no notifications.'}
        </p>
      ) : (
        <ul className="space-y-2" aria-label="Notifications">
          {data.items.map((item) => {
            const kind = linkKind(item.href)
            return (
              <li
                key={item.key}
                className={`flex items-start gap-3 rounded-lg border border-border bg-card py-3 pl-4 pr-2 text-sm ${item.unread ? '' : 'opacity-80'}`}
                data-qqq-id={`notifications-item-${item.key}`}
              >
                <SeverityIcon severity={item.severity} />
                <div className="min-w-0 flex-1 space-y-1">
                  <h2 className={`break-words text-sm text-foreground ${item.unread ? 'font-semibold' : 'font-medium'}`}>
                    {item.unread && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-primary align-middle" aria-hidden="true" />}
                    {item.title}
                    {item.unread && <span className="sr-only"> (unread)</span>}
                  </h2>
                  <p className="text-xs text-muted-foreground">{itemMeta(item, true)}</p>
                  {item.body && <MarkdownView source={item.body} />}
                  {kind && (
                    <a
                      href={item.href ?? undefined}
                      target={kind === 'external' ? '_blank' : undefined}
                      rel={kind === 'external' ? 'noopener noreferrer' : undefined}
                      onClick={(event) => follow(item, event)}
                      className="inline-block font-medium text-primary underline underline-offset-2"
                    >
                      {item.linkLabel ?? 'Open'}
                    </a>
                  )}
                </div>
                <ItemActions item={item} onAction={(request) => actions.mutate(request)} />
              </li>
            )
          })}
        </ul>
      )}

      {data && data.total > 0 && (
        <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>{`${first}–${last} of ${data.total}`}</span>
          <span className="flex gap-2">
            <button type="button" className={BUTTON_CLASS} disabled={filter.offset === 0} onClick={() => navigate({ offset: Math.max(0, filter.offset - PAGE_SIZE) })} data-qqq-id="notifications-previous">
              Previous
            </button>
            <button type="button" className={BUTTON_CLASS} disabled={filter.offset + PAGE_SIZE >= data.total} onClick={() => navigate({ offset: filter.offset + PAGE_SIZE })} data-qqq-id="notifications-next">
              Next
            </button>
          </span>
        </nav>
      )}
    </div>
  )
}
