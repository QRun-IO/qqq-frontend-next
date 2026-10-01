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
 * @file Analytics models and the provider contract (QRun-IO/qqq#730), compatible with the
 * Material Dashboard's AnalyticsProviderInterface so its plugin providers keep working.
 */

/** A screen the user opened. */
export interface PageView {
  /** Where: the path (and query string, only when record data is allowed). */
  location: { pathname: string; search?: string }
  /** The screen title, from metadata labels (for example `View: Person`). */
  title: string
  /** The record id in the path, which is replaced by `:id` unless record data is allowed. */
  recordId?: string
}

/** Something the user did. */
export interface UserEvent {
  action: string
  category: string
  /** A metadata label (table, app, process or step). */
  label?: string
  /** The record's label, appended to the label only when record data is allowed. */
  recordLabel?: string
}

/** What a caller records. */
export type AnalyticsModel = PageView | UserEvent

/**
 * The metadata a provider is initialized with: the published environment values as a Map,
 * the shape the Material Dashboard passes (`metaData.environmentValues.get(...)`).
 */
export interface AnalyticsMetaData {
  environmentValues: Map<string, string>
}

/** A provider: GA4, PostHog, or one an application registers through `window.QQQAnalytics`. */
export interface AnalyticsProvider {
  initialize(metaData: AnalyticsMetaData, sessionValues: Record<string, unknown> | null): void
  record(model: AnalyticsModel): void
  reset(): void
  /** Built-in providers: identify the user again after a new sign-in. */
  identify?(sessionValues: Record<string, unknown> | null): void
}

/** The page view and event shapes providers receive (already made privacy-safe). */
export interface SafePageView {
  location: { pathname: string; search: string }
  title: string
}
