'use client'

// QuickLinksWidget — List of quick-access links with optional icons

import React from 'react'
import { ExternalLink, ChevronRight } from 'lucide-react'

export interface QuickLink {
  label: string
  url: string
  description?: string
  iconName?: string
  isExternal?: boolean
}

export interface QuickLinksWidgetPayload {
  type: 'quickLinks'
  links: QuickLink[]
}

interface QuickLinksWidgetProps {
  data: QuickLinksWidgetPayload
  widgetName: string
}

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
