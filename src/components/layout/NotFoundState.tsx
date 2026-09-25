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
 * @file NotFoundState — in-shell "page not found" state for an `/app/{name}` that resolves to nothing.
 */

import React from 'react'
import Link from 'next/link'
import { SearchX } from 'lucide-react'

/** Props for {@link NotFoundState}. */
export interface NotFoundStateProps {
  /** The unresolved URL segment. */
  name: string
}

/**
 * Explains that no app, table, process or report with this name is available to
 * the user (the backend omits objects the user may not access, so a denied
 * object is indistinguishable from a missing one), with a link to the dashboard.
 *
 * @param props - Component properties.
 * @returns The not-found panel.
 */
export function NotFoundState({ name }: NotFoundStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center"
      data-qqq-id="not-found-state"
    >
      <SearchX className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
      <h1 className="text-2xl font-semibold text-foreground">Page not found</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        There is no app, table, process or report named <code className="font-mono text-foreground">{name}</code> that you can open.
      </p>
      <Link
        href="/app"
        className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        data-qqq-id="link-not-found-dashboard"
      >
        Go to the dashboard
      </Link>
    </div>
  )
}
