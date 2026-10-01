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
 * @file Hook for the dashboard layout: configures analytics after sign-in and records a page
 * view (and Material's opening events) for each screen (QRun-IO/qqq#730).
 */

'use client'

import { useEffect } from 'react'

import type { QInstance } from '@/types'
import { getStoredSessionValues } from '@/lib/auth/auth-storage'
import { analytics, recordAnalytics } from './analytics'
import { screenAnalytics } from './page-views'

/**
 * Configures analytics once metadata is loaded and records each screen's page view.
 *
 * @param metaData - Instance metadata (undefined while loading).
 * @param pathname - The current route path.
 * @param signedInAs - The signed-in identity, so a new sign-in identifies the new user.
 */
export function useAnalytics(metaData: QInstance | undefined, pathname: string, signedInAs: string | undefined): void {
  useEffect(() => {
    if (!metaData) return
    void analytics.configure(metaData.environmentValues, getStoredSessionValues())
  }, [metaData, signedInAs])

  useEffect(() => {
    if (!metaData) return
    const screen = screenAnalytics(pathname, window.location.search, metaData)
    if (!screen) return
    recordAnalytics(screen.pageView)
    for (const event of screen.events) recordAnalytics(event)
  }, [metaData, pathname])
}
