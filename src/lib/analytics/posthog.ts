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
 * @file PostHog provider (QRun-IO/qqq#730), active when POSTHOG_ENABLED is "true" and
 * POSTHOG_API_KEY (or POSTHOG_PROJECT_API_KEY) is set; POSTHOG_HOST defaults to
 * https://us.i.posthog.com (as in the Material Dashboard).
 *
 * posthog-js adds the current URL and referrer to every event and can capture clicks and
 * record sessions, so the provider turns autocapture, page-leave capture and session recording
 * off and rewrites the URL properties to the page views it receives (no record data by default).
 */

import { analyticsIdentityValues } from './privacy'
import type { AnalyticsMetaData, AnalyticsModel, AnalyticsProvider } from './types'

/** The part of the posthog-js API the provider uses (the array stub until the library loads). */
interface PostHogApi {
  __QQQ_POSTHOG_INITIALIZED?: boolean
  __SV?: number
  _i?: unknown[]
  people?: unknown
  push?: (...items: unknown[]) => number
  init?: (token: string, config: Record<string, unknown>, name?: string) => void
  identify?: (distinctId: string, properties?: Record<string, unknown>) => void
  capture?: (event: string, properties?: Record<string, unknown>) => void
  reset?: () => void
  [name: string]: unknown
}

declare global {
  interface Window {
    posthog?: PostHogApi
  }
}

/** The default PostHog host. */
export const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com'

/** posthog-js methods the stub queues until the library has loaded (the PostHog snippet). */
const STUB_METHODS = 'capture identify alias group register register_once unregister unregister_once set_config reset opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing start_session_recording stop_session_recording setPersonPropertiesForFlags onFeatureFlags'.split(' ')

/**
 * Where the PostHog library is served for an API host (Material's buildPostHogScriptUrl):
 * the `-assets` host for PostHog cloud, else `{host}/static/array.js`.
 *
 * @param apiHost - The configured API host.
 * @param origin - This page's origin, for relative hosts.
 * @returns The library URL.
 */
export function buildPostHogScriptUrl(apiHost: string, origin: string): string {
  const scriptUrl = new URL(apiHost, origin)
  const pathname = scriptUrl.pathname.replace(/\/+$/, '')
  if (scriptUrl.hostname.toLowerCase() === 'i.posthog.com') scriptUrl.hostname = 'assets.i.posthog.com'
  else if (scriptUrl.hostname.toLowerCase().endsWith('.i.posthog.com')) scriptUrl.hostname = scriptUrl.hostname.replace(/\.i\.posthog\.com$/i, '-assets.i.posthog.com')
  scriptUrl.hash = ''
  scriptUrl.search = ''
  if (pathname.toLowerCase().endsWith('/static/array.js')) scriptUrl.pathname = pathname
  else if (pathname && pathname !== '/') scriptUrl.pathname = `${pathname}/static/array.js`
  else scriptUrl.pathname = '/static/array.js'
  return scriptUrl.toString()
}

/**
 * Only the origin of a URL (the referrer may hold another page's path and query).
 *
 * @param value - A URL property value.
 * @returns The origin, or the value when it is not a URL.
 */
function originOnly(value: unknown): unknown {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) return value
  try {
    return new URL(value).origin
  } catch {
    return value
  }
}

/** The PostHog provider. */
export class PostHogAnalyticsProvider implements AnalyticsProvider {
  private active = false
  private currentPath = '/'

  /**
   * Starts PostHog when it is enabled and configured.
   *
   * @param metaData - Published environment values.
   * @param sessionValues - Session values (identity values only, unless identity is allowed).
   */
  initialize(metaData: AnalyticsMetaData, sessionValues: Record<string, unknown> | null): void {
    const values = metaData.environmentValues
    const apiKey = values.get('POSTHOG_API_KEY') || values.get('POSTHOG_PROJECT_API_KEY')
    const host = values.get('POSTHOG_HOST') || DEFAULT_POSTHOG_HOST
    if (values.get('POSTHOG_ENABLED') !== 'true' || !apiKey) {
      this.active = false
      return
    }
    this.active = true
    this.initializePostHog(apiKey, host)
    this.identify(sessionValues)
  }

  /**
   * Sends a page view (`$pageview`) or an event.
   *
   * @param model - The (privacy-safe) model.
   */
  record(model: AnalyticsModel): void {
    if (!this.active) return
    if ('location' in model) {
      this.currentPath = `${model.location.pathname}${model.location.search ?? ''}`
      window.posthog?.capture?.('$pageview', { path: model.location.pathname, search: model.location.search ?? '', title: model.title })
    } else {
      window.posthog?.capture?.(model.action, { category: model.category, label: model.label })
    }
  }

  /** Forgets the identified user (sign-out). */
  reset(): void {
    if (this.active) window.posthog?.reset?.()
  }

  /**
   * Identifies the user from the session values it was given (Material's rules, plus the
   * application's own `user_id`/`distinct_id` identity values).
   *
   * @param sessionValues - Session values as passed to providers.
   */
  identify(sessionValues: Record<string, unknown> | null): void {
    if (!this.active) return
    const identity = analyticsIdentityValues(sessionValues)
    const user = (sessionValues?.user && typeof sessionValues.user === 'object' ? sessionValues.user : {}) as Record<string, unknown>
    const userId = user.id || user.userId || identity.user_id || identity.distinct_id
    const email = identity.user_email || user.email || user.idReference
    const name = identity.name || user.name || user.fullName
    const distinctId = userId || email
    if (!distinctId) return
    const properties: Record<string, unknown> = {}
    if (userId) properties.user_id = userId
    if (email) properties.email = email
    if (name) properties.name = name
    if (identity.client_name) {
      properties.client = identity.client_name
      properties.client_name = identity.client_name
    }
    if (identity.client_id) properties.client_id = identity.client_id
    window.posthog?.identify?.(String(distinctId), properties)
  }

  /**
   * The event properties posthog-js sends, with its automatic URL properties replaced by the
   * current (privacy-safe) page.
   *
   * @param properties - The properties posthog-js built.
   * @returns The properties to send.
   */
  sanitizeProperties(properties: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = { ...properties, $current_url: `${window.location.origin}${this.currentPath}`, $pathname: this.currentPath.split('?')[0] }
    for (const key of ['$referrer', '$initial_referrer']) {
      if (key in sanitized) sanitized[key] = originOnly(sanitized[key])
    }
    delete sanitized.$title
    return sanitized
  }

  /**
   * Installs the PostHog snippet (a queueing stub plus the library script) and initializes it.
   *
   * @param apiKey - The project API key.
   * @param apiHost - The API host.
   */
  private initializePostHog(apiKey: string, apiHost: string): void {
    const posthog: PostHogApi = window.posthog ?? ([] as unknown as PostHogApi)
    window.posthog = posthog
    if (posthog.__QQQ_POSTHOG_INITIALIZED) return
    if (!posthog.__SV) {
      posthog.__SV = 1
      posthog._i = posthog._i ?? []
      posthog.people = posthog.people ?? []
      const stub = (target: PostHogApi, method: string) => {
        target[method] = (...args: unknown[]) => { (target as unknown as unknown[]).push([method, ...args]) }
      }
      for (const method of STUB_METHODS) stub(posthog, method)
      posthog.init = (token, config, name) => {
        posthog._i?.push([token, config, name || 'posthog'])
      }
      const script = document.createElement('script')
      script.id = 'qqq-posthog-js'
      script.async = true
      script.crossOrigin = 'anonymous'
      script.type = 'text/javascript'
      script.src = buildPostHogScriptUrl(apiHost, window.location.origin)
      document.head.appendChild(script)
    }
    posthog.init?.(apiKey, {
      api_host: apiHost,
      person_profiles: 'identified_only',
      capture_pageview: false,
      capture_pageleave: false,
      autocapture: false,
      disable_session_recording: true,
      mask_all_text: true,
      mask_all_element_attributes: true,
      session_idle_timeout_seconds: 5 * 60,
      sanitize_properties: (properties: Record<string, unknown>) => this.sanitizeProperties(properties),
    })
    posthog.__QQQ_POSTHOG_INITIALIZED = true
  }
}
