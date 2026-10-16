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

/** @file What's new route, split from the dashboard's first load. */

'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

/** The page loads on demand, so its code stays out of every route's first load. */
const WhatsNewPage = dynamic(() => import('@/components/release-notes/WhatsNewPage').then((module) => module.WhatsNewPage), {
  ssr: false,
  loading: () => (
    <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground" role="status" data-qqq-id="whats-new-page-loading">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      Loading release notes...
    </p>
  ),
})

/**
 * Renders the whats-new page at `/app/whats-new`.
 *
 * @returns The page.
 */
export default function WhatsNewRoute() {
  return <WhatsNewPage />
}
