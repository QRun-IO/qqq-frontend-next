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

import React, { useEffect, useRef, useState } from 'react'
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
      className="scroll-mt-24 rounded-xl border border-border bg-card"
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
 * @param props.caption - Visible text (default "Copy"); set it when a row has more than one copy button.
 * @returns The button.
 */
export function CopyButton({ text, label = 'Copy', caption = 'Copy' }: { text: string; label?: string; caption?: string }) {
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
      {copied ? 'Copied' : caption}
    </button>
  )
}

/** One entry of the section navigation. */
export interface DeveloperNavItem {
  id: string
  label: string
}

/**
 * Sticky navigation to the page's sections; highlights the section nearest the top of the
 * viewport. Phones get a section picker, wider screens a wrapping row of links, so the bar
 * never scrolls sideways.
 *
 * @param props - The sections.
 * @param props.items - Sections in page order.
 * @returns The navigation bar.
 */
export function DeveloperSectionNav({ items }: { items: DeveloperNavItem[] }) {
  const [active, setActive] = useState<string | null>(items[0]?.id ?? null)
  // the section last picked from this bar: at the bottom of the page it stays highlighted
  // while it is in view, since the last sections can never reach the top
  const chosen = useRef<string | null>(null)
  const navRef = useRef<HTMLElement>(null)
  const ids = items.map((item) => item.id).join('|')

  useEffect(() => {
    const sectionIds = ids.split('|')
    const scroller = navRef.current?.closest<HTMLElement>('[data-qqq-id="main-content"]') ?? null
    let frame = 0
    const update = () => {
      frame = 0
      // a section is current once its top passes below the bar, or reaches where a jump puts it
      // (its scroll-mt-24 margin: 96px)
      const top = scroller ? scroller.getBoundingClientRect().top : 0
      const line = Math.max(navRef.current?.getBoundingClientRect().bottom ?? 0, top + 96) + 8
      const viewBottom = scroller ? scroller.getBoundingClientRect().bottom : window.innerHeight
      const atBottom = scroller
        ? scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2
        : window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      let current: string | null = sectionIds[0] ?? null
      for (const id of sectionIds) {
        const sectionTop = document.getElementById(developerSectionId(id))?.getBoundingClientRect().top
        if (sectionTop !== undefined && sectionTop <= line) current = id
      }
      if (atBottom) {
        const pick = chosen.current
        const pickTop = pick ? document.getElementById(developerSectionId(pick))?.getBoundingClientRect().top : undefined
        current = pick && pickTop !== undefined && pickTop < viewBottom ? pick : sectionIds[sectionIds.length - 1] ?? current
      }
      setActive(current)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    const target: HTMLElement | Window = scroller ?? window
    target.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      target.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [ids])

  const go = (id: string) => {
    chosen.current = id
    setActive(id)
    document.getElementById(developerSectionId(id))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav
      ref={navRef}
      aria-label="Developer view sections"
      className="sticky -top-6 z-10 -mx-1 border-b border-border bg-background/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      data-qqq-id="dev-section-nav"
    >
      <label className="flex items-center gap-2 text-sm text-muted-foreground sm:hidden">
        <span className="flex-shrink-0">Go to</span>
        <select
          value={active ?? ''}
          onChange={(event) => go(event.target.value)}
          className="min-w-0 flex-1 rounded-md border border-input bg-card px-2 py-1.5 text-sm font-medium text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-qqq-id="dev-nav-select"
        >
          {items.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </label>
      <ul className="m-0 hidden list-none flex-wrap gap-1 p-0 sm:flex">
        {items.map((item) => (
          <li key={item.id} className="flex-shrink-0">
            <a
              href={`#${developerSectionId(item.id)}`}
              onClick={(event) => {
                event.preventDefault()
                go(item.id)
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
