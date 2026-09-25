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
 * @file SavedView page — placeholder for loading a saved filter/view configuration (Package 2).
 */

'use client'

import React, { useEffect } from 'react'
import { useRouteParams } from '@/lib/hooks/use-route-params'
import { useQContext } from '@/lib/context/q-context'

/**
 * Placeholder page for loading a saved view by `viewId` for the table identified by `slug`.
 *
 * Full implementation is deferred to Package 2. Currently renders a stub card.
 *
 * @returns A placeholder panel indicating the feature is not yet implemented.
 */
export default function SavedViewPage() {
  const params = useRouteParams<{ slug: string; viewId: string }>()
  const { setPageHeader } = useQContext()
  const { slug, viewId } = params

  useEffect(() => {
    setPageHeader(`${slug} — Saved View`)
  }, [slug, setPageHeader])

  return (
    <div data-qqq-id={`saved-view-${slug}-${viewId}`}>
      <div className="rounded-xl border border-dashed border-border bg-muted p-12 text-center">
        <p className="text-muted-foreground">
          Saved view -- implemented in Package 2
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          View ID: <code className="font-mono">{viewId}</code>
        </p>
      </div>
    </div>
  )
}
