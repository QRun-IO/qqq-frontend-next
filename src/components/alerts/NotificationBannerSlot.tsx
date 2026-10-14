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
 * @file NotificationBannerSlot — shows sticky notifications (the summary's `banners`) above the
 * page until dismissed. It shares the bell's summary query, so it sends nothing of its own and
 * nothing at all unless the version announces Alerts; the banner UI loads only when there is
 * a banner to show.
 */

'use client'

import React, { Suspense, lazy } from 'react'

import type { QInstance } from '@/types/metadata'
import { useAlertsInstalled, useAlertsInbox } from './AlertsBell'

const NotificationBanners = lazy(() => import('./NotificationBanners'))

/**
 * The banner slot.
 *
 * @param props - `metaData`: instance metadata; `enabled`: the user is signed in.
 * @returns The banners, or null.
 */
export function NotificationBannerSlot({ enabled }: { metaData: QInstance | undefined; enabled: boolean }) {
  const installed = useAlertsInstalled()
  const { data } = useAlertsInbox(enabled && installed)
  if (!data?.banners.length) return null
  return (
    <Suspense fallback={null}>
      <NotificationBanners banners={data.banners} />
    </Suspense>
  )
}
