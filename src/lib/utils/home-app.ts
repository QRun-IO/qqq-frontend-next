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
 * @file home-app — the instance's home page: the dashboard of the app the backend designates
 * as its home (`homeAppName`, QRun-IO/qqq#1059), or Next's own overview at `/app`.
 */

import type { QInstance } from '@/types'

/** Next's own overview page, the home when the instance designates no home app. */
export const DEFAULT_HOME_PATH = '/app'

/**
 * The instance's home app, when the backend designates one the user may open.
 *
 * The backend publishes `homeAppName` only to users who may access that app; it is also checked
 * against the apps in the metadata, so an older or inconsistent backend never sends the user to
 * an app that is not there.
 *
 * @param instance - Instance metadata, or undefined while loading.
 * @returns The app name, or undefined.
 */
export function homeAppName(instance: Pick<QInstance, 'homeAppName' | 'apps'> | undefined): string | undefined {
  const name = instance?.homeAppName
  return typeof name === 'string' && name !== '' && instance?.apps?.[name] ? name : undefined
}

/**
 * Where "home" goes (the sidebar logo, the breadcrumb root, `/app` itself): the home app's
 * dashboard, or Next's overview.
 *
 * @param instance - Instance metadata, or undefined while loading.
 * @returns `/app/{homeApp}` or `/app`.
 */
export function homePath(instance: Pick<QInstance, 'homeAppName' | 'apps'> | undefined): string {
  const name = homeAppName(instance)
  return name ? `${DEFAULT_HOME_PATH}/${encodeURIComponent(name)}` : DEFAULT_HOME_PATH
}
