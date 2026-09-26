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
 * @file The analytics facade (QRun-IO/qqq#730; Material's AnalyticsUtils). Configured after
 * sign-in from the published environment values; off when there are none. Every model is made
 * privacy-safe here, before any provider (built-in or plugin) sees it.
 */

import { GoogleAnalyticsProvider } from './google'
import { loadScript } from './load-script'
import { PostHogAnalyticsProvider } from './posthog'
import { analyticsSettings, safeEvent, safePageView, safeSessionValues, type AnalyticsSettings } from './privacy'
import { getAnalyticsRegistry } from './registry'
import type { AnalyticsModel, AnalyticsProvider } from './types'

/** Models recorded before configuration finishes are kept up to this many. */
const MAX_QUEUED = 100

type State = 'unconfigured' | 'off' | 'starting' | 'on'

/**
 * Whether an object implements the provider contract.
 *
 * @param provider - A registered provider instance.
 * @returns True when it has initialize, record and reset.
 */
function isValidProvider(provider: AnalyticsProvider | null): provider is AnalyticsProvider {
  return Boolean(provider) && typeof provider?.initialize === 'function' && typeof provider.record === 'function' && typeof provider.reset === 'function'
}

/** The analytics facade; use the {@link analytics} singleton. */
export class AnalyticsManager {
  private state: State = 'unconfigured'
  private settings: AnalyticsSettings | null = null
  private providers: AnalyticsProvider[] = []
  private queue: AnalyticsModel[] = []
  private setup: Promise<void> | null = null

  /**
   * Configures analytics for the signed-in session. Nothing is loaded or sent when the backend
   * publishes no analytics settings. Called again after a new sign-in, it identifies the new
   * user with the providers already running.
   *
   * @param environmentValues - `metaData.environmentValues`.
   * @param sessionValues - The session values from sign-in.
   * @returns A promise settled when the providers are ready.
   */
  configure(environmentValues: Record<string, string> | undefined, sessionValues: Record<string, unknown> | null): Promise<void> {
    if (this.state === 'starting' || this.state === 'on') {
      const settings = this.settings
      return (this.setup ?? Promise.resolve()).then(() => {
        const values = settings ? safeSessionValues(sessionValues, settings.identifyUsers) : null
        for (const provider of this.providers) this.safely('identifying the user with', provider, () => provider.identify?.(values))
      })
    }
    const settings = analyticsSettings(environmentValues)
    if (!settings) {
      this.state = 'off'
      this.queue = []
      return Promise.resolve()
    }
    this.settings = settings
    this.state = 'starting'
    this.setup = this.start(settings, sessionValues)
    return this.setup
  }

  /**
   * Records a page view or event (queued until configuration finishes; dropped when off).
   *
   * @param model - What happened.
   */
  record(model: AnalyticsModel): void {
    if (this.state === 'off') return
    if (this.state !== 'on') {
      if (this.queue.length < MAX_QUEUED) this.queue.push(model)
      return
    }
    this.dispatch(model)
  }

  /** Resets the providers' identity (sign-out) and drops anything queued. */
  reset(): void {
    this.queue = []
    for (const provider of this.providers) this.safely('resetting', provider, () => provider.reset())
  }

  /**
   * Loads plugin scripts, creates the configured providers and initializes them.
   *
   * @param settings - The analytics settings.
   * @param sessionValues - The session values from sign-in.
   */
  private async start(settings: AnalyticsSettings, sessionValues: Record<string, unknown> | null): Promise<void> {
    const registry = getAnalyticsRegistry()
    if (!registry.has('google')) registry.register('google', () => new GoogleAnalyticsProvider())
    if (!registry.has('posthog')) registry.register('posthog', () => new PostHogAnalyticsProvider())
    await Promise.all(settings.pluginScripts.map((url) => loadScript(url, { crossOrigin: true }).catch((error: unknown) => console.warn(String(error)))))
    const metaData = { environmentValues: new Map(Object.entries(settings.environmentValues)) }
    const values = safeSessionValues(sessionValues, settings.identifyUsers)
    for (const name of settings.providers) {
      const provider = registry.create(name)
      if (!isValidProvider(provider)) {
        console.warn(`Configured analytics provider [${name}] was not found in the QQQAnalytics registry or does not implement initialize, record and reset.`)
        continue
      }
      if (this.safely('initializing', provider, () => provider.initialize(metaData, values))) this.providers.push(provider)
    }
    this.state = 'on'
    const queued = this.queue
    this.queue = []
    for (const model of queued) this.dispatch(model)
  }

  /**
   * Sends one model, made privacy-safe, to every provider.
   *
   * @param model - What happened.
   */
  private dispatch(model: AnalyticsModel): void {
    const includeRecordData = this.settings?.includeRecordData ?? false
    const safe = 'location' in model ? safePageView(model, includeRecordData) : safeEvent(model, includeRecordData)
    for (const provider of this.providers) this.safely('recording with', provider, () => provider.record(safe))
  }

  /**
   * Runs a provider call; a failing provider never breaks the page or the other providers.
   *
   * @param what - What was being done, for the message.
   * @param provider - The provider.
   * @param call - The call.
   * @returns True when the call succeeded.
   */
  private safely(what: string, provider: AnalyticsProvider, call: () => void): boolean {
    try {
      call()
      return true
    } catch (error) {
      console.warn(`Error ${what} analytics provider ${provider.constructor?.name ?? ''}:`, error)
      return false
    }
  }
}

/** The application's analytics. */
export const analytics = new AnalyticsManager()

/**
 * Records a page view or event (Material's `recordAnalytics`).
 *
 * @param model - What happened.
 */
export function recordAnalytics(model: AnalyticsModel): void {
  analytics.record(model)
}
