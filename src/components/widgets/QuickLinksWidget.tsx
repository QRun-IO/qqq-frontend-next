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
 * @file QuickLinksWidget — Renders a divided list of quick-access links with optional descriptions and external-link indicators.
 */
'use client'

import React from 'react'
import { ExternalLink, ChevronRight } from 'lucide-react'

/** A single navigable link entry within a QuickLinks widget. */
export interface QuickLink {
  /** Visible link text. */
  label: string
  /** Destination URL — may be absolute (external) or relative (internal). */
  url: string
  /** Optional secondary description shown below the link label. */
  description?: string
  /** Optional Lucide icon name (currently unused in rendering, reserved for future use). */
  iconName?: string
  /** When true the link opens in a new tab; auto-detected from absolute URLs when omitted. */
  isExternal?: boolean
}

/** Wire-format payload for a quick-links widget returned by the backend API. */
export interface QuickLinksWidgetPayload {
  /** Discriminator field identifying this as a quick-links widget payload. */
  type: 'quickLinks'
  /** Ordered array of link entries to display. */
  links: QuickLink[]
}

/** Props accepted by the QuickLinksWidget component. */
interface QuickLinksWidgetProps {
  /** Typed payload from the widget API response. */
  data: QuickLinksWidgetPayload
  /** Unique widget name used to scope data-qqq-id attributes. */
  widgetName: string
}

/**
 * Renders a divided list of navigable quick-access links.
 *
 * Dispatched by `WidgetRenderer` for `'quickLinks'`-type widgets.  Automatically
 * detects external links (absolute URLs or `link.isExternal === true`) and opens
 * them in a new tab with `rel="noopener noreferrer"`.  Internal links use a
 * `ChevronRight` icon; external links use an `ExternalLink` icon.  Shows an
 * empty-state message when `links` is empty or absent.
 *
 * @param props - Component properties; `data.links` is the ordered array of link
 *   entries — an empty or missing array renders the empty-state message.
 * @returns A `<ul>` of `<a>` link items, or an empty-state `<p>`.
 */
export function QuickLinksWidget({ data, widgetName }: QuickLinksWidgetProps) {
  const { links } = data

  if (!links || links.length === 0) {
    return (
      <p
        className="text-sm text-muted-foreground"
        data-qqq-id={`quick-links-empty-${widgetName}`}
      >
        No links configured
      </p>
    )
  }

  return (
    <ul
      className="divide-y divide-border"
      data-qqq-id={`quick-links-${widgetName}`}
      aria-label="Quick links"
    >
      {links.map((link, idx) => {
        const isExternal = link.isExternal ?? link.url.startsWith('http')
        return (
          <li key={idx}>
            <a
              href={link.url}
              target={isExternal ? '_blank' : undefined}
              rel={isExternal ? 'noopener noreferrer' : undefined}
              className="group flex items-center gap-3 rounded px-2 py-2.5 text-sm text-foreground transition-colors hover:bg-accent hover:text-primary focus:outline-none focus:ring-2 focus:ring-ring"
              data-qqq-id={`quick-link-${widgetName}-${idx}`}
              aria-label={link.isExternal ? `${link.label} (opens in new tab)` : link.label}
            >
              <span className="flex-1">
                <span className="font-medium">{link.label}</span>
                {link.description && (
                  <span className="block text-xs text-muted-foreground">
                    {link.description}
                  </span>
                )}
              </span>
              {isExternal ? (
                <ExternalLink
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary"
                  aria-hidden="true"
                />
              ) : (
                <ChevronRight
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary"
                  aria-hidden="true"
                />
              )}
            </a>
          </li>
        )
      })}
    </ul>
  )
}
