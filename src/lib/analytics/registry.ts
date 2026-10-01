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
 * @file The `window.QQQAnalytics` provider registry (QRun-IO/qqq#730), the same API as the
 * Material Dashboard's AnalyticsPluginRegistry: plugin scripts register their providers here.
 */

import type { AnalyticsProvider } from './types'

/** Creates a provider instance. */
export type AnalyticsProviderFactory = () => AnalyticsProvider

/** The registry API (`window.QQQAnalytics`). */
export interface AnalyticsPluginRegistryApi {
  register(name: string, providerFactory: AnalyticsProviderFactory): void
  unregister(name: string): void
  has(name: string): boolean
  create(name: string): AnalyticsProvider | null
  list(): string[]
}

declare global {
  interface Window {
    QQQAnalytics?: AnalyticsPluginRegistryApi
  }
}

/**
 * Normalizes a provider name (case-insensitive, trimmed).
 *
 * @param name - The name.
 * @returns The key.
 */
function normalizeName(name: string): string {
  return (name ?? '').trim().toLowerCase()
}

/**
 * Creates an empty registry.
 *
 * @returns A registry with no providers.
 */
export function createAnalyticsRegistry(): AnalyticsPluginRegistryApi {
  const factories = new Map<string, AnalyticsProviderFactory>()
  return {
    register(name, providerFactory) {
      const key = normalizeName(name)
      if (!key) throw new Error('Analytics provider name must be non-empty.')
      if (typeof providerFactory !== 'function') throw new Error(`Analytics provider [${key}] must be registered with a factory function.`)
      factories.set(key, providerFactory)
    },
    unregister(name) {
      factories.delete(normalizeName(name))
    },
    has(name) {
      return factories.has(normalizeName(name))
    },
    create(name) {
      const factory = factories.get(normalizeName(name))
      return factory ? factory() : null
    },
    list() {
      return [...factories.keys()].sort()
    },
  }
}

/**
 * The global registry, created on first use (only when analytics is configured).
 *
 * @returns `window.QQQAnalytics`.
 */
export function getAnalyticsRegistry(): AnalyticsPluginRegistryApi {
  if (!window.QQQAnalytics) window.QQQAnalytics = createAnalyticsRegistry()
  return window.QQQAnalytics
}
