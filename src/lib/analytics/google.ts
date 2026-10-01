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
 * @file Google Analytics 4 provider (QRun-IO/qqq#730), active when GOOGLE_ANALYTICS_ENABLED is
 * "true" and GOOGLE_ANALYTICS_TRACKING_ID is set (as in the Material Dashboard).
 *
 * gtag.js reports the document URL, title and referrer with every hit unless told otherwise,
 * so the provider sets page_location, page_title and page_referrer itself, from the page views
 * it receives (which carry no record data by default), and turns Google signals off.
 */

import { analyticsIdentityValues } from './privacy'
import { loadScript } from './load-script'
import type { AnalyticsMetaData, AnalyticsModel, AnalyticsProvider } from './types'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

/** Where gtag.js is served from. */
export const GTAG_SCRIPT_URL = 'https://www.googletagmanager.com/gtag/js'

const TRACKING_ID = /^[A-Za-z0-9-]{2,40}$/

/** The GA4 provider. */
export class GoogleAnalyticsProvider implements AnalyticsProvider {
  private active = false
  private lastLocation = ''

  /**
   * Starts gtag.js when GA4 is enabled and configured.
   *
   * @param metaData - Published environment values.
   * @param sessionValues - Session values (identity values only, unless identity is allowed).
   */
  initialize(metaData: AnalyticsMetaData, sessionValues: Record<string, unknown> | null): void {
    const values = metaData.environmentValues
    const trackingId = values.get('GOOGLE_ANALYTICS_TRACKING_ID')?.trim()
    if (values.get('GOOGLE_ANALYTICS_ENABLED') !== 'true' || !trackingId || !TRACKING_ID.test(trackingId)) {
      this.active = false
      return
    }
    this.active = true
    window.dataLayer = window.dataLayer ?? []
    if (!window.gtag) {
      window.gtag = function gtag() {
        // gtag.js reads Arguments objects from the data layer, not arrays
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer?.push(arguments)
      }
    }
    this.lastLocation = `${window.location.origin}/`
    window.gtag('js', new Date())
    window.gtag('config', trackingId, {
      send_page_view: false,
      page_location: this.lastLocation,
      page_referrer: this.lastLocation,
      page_title: '',
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    })
    void loadScript(`${GTAG_SCRIPT_URL}?id=${encodeURIComponent(trackingId)}`, { id: 'qqq-gtag-js' }).catch((error: unknown) => console.warn(String(error)))
    this.identify(sessionValues)
  }

  /**
   * Sets the application's identity values as GA4 user properties.
   *
   * @param sessionValues - Session values as passed to providers.
   */
  identify(sessionValues: Record<string, unknown> | null): void {
    if (!this.active) return
    const identity = analyticsIdentityValues(sessionValues)
    if (Object.keys(identity).length > 0) window.gtag?.('set', 'user_properties', identity)
  }

  /**
   * Sends a page view or an event.
   *
   * @param model - The (privacy-safe) model.
   */
  record(model: AnalyticsModel): void {
    if (!this.active || !window.gtag) return
    if ('location' in model) {
      const location = `${window.location.origin}${model.location.pathname}${model.location.search ?? ''}`
      window.gtag('set', { page_location: location, page_referrer: this.lastLocation, page_title: model.title })
      window.gtag('event', 'page_view', { page_location: location, page_title: model.title })
      this.lastLocation = location
    } else {
      window.gtag('event', model.action, { event_category: model.category, ...(model.label === undefined ? {} : { event_label: model.label }) })
    }
  }

  /** Nothing to reset for GA4 (as in Material). */
  reset(): void {
    // no-op
  }
}
