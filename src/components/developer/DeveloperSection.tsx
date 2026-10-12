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
 * @file Building blocks of the record developer view: an anchored, collapsible section card, the
 * sticky section navigation, a status badge and a copy-to-clipboard button.
 */

'use client'

import React, { useEffect, useState } from 'react'
import { Check, ChevronDown, ChevronRight, ClipboardCopy } from 'lucide-react'

import type { DeveloperPanelTone } from '@/lib/api/developer-panels'
import { cn } from '@/lib/utils/cn'

/**
 * DOM id of a developer section's anchor.
 * @param id - The section's id.
 * @returns The element id.
 */
export function developerSectionId(id: string): string {
  return `dev-section-${id.replace(/[^A-Za-z0-9_-]/g, '-')}`
}

/** Props for {@link DeveloperSection}. */
export interface DeveloperSectionProps {
  /** Stable id (anchor and nav target). */
  id: string
  /** Heading. */
  title: string
  /** Optional one-line description under the heading. */
  description?: string
  /** Optional status badge beside the heading. */
  badge?: { label: string; tone?: DeveloperPanelTone }
  /** Starts collapsed. */
  defaultCollapsed?: boolean
  /** Controls beside the heading (shown while expanded). */
  actions?: React.ReactNode
  children: React.ReactNode
}

/**
 * A titled, collapsible card with a scroll anchor; the heading button toggles the body.
 *
 * @param props - See {@link DeveloperSectionProps}.
 * @returns The section.
 */
export function DeveloperSection({ id, title, description, badge, defaultCollapsed = false, actions, children }: DeveloperSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const bodyId = `${developerSectionId(id)}-body`
  return (
    <section
      id={developerSectionId(id)}
      aria-labelledby={`${developerSectionId(id)}-title`}
      className="scroll-mt-16 rounded-xl border border-border bg-card"
      data-qqq-id={`dev-section-${id}`}
    >
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <h2 className="m-0 min-w-0 flex-1" id={`${developerSectionId(id)}-title`}>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-expanded={!collapsed}
            aria-controls={bodyId}
            className="flex w-full min-w-0 items-center gap-2 rounded-md text-left text-base font-semibold text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-qqq-id={`dev-section-toggle-${id}`}
          >
            {collapsed ? <ChevronRight className="h-4 w-4 flex-shrink-0" aria-hidden="true" /> : <ChevronDown className="h-4 w-4 flex-shrink-0" aria-hidden="true" />}
            <span className="min-w-0 break-words">{title}</span>
            {badge && <StatusBadge label={badge.label} tone={badge.tone} />}
          </button>
        </h2>
        {!collapsed && actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {!collapsed && (
        <div id={bodyId} className="min-w-0 space-y-4 border-t border-border px-4 py-4">
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
          {children}
        </div>
      )}
    </section>
  )
}

const TONE_CLASSES: Record<DeveloperPanelTone, string> = {
  INFO: 'border-border bg-muted text-muted-foreground',
  SUCCESS: 'border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400',
  WARNING: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  ERROR: 'border-destructive/40 bg-destructive/10 text-destructive',
}

/**
 * A small status pill.
 *
 * @param props - Label and tone.
 * @param props.label - Text.
 * @param props.tone - Color tone (INFO by default).
 * @returns The badge.
 */
export function StatusBadge({ label, tone = 'INFO' }: { label: string; tone?: DeveloperPanelTone }) {
  return (
    <span className={cn('inline-flex flex-shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium', TONE_CLASSES[tone])} data-qqq-id="dev-status-badge">
      {label}
    </span>
  )
}

/**
 * A button that copies text to the clipboard and briefly shows a check mark.
 *
 * @param props - Text and accessible label.
 * @param props.text - What to copy.
 * @param props.label - Accessible label (default "Copy").
 * @returns The button.
 */
export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => setCopied(true), () => setCopied(false))
      }}
      aria-label={copied ? `${label}: copied` : label}
      title={label}
      className="inline-flex items-center gap-1 rounded-md border border-input bg-card px-2 py-1 text-xs font-medium text-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-qqq-id="button-dev-copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" aria-hidden="true" /> : <ClipboardCopy className="h-3.5 w-3.5" aria-hidden="true" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

/** One entry of the section navigation. */
export interface DeveloperNavItem {
  id: string
  label: string
}

/**
 * Sticky, horizontally scrolling navigation to the page's sections; highlights the section
 * nearest the top of the viewport.
 *
 * @param props - The sections.
 * @param props.items - Sections in page order.
 * @returns The navigation bar.
 */
export function DeveloperSectionNav({ items }: { items: DeveloperNavItem[] }) {
  const [active, setActive] = useState<string | null>(items[0]?.id ?? null)
  const ids = items.map((item) => item.id).join('|')

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const visible = new Map<string, number>()
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = entry.target.getAttribute('data-qqq-id')?.replace(/^dev-section-/, '')
        if (!id) continue
        if (entry.isIntersecting) visible.set(id, entry.boundingClientRect.top)
        else visible.delete(id)
      }
      const first = [...visible.entries()].sort((a, b) => a[1] - b[1])[0]
      if (first) setActive(first[0])
    }, { rootMargin: '-64px 0px -60% 0px' })
    for (const id of ids.split('|')) {
      const element = document.getElementById(developerSectionId(id))
      if (element) observer.observe(element)
    }
    return () => observer.disconnect()
  }, [ids])

  return (
    <nav
      aria-label="Developer view sections"
      className="sticky top-0 z-10 -mx-1 overflow-x-auto border-b border-border bg-background/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      data-qqq-id="dev-section-nav"
    >
      <ul className="m-0 flex list-none gap-1 p-0">
        {items.map((item) => (
          <li key={item.id} className="flex-shrink-0">
            <a
              href={`#${developerSectionId(item.id)}`}
              onClick={(event) => {
                event.preventDefault()
                setActive(item.id)
                document.getElementById(developerSectionId(item.id))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              aria-current={active === item.id ? 'location' : undefined}
              className={cn(
                'block whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active === item.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
              data-qqq-id={`dev-nav-${item.id}`}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
