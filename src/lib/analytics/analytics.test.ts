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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AnalyticsManager } from './analytics'
import { analyticsSettings, parseList, safeEvent, safePageView, safeSessionValues } from './privacy'
import { createAnalyticsRegistry, getAnalyticsRegistry } from './registry'
import type { AnalyticsModel, AnalyticsProvider } from './types'

/** A provider that remembers what it was given. */
class RecordingProvider implements AnalyticsProvider {
  static instances: RecordingProvider[] = []
  initialized: { environmentValues: Map<string, string>; sessionValues: Record<string, unknown> | null } | null = null
  records: AnalyticsModel[] = []
  resets = 0
  identified: (Record<string, unknown> | null)[] = []
  constructor() { RecordingProvider.instances.push(this) }
  initialize(metaData: { environmentValues: Map<string, string> }, sessionValues: Record<string, unknown> | null) { this.initialized = { environmentValues: metaData.environmentValues, sessionValues } }
  record(model: AnalyticsModel) { this.records.push(model) }
  reset() { this.resets++ }
  identify(sessionValues: Record<string, unknown> | null) { this.identified.push(sessionValues) }
}

const SESSION = { user: { name: 'Alice (sample)', email: 'sample:alice' }, analyticsValues: { user_id: 'u-1', client_name: 'Acme' } }

beforeEach(() => {
  RecordingProvider.instances = []
  delete window.QQQAnalytics
  getAnalyticsRegistry().register('owned', () => new RecordingProvider())
})

afterEach(() => {
  delete window.QQQAnalytics
  vi.restoreAllMocks()
})

describe('analytics settings and privacy', () => {
  it('is off without published values and lists providers like Material', () => {
    expect(analyticsSettings(undefined)).toBeNull()
    expect(analyticsSettings({})).toBeNull()
    expect(analyticsSettings({ POSTHOG_ENABLED: 'true' })?.providers).toEqual(['google', 'posthog'])
    expect(analyticsSettings({ ANALYTICS_PROVIDERS: 'Owned, google;owned\nposthog' })?.providers).toEqual(['owned', 'google', 'posthog'])
    expect(analyticsSettings({ ANALYTICS_PLUGIN_SCRIPT_URLS: 'https://a/x.js' })?.pluginScripts).toEqual(['https://a/x.js'])
    expect(analyticsSettings({ ANALYTICS_PLUGIN_SCRIPTS: '/p.js', ANALYTICS_PLUGIN_SCRIPT_URLS: 'https://a/x.js' })?.pluginScripts).toEqual(['/p.js'])
    expect(parseList(' a ,, b ')).toEqual(['a', 'b'])
  })

  it('removes record ids, query strings and record labels unless record data is allowed', () => {
    const view = { location: { pathname: '/app/person/42/edit', search: '?filter=%7B%22x%22%3A1%7D' }, title: 'Edit: Person', recordId: '42' }
    expect(safePageView(view, false)).toEqual({ location: { pathname: '/app/person/:id/edit', search: '' }, title: 'Edit: Person' })
    expect(safePageView(view, true)).toEqual({ location: { pathname: '/app/person/42/edit', search: '?filter=%7B%22x%22%3A1%7D' }, title: 'Edit: Person' })
    expect(safePageView({ location: { pathname: '/app/42/42' }, title: 'View: T', recordId: '42' }, false).location.pathname).toBe('/app/42/:id')
    expect(safePageView({ location: { pathname: '/app/person/a%20b' }, title: 'View: P', recordId: 'a b' }, false).location.pathname).toBe('/app/person/:id')
    const event = { category: 'tableEvents', action: 'view', label: 'Person', recordLabel: 'Darin Kelkhoff' }
    expect(safeEvent(event, false)).toEqual({ category: 'tableEvents', action: 'view', label: 'Person' })
    expect(safeEvent(event, true)).toEqual({ category: 'tableEvents', action: 'view', label: 'Person / Darin Kelkhoff' })
  })

  it('passes only the application identity values unless user identity is allowed', () => {
    expect(safeSessionValues(SESSION, false)).toEqual({ analyticsValues: { user_id: 'u-1', client_name: 'Acme' } })
    expect(safeSessionValues({ user: SESSION.user, googleAnalyticsValues: { a: 1 } }, false)).toEqual({ analyticsValues: { a: 1 } })
    expect(safeSessionValues({ user: SESSION.user }, false)).toBeNull()
    expect(safeSessionValues(SESSION, true)).toBe(SESSION)
    expect(safeSessionValues(null, true)).toBeNull()
  })
})

describe('window.QQQAnalytics registry', () => {
  it('registers, creates and lists providers case-insensitively', () => {
    const registry = createAnalyticsRegistry()
    registry.register(' Owned ', () => new RecordingProvider())
    expect(registry.has('OWNED')).toBe(true)
    expect(registry.create('owned')).toBeInstanceOf(RecordingProvider)
    expect(registry.create('missing')).toBeNull()
    expect(registry.list()).toEqual(['owned'])
    registry.unregister('owned')
    expect(registry.list()).toEqual([])
    expect(() => registry.register(' ', () => new RecordingProvider())).toThrow('non-empty')
    expect(() => registry.register('x', null as unknown as () => AnalyticsProvider)).toThrow('factory function')
  })
})

describe('AnalyticsManager', () => {
  it('stays off (no registry, nothing sent) when nothing is configured', async () => {
    delete window.QQQAnalytics
    const manager = new AnalyticsManager()
    manager.record({ category: 'globalEvents', action: 'early' })
    await manager.configure(undefined, SESSION)
    manager.record({ category: 'globalEvents', action: 'dotMenuKeyboardShortcut' })
    expect(window.QQQAnalytics).toBeUndefined()
    expect(RecordingProvider.instances).toHaveLength(0)
  })

  it('initializes the configured providers with safe session values and flushes what was queued', async () => {
    const manager = new AnalyticsManager()
    manager.record({ location: { pathname: '/app/person/7', search: '?x=1' }, title: 'View: Person', recordId: '7' })
    await manager.configure({ ANALYTICS_PROVIDERS: 'owned', ANALYTICS_CUSTOM: 'v' }, SESSION)
    manager.record({ category: 'tableEvents', action: 'delete', label: 'Person', recordLabel: 'Darin' })
    const [provider] = RecordingProvider.instances
    expect(provider.initialized?.environmentValues.get('ANALYTICS_CUSTOM')).toBe('v')
    expect(provider.initialized?.sessionValues).toEqual({ analyticsValues: { user_id: 'u-1', client_name: 'Acme' } })
    expect(provider.records).toEqual([
      { location: { pathname: '/app/person/:id', search: '' }, title: 'View: Person' },
      { category: 'tableEvents', action: 'delete', label: 'Person' },
    ])
  })

  it('sends record data and the whole session only when the application allows them', async () => {
    const manager = new AnalyticsManager()
    await manager.configure({ ANALYTICS_PROVIDERS: 'owned', ANALYTICS_INCLUDE_RECORD_DATA: 'true', ANALYTICS_IDENTIFY_USERS: 'true' }, SESSION)
    manager.record({ category: 'tableEvents', action: 'view', label: 'Person', recordLabel: 'Darin' })
    const [provider] = RecordingProvider.instances
    expect(provider.initialized?.sessionValues).toBe(SESSION)
    expect(provider.records).toEqual([{ category: 'tableEvents', action: 'view', label: 'Person / Darin' }])
  })

  it('resets providers on sign-out and identifies the next user', async () => {
    const manager = new AnalyticsManager()
    await manager.configure({ ANALYTICS_PROVIDERS: 'owned' }, SESSION)
    manager.reset()
    await manager.configure({ ANALYTICS_PROVIDERS: 'owned' }, { analyticsValues: { user_id: 'u-2' } })
    const [provider] = RecordingProvider.instances
    expect(RecordingProvider.instances).toHaveLength(1)
    expect(provider.resets).toBe(1)
    expect(provider.identified).toEqual([{ analyticsValues: { user_id: 'u-2' } }])
  })

  it('skips missing or broken providers without breaking the others', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    getAnalyticsRegistry().register('broken', () => ({ initialize: () => { throw new Error('boom') }, record: () => undefined, reset: () => undefined }))
    getAnalyticsRegistry().register('incomplete', () => ({ initialize: () => undefined } as unknown as AnalyticsProvider))
    const manager = new AnalyticsManager()
    await manager.configure({ ANALYTICS_PROVIDERS: 'missing,broken,incomplete,owned' }, null)
    manager.record({ category: 'c', action: 'a' })
    expect(RecordingProvider.instances[0].records).toEqual([{ category: 'c', action: 'a' }])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[missing]'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[incomplete]'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('initializing'), expect.any(Error))
  })

  it('loads plugin scripts before creating providers', async () => {
    const appended: HTMLScriptElement[] = []
    vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      const script = node as HTMLScriptElement
      appended.push(script)
      getAnalyticsRegistry().register('plugin', () => new RecordingProvider())
      setTimeout(() => script.onload?.(new Event('load')), 0)
      return node
    })
    const manager = new AnalyticsManager()
    await manager.configure({ ANALYTICS_PROVIDERS: 'plugin', ANALYTICS_PLUGIN_SCRIPTS: 'https://plugins.example/analytics.js' }, null)
    expect(appended.map((script) => [script.src, script.crossOrigin])).toEqual([['https://plugins.example/analytics.js', 'anonymous']])
    expect(RecordingProvider.instances).toHaveLength(1)
  })
})
