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
 * @file WidgetNotice / WidgetEmpty — contained messages inside a widget body.
 */
'use client'

import React from 'react'
import { AlertTriangle } from 'lucide-react'

/**
 * A contained warning shown in place of widget content whose payload has an
 * unexpected shape. Rendered instead of throwing so neighbors stay healthy and no
 * console error is logged.
 *
 * @param props - Notice properties.
 * @param props.widgetName - Widget name, for `data-qqq-id` scoping.
 * @param props.message - Human-readable explanation.
 * @returns The rendered notice.
 */
export function WidgetPayloadNotice({ widgetName, message }: { widgetName: string; message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
      data-qqq-id={`widget-payload-notice-${widgetName}`}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}

/**
 * A neutral empty-state message for a widget whose payload is valid but has no data.
 *
 * @param props - Empty-state properties.
 * @param props.widgetName - Widget name, for `data-qqq-id` scoping.
 * @param props.children - The message (plain text).
 * @returns The rendered empty state.
 */
export function WidgetEmpty({ widgetName, children }: { widgetName: string; children: React.ReactNode }) {
  return (
    <p className="py-4 text-center text-sm text-muted-foreground" data-qqq-id={`widget-empty-${widgetName}`}>
      {children}
    </p>
  )
}
