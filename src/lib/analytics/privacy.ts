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
 * @file Analytics settings and privacy (QRun-IO/qqq#730). Analytics is off unless the backend
 * publishes analytics environment values, and by default nothing identifying leaves the
 * browser: no record ids, record labels or query strings (filters hold field values), and no
 * user name or email. Applications opt in with ANALYTICS_INCLUDE_RECORD_DATA=true and
 * ANALYTICS_IDENTIFY_USERS=true; identity values an application puts in the session's
 * `analyticsValues` are its own deliberate choice and are passed on.
 */

import type { PageView, SafePageView, UserEvent } from './types'

/** The providers Material activates when ANALYTICS_PROVIDERS is not set. */
export const DEFAULT_ANALYTICS_PROVIDERS = ['google', 'posthog']

/** What the published environment values configure. */
export interface AnalyticsSettings {
  /** The published values (the provider configuration). */
  environmentValues: Record<string, string>
  /** Provider names, lowercased and distinct. */
  providers: string[]
  /** Plugin script URLs that register providers through `window.QQQAnalytics`. */
  pluginScripts: string[]
  /** Send the signed-in user's id, email and name (Material's default; off in Next). */
  identifyUsers: boolean
  /** Send record ids, record labels and query strings. */
  includeRecordData: boolean
}

/**
 * Splits a Material-style list (commas, semicolons or line breaks).
 *
 * @param value - The configured value.
 * @returns The trimmed, non-empty entries.
 */
export function parseList(value: string | undefined): string[] {
  return (value ?? '').split(/[,;\n\r]/).map((entry) => entry.trim()).filter((entry) => entry.length > 0)
}

/**
 * Reads the analytics settings from the published environment values.
 *
 * @param environmentValues - `metaData.environmentValues` (v1 publishes only analytics settings).
 * @returns The settings, or null when nothing is configured (analytics stays off).
 */
export function analyticsSettings(environmentValues: Record<string, string> | undefined): AnalyticsSettings | null {
  if (!environmentValues || Object.keys(environmentValues).length === 0) return null
  const configured = parseList(environmentValues.ANALYTICS_PROVIDERS).map((name) => name.toLowerCase())
  return {
    environmentValues,
    providers: [...new Set(configured.length > 0 ? configured : DEFAULT_ANALYTICS_PROVIDERS)],
    pluginScripts: parseList(environmentValues.ANALYTICS_PLUGIN_SCRIPTS || environmentValues.ANALYTICS_PLUGIN_SCRIPT_URLS),
    identifyUsers: environmentValues.ANALYTICS_IDENTIFY_USERS === 'true',
    includeRecordData: environmentValues.ANALYTICS_INCLUDE_RECORD_DATA === 'true',
  }
}

/**
 * The page view providers receive: by default the record id in the path becomes `:id` and
 * the query string is dropped.
 *
 * @param model - The page view as recorded.
 * @param includeRecordData - Whether record data is allowed.
 * @returns The page view to send.
 */
export function safePageView(model: PageView, includeRecordData: boolean): SafePageView {
  if (includeRecordData) return { location: { pathname: model.location.pathname, search: model.location.search ?? '' }, title: model.title }
  const segments = model.location.pathname.split('/')
  const recordId = model.recordId === undefined ? undefined : String(model.recordId)
  const pathname = recordId === undefined
    ? model.location.pathname
    // `/app/{slug}/{id}/...`: never the app or slug segments
    : segments.map((segment, index) => (index >= 3 && safeDecode(segment) === recordId ? ':id' : segment)).join('/')
  return { location: { pathname, search: '' }, title: model.title }
}

/**
 * The event providers receive: the record label only when record data is allowed.
 *
 * @param model - The event as recorded.
 * @param includeRecordData - Whether record data is allowed.
 * @returns The event to send.
 */
export function safeEvent(model: UserEvent, includeRecordData: boolean): UserEvent {
  const label = includeRecordData && model.recordLabel ? `${model.label ?? ''} / ${model.recordLabel}` : model.label
  return { action: model.action, category: model.category, ...(label === undefined ? {} : { label }) }
}

/**
 * The session values providers receive. By default only the application's own analytics
 * identity values (`analyticsValues`, or the deprecated `googleAnalyticsValues`); with
 * ANALYTICS_IDENTIFY_USERS=true the whole session, as Material passes it.
 *
 * @param sessionValues - The session values from sign-in.
 * @param identifyUsers - Whether user identity may be sent.
 * @returns The values to pass, or null when there are none.
 */
export function safeSessionValues(sessionValues: Record<string, unknown> | null, identifyUsers: boolean): Record<string, unknown> | null {
  if (!sessionValues) return null
  if (identifyUsers) return sessionValues
  const identity = analyticsIdentityValues(sessionValues)
  return Object.keys(identity).length > 0 ? { analyticsValues: identity } : null
}

/**
 * Material's identity values: `analyticsValues`, falling back to `googleAnalyticsValues`.
 *
 * @param sessionValues - Session values.
 * @returns The identity values (possibly empty).
 */
export function analyticsIdentityValues(sessionValues: Record<string, unknown> | null): Record<string, unknown> {
  const values = sessionValues?.analyticsValues ?? sessionValues?.googleAnalyticsValues
  return values && typeof values === 'object' && !Array.isArray(values) ? values as Record<string, unknown> : {}
}

/**
 * Decodes a path segment, keeping it when it is not valid percent-encoding.
 *
 * @param segment - A path segment.
 * @returns The decoded segment.
 */
function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}
