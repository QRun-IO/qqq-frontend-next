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
 * @file RecordDeveloperView page — serves `/app/[slug]/[recordId]/dev`. The view (record header,
 * fields, API access, developer panels, relations, audit, scripts, JSON and table metadata) is
 * loaded on demand, as the record view is, so the route's first-load JavaScript stays small.
 */

'use client'

import React, { lazy, Suspense } from 'react'

const RecordDeveloperView = lazy(() => import('@/components/developer/RecordDeveloperView').then((module) => ({ default: module.RecordDeveloperView })))

/**
 * Renders the record developer view once its code has loaded.
 *
 * @returns The view, with a loading status meanwhile.
 */
export default function RecordDeveloperViewPage() {
  return (
    <Suspense fallback={<div role="status" aria-label="Loading developer view" className="py-12 text-center">Loading developer view…</div>}>
      <RecordDeveloperView />
    </Suspense>
  )
}
