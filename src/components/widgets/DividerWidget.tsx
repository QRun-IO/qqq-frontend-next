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
 * @file DividerWidget — Renders a simple horizontal rule separator, optionally with a centered text label.
 */
'use client'

import React from 'react'

/** Wire-format payload for a divider widget returned by the backend API. */
export interface DividerWidgetPayload {
  /** Discriminator field identifying this as a divider widget. */
  type: 'divider'
  /** Optional text label centered within the divider line. */
  label?: string
}

/** Props accepted by the DividerWidget component. */
interface DividerWidgetProps {
  /** Typed payload from the widget API response. */
  data: DividerWidgetPayload
  /** Unique widget name used to scope data-qqq-id attributes. */
  widgetName: string
}

/**
 * Renders a horizontal rule separator.
 *
 * Dispatched by `WidgetRenderer` for `'divider'`-type widgets.  When `data.label`
 * is provided the divider renders the label text centered between two `bg-border`
 * rule lines (using a flex layout with `h-px flex-1` dividers).  Without a label
 * a plain `<hr>` element is rendered.
 *
 * @param props - Component properties; `data.label` determines whether a labeled
 *   or plain divider is rendered.
 * @returns Either a `<div role="separator">` with a centered label or a plain `<hr>`.
 */
export function DividerWidget({ data, widgetName }: DividerWidgetProps) {
  if (data.label) {
    return (
      <div
        className="flex items-center gap-3"
        data-qqq-id={`divider-${widgetName}`}
        role="separator"
        aria-label={data.label}
      >
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium text-muted-foreground">{data.label}</span>
        <div className="h-px flex-1 bg-border" />
      </div>
    )
  }

  return (
    <hr
      className="border-t border-border"
      data-qqq-id={`divider-${widgetName}`}
    />
  )
}
