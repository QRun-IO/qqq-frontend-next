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
 * @file useInboxActions — read, unread and dismiss for the notification center, applied
 * optimistically to the bell's summary and every loaded page of the notifications page, rolled
 * back (with a toast) on failure, and followed by a refetch of both. Used only by the lazily loaded popover,
 * page and banner, so it stays out of the first load.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { postInboxAction } from '@/lib/api/alerts'
import { queryKeys } from '@/lib/query-client'
import type { AlertsInboxSummary, InboxItem, InboxPage, InboxTarget } from '@/types/alerts'

/** An inbox action. */
export type InboxAction = 'read' | 'unread' | 'dismiss'

/** One action and its target. */
export interface InboxActionRequest {
  /** What to do. */
  action: InboxAction
  /** Which items. */
  target: InboxTarget
}

/**
 * Whether an item is the action's target.
 *
 * @param item - The item.
 * @param target - The target.
 * @returns True when it matches.
 */
export function targets(item: InboxItem, target: InboxTarget): boolean {
  if ('all' in target) return true
  if ('ids' in target) return item.id !== undefined && target.ids.includes(item.id)
  if ('id' in target) return item.id === target.id
  return item.alertId === target.alertId
}

/**
 * Applies an action to a list of items.
 *
 * @param items - The items.
 * @param request - The action and its target.
 * @returns The new items and how the unread count changes.
 */
export function applyToItems(items: InboxItem[], { action, target }: InboxActionRequest): { items: InboxItem[]; unreadDelta: number } {
  let unreadDelta = 0
  const next: InboxItem[] = []
  for (const item of items) {
    if (!targets(item, target)) {
      next.push(item)
    } else if (action === 'dismiss') {
      if (item.unread) unreadDelta--
    } else {
      const unread = action === 'unread'
      if (item.unread !== unread) unreadDelta += unread ? 1 : -1
      next.push({ ...item, unread })
    }
  }
  return { items: next, unreadDelta }
}

/**
 * Applies an action to the bell's summary.
 *
 * @param summary - The summary.
 * @param request - The action and its target.
 * @returns The new summary.
 */
export function applyToSummary(summary: AlertsInboxSummary, request: InboxActionRequest): AlertsInboxSummary {
  const { items, unreadDelta } = applyToItems(summary.items, request)
  const banners = request.action === 'dismiss' ? applyToItems(summary.banners, request).items : summary.banners
  const allRead = request.action === 'read' && 'all' in request.target
  const unreadCount = allRead ? 0 : Math.max(0, summary.unreadCount + unreadDelta)
  return { ...summary, items, banners, unreadCount, highestUnreadSeverity: unreadCount === 0 ? null : summary.highestUnreadSeverity }
}

/**
 * Applies an action to one page of the notifications page.
 *
 * @param page - The page.
 * @param request - The action and its target.
 * @returns The new page.
 */
export function applyToPage(page: InboxPage, request: InboxActionRequest): InboxPage {
  const { items } = applyToItems(page.items, request)
  return { ...page, items, total: Math.max(0, page.total - (page.items.length - items.length)) }
}

/**
 * The mutation behind every inbox action.
 *
 * @returns A TanStack mutation taking an {@link InboxActionRequest}.
 */
export function useInboxActions() {
  const queryClient = useQueryClient()
  const summaryKey = queryKeys.alertsInbox()
  const pageKey = queryKeys.alertsInboxPage()
  return useMutation({
    mutationFn: ({ action, target }: InboxActionRequest) => postInboxAction(action, target),
    onMutate: async (request: InboxActionRequest) => {
      await Promise.all([queryClient.cancelQueries({ queryKey: summaryKey }), queryClient.cancelQueries({ queryKey: pageKey })])
      const summary = queryClient.getQueryData<AlertsInboxSummary | null>(summaryKey)
      const pages = queryClient.getQueriesData<InboxPage>({ queryKey: pageKey })
      if (summary) queryClient.setQueryData(summaryKey, applyToSummary(summary, request))
      for (const [key, page] of pages) if (page) queryClient.setQueryData(key, applyToPage(page, request))
      return { summary, pages }
    },
    onError: (_error, _request, context) => {
      toast.error('Could not update notifications. Try again.')
      if (!context) return
      if (context.summary) queryClient.setQueryData(summaryKey, context.summary)
      for (const [key, page] of context.pages) queryClient.setQueryData(key, page)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: summaryKey })
      void queryClient.invalidateQueries({ queryKey: pageKey })
    },
  })
}
