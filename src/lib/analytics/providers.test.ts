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

import { afterEach, describe, expect, it } from 'vitest'

import { GoogleAnalyticsProvider } from './google'
import { buildPostHogScriptUrl, PostHogAnalyticsProvider } from './posthog'

const env = (values: Record<string, string | undefined>) => ({
  environmentValues: new Map(Object.entries(values).filter((entry): entry is [string, string] => entry[1] !== undefined)),
})

afterEach(() => {
  delete window.dataLayer
  delete window.gtag
  delete window.posthog
  document.head.querySelectorAll('script').forEach((script) => script.remove())
})

/** The gtag commands in the data layer, as arrays. */
function commands(): unknown[][] {
  return (window.dataLayer ?? []).map((entry) => Array.from(entry as ArrayLike<unknown>))
}

describe('GoogleAnalyticsProvider', () => {
  it('stays inactive unless enabled with a tracking id', () => {
    for (const values of [{}, { GOOGLE_ANALYTICS_ENABLED: 'true' }, { GOOGLE_ANALYTICS_TRACKING_ID: 'G-1' }, { GOOGLE_ANALYTICS_ENABLED: 'yes', GOOGLE_ANALYTICS_TRACKING_ID: 'G-1' }, { GOOGLE_ANALYTICS_ENABLED: 'true', GOOGLE_ANALYTICS_TRACKING_ID: 'G-1"><x' }]) {
      const provider = new GoogleAnalyticsProvider()
      provider.initialize(env(values), null)
      provider.record({ category: 'c', action: 'a' })
    }
    expect(window.dataLayer).toBeUndefined()
    expect(document.getElementById('qqq-gtag-js')).toBeNull()
  })

  it('loads gtag.js and sends page views with its own location, title and referrer', () => {
    const provider = new GoogleAnalyticsProvider()
    provider.initialize(env({ GOOGLE_ANALYTICS_ENABLED: 'true', GOOGLE_ANALYTICS_TRACKING_ID: 'G-QRUN' }), { analyticsValues: { client_id: 'c-1' } })
    expect(document.getElementById('qqq-gtag-js')?.getAttribute('src')).toBe('https://www.googletagmanager.com/gtag/js?id=G-QRUN')
    provider.record({ location: { pathname: '/app/person/:id', search: '' }, title: 'View: Person' })
    provider.record({ category: 'tableEvents', action: 'export', label: 'Person' })
    const origin = window.location.origin
    expect(commands()).toEqual([
      ['js', expect.any(Date)],
      ['config', 'G-QRUN', { send_page_view: false, page_location: `${origin}/`, page_referrer: `${origin}/`, page_title: '', allow_google_signals: false, allow_ad_personalization_signals: false }],
      ['set', 'user_properties', { client_id: 'c-1' }],
      ['set', { page_location: `${origin}/app/person/:id`, page_referrer: `${origin}/`, page_title: 'View: Person' }],
      ['event', 'page_view', { page_location: `${origin}/app/person/:id`, page_title: 'View: Person' }],
      ['event', 'export', { event_category: 'tableEvents', event_label: 'Person' }],
    ])
  })
})

describe('PostHogAnalyticsProvider', () => {
  it('builds the library URL like Material', () => {
    expect(buildPostHogScriptUrl('https://us.i.posthog.com', 'https://app')).toBe('https://us-assets.i.posthog.com/static/array.js')
    expect(buildPostHogScriptUrl('https://i.posthog.com', 'https://app')).toBe('https://assets.i.posthog.com/static/array.js')
    expect(buildPostHogScriptUrl('http://127.0.0.1:9000/', 'https://app')).toBe('http://127.0.0.1:9000/static/array.js')
    expect(buildPostHogScriptUrl('/ingest', 'https://app')).toBe('https://app/ingest/static/array.js')
    expect(buildPostHogScriptUrl('https://ph.example/static/array.js?x=1', 'https://app')).toBe('https://ph.example/static/array.js')
  })

  it('stays inactive unless enabled with a key', () => {
    const provider = new PostHogAnalyticsProvider()
    provider.initialize(env({ POSTHOG_API_KEY: 'phc_1' }), null)
    provider.record({ category: 'c', action: 'a' })
    provider.reset()
    expect(window.posthog).toBeUndefined()
  })

  it('initializes with capture off by default and rewrites its URL properties', () => {
    const provider = new PostHogAnalyticsProvider()
    provider.initialize(env({ POSTHOG_ENABLED: 'true', POSTHOG_PROJECT_API_KEY: 'phc_1', POSTHOG_HOST: 'http://127.0.0.1:9000' }), { analyticsValues: { user_id: 'u-1', client_name: 'Acme' } })
    const script = document.getElementById('qqq-posthog-js') as HTMLScriptElement
    expect(script.src).toBe('http://127.0.0.1:9000/static/array.js')
    expect(script.crossOrigin).toBe('anonymous')
    const queue = window.posthog as unknown as unknown[][]
    const [token, config] = (window.posthog?._i as unknown[][])[0] as [string, Record<string, unknown>]
    expect(token).toBe('phc_1')
    expect(config).toMatchObject({ api_host: 'http://127.0.0.1:9000', capture_pageview: false, capture_pageleave: false, autocapture: false, disable_session_recording: true, mask_all_text: true })
    expect(queue.find((entry) => entry[0] === 'identify')).toEqual(['identify', 'u-1', { user_id: 'u-1', client: 'Acme', client_name: 'Acme' }])

    provider.record({ location: { pathname: '/app/person/:id', search: '' }, title: 'View: Person' })
    const sanitize = config.sanitize_properties as (properties: Record<string, unknown>) => Record<string, unknown>
    expect(sanitize({ $current_url: 'http://localhost:3000/app/person/42?filter=x', $pathname: '/app/person/42', $referrer: 'https://idp.example/cb?code=secret', $title: 'Darin Kelkhoff', token: 'phc_1' }))
      .toEqual({ $current_url: `${window.location.origin}/app/person/:id`, $pathname: '/app/person/:id', $referrer: 'https://idp.example', token: 'phc_1' })
    provider.record({ category: 'tableEvents', action: 'query', label: 'Person' })
    provider.reset()
    expect(queue.filter((entry) => typeof entry[0] === 'string' && ['capture', 'reset'].includes(entry[0] as string))).toEqual([
      ['capture', '$pageview', { path: '/app/person/:id', search: '', title: 'View: Person' }],
      ['capture', 'query', { category: 'tableEvents', label: 'Person' }],
      ['reset'],
    ])
  })

  it('identifies nobody without an id, and uses the session user only when it is passed', () => {
    const provider = new PostHogAnalyticsProvider()
    provider.initialize(env({ POSTHOG_ENABLED: 'true', POSTHOG_API_KEY: 'phc_1' }), null)
    const queue = window.posthog as unknown as unknown[][]
    expect(queue.some((entry) => entry[0] === 'identify')).toBe(false)
    provider.identify({ user: { id: 7, email: 'a@b.c', name: 'A' } })
    expect(queue.find((entry) => entry[0] === 'identify')).toEqual(['identify', '7', { user_id: 7, email: 'a@b.c', name: 'A' }])
  })
})
