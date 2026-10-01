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
 * @file The Material Dashboard's page views, derived from the route (QRun-IO/qqq#730): App,
 * Query, New, View, Edit, Copy, Process and Developer Mode, titled with metadata labels, plus
 * the events Material sends when those screens open (app load, process start).
 */

import type { QInstance } from '@/types'
import type { PageView, UserEvent } from './types'

/** A screen's page view and the events Material records when it opens. */
export interface ScreenAnalytics {
  pageView: PageView
  events: UserEvent[]
}

/** Record routes that are not record ids. */
const TABLE_SUBROUTES = new Set(['create', 'savedView', 'dev', 'key'])

/**
 * The page view (and opening events) for a dashboard route.
 *
 * @param pathname - The route path.
 * @param search - The query string (sent only when record data is allowed).
 * @param metaData - Instance metadata, for labels.
 * @returns The screen's analytics, or null for routes Material records nothing for.
 */
export function screenAnalytics(pathname: string, search: string, metaData: QInstance): ScreenAnalytics | null {
  const segments = pathname.split('/').filter(Boolean).map((segment) => {
    try {
      return decodeURIComponent(segment)
    } catch {
      return segment
    }
  })
  if (segments[0] !== 'app' || segments.length < 2) return null
  const [, slug, second, third] = segments
  const location = { pathname, search }
  const app = metaData.apps?.[slug]
  if (app && segments.length === 2) {
    return { pageView: { location, title: `App: ${app.label}` }, events: [{ category: 'appEvents', action: 'loadAppScreen', label: app.label }] }
  }
  const table = metaData.tables?.[slug]
  if (table) {
    const label = table.label
    if (second === undefined || second === 'savedView') return { pageView: { location, title: `Query: ${label}` }, events: [] }
    if (second === 'create') return { pageView: { location, title: `New: ${label}` }, events: [] }
    if (second === 'dev' && third === undefined) return { pageView: { location, title: `Developer Mode: ${label}` }, events: [] }
    if (TABLE_SUBROUTES.has(second)) return null
    const recordId = second
    if (third === undefined) return { pageView: { location, title: `View: ${label}`, recordId }, events: [] }
    if (third === 'edit') return { pageView: { location, title: `Edit: ${label}`, recordId }, events: [] }
    if (third === 'copy') return { pageView: { location, title: `Copy: ${label}`, recordId }, events: [] }
    if (third === 'dev') return { pageView: { location, title: `Developer Mode: ${label}`, recordId }, events: [] }
    const process = metaData.processes?.[third]
    if (process) return processScreen(location, process.label, recordId)
    return null
  }
  const process = metaData.processes?.[slug]
  if (process && segments.length === 2) return processScreen(location, process.label)
  return null
}

/**
 * A process screen: its page view and the start event.
 *
 * @param location - The route.
 * @param label - The process label.
 * @param recordId - The record the process runs on, when launched from a record.
 * @returns The screen's analytics.
 */
function processScreen(location: PageView['location'], label: string, recordId?: string): ScreenAnalytics {
  return {
    pageView: { location, title: `Process: ${label}`, ...(recordId === undefined ? {} : { recordId }) },
    events: [{ category: 'processEvents', action: 'startProcess', label }],
  }
}
