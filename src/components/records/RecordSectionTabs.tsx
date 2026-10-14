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

/** @file RecordSectionTabs — measured section tabs with an accessible overflow menu. */
'use client'

import React, { useLayoutEffect, useRef, useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/** Inputs shared with the record view's tab panels. */
interface RecordSectionTabsProps {
  tabs: { id: string; label: string }[]
  activeTab: string
  setActiveTab: (id: string) => void
  tabId: string
  label: string
}

const tabClasses = 'rounded-lg px-4 py-2 text-sm font-medium'

/**
 * Fits tabs to the container, reserving room for More and the active section.
 * Hidden, noninteractive labels measure intrinsic widths independently of flex sizing.
 * Before measurement (or without ResizeObserver), tabs safely wrap.
 * @param props - Tab descriptors, selection and panel ID prefix.
 * @returns A tab list and keyboard-accessible overflow menu.
 */
export function RecordSectionTabs({ tabs, activeTab, setActiveTab, tabId, label }: RecordSectionTabsProps) {
  const container = useRef<HTMLDivElement>(null)
  const measurements = useRef<HTMLDivElement>(null)
  const [sizes, setSizes] = useState<{ available: number; more: number; widths: number[] }>()

  useLayoutEffect(() => {
    const element = container.current
    const row = measurements.current
    if (!element || !row || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const style = getComputedStyle(element)
      const available = element.clientWidth - parseFloat(style.paddingLeft || '0') - parseFloat(style.paddingRight || '0')
      const widths = Array.from(row.children, (child) => child.getBoundingClientRect().width)
      const more = widths.pop() ?? 0
      if (available > 0 && more > 0 && widths.every((width) => width > 0)) {
        setSizes({ available, more, widths })
      }
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    for (const child of row.children) observer.observe(child)
    measure()
    return () => observer.disconnect()
  }, [tabs])

  let visible = tabs
  if (sizes && sizes.widths.length === tabs.length && sizes.widths.reduce((sum, width) => sum + width, 0) > sizes.available) {
    const budget = Math.max(0, sizes.available - sizes.more)
    let used = 0
    let count = 0
    while (count < tabs.length && used + sizes.widths[count] <= budget) {
      used += sizes.widths[count++]
    }
    const activeIndex = tabs.findIndex((tab) => tab.id === activeTab)
    if (activeIndex >= count) {
      while (count > 0 && used + sizes.widths[activeIndex] > budget) used -= sizes.widths[--count]
      visible = [...tabs.slice(0, count), tabs[activeIndex]]
    } else {
      visible = tabs.slice(0, count)
    }
  }
  const overflow = tabs.filter((tab) => !visible.includes(tab))

  /**
   * Moves focus among visible tabs without activating a panel until Enter or Space.
   * @param event - Key pressed on a tab.
   * @param index - Index within the visible tabs.
   */
  function handleTabKey(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number | undefined
    if (event.key === 'ArrowRight') next = (index + 1) % visible.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + visible.length) % visible.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = visible.length - 1
    if (next === undefined) return
    event.preventDefault()
    document.getElementById(`${tabId}-${visible[next].id}`)?.focus()
  }

  return (
    <div className="relative min-w-0 max-w-full" data-qqq-id="record-tabs-container">
      <div className="pointer-events-none invisible absolute inset-0 overflow-hidden" aria-hidden="true">
        <div ref={measurements} className="flex w-max">
          {tabs.map((tab) => <span key={tab.id} className={cn(tabClasses, 'shrink-0 whitespace-nowrap')}>{tab.label}</span>)}
          <span className={cn(tabClasses, 'flex shrink-0 items-center gap-1 whitespace-nowrap')}>More<ChevronDown className="h-4 w-4" /></span>
        </div>
      </div>
      <div ref={container} className="flex min-w-0 rounded-xl border border-border bg-muted/50 p-1" data-qqq-id="record-view-tabs">
        <div role="tablist" aria-label={label} className={cn('flex min-w-0 flex-1', !sizes && 'flex-wrap')}>
          {visible.map((tab, index) => (
            <button key={tab.id} type="button" role="tab" id={`${tabId}-${tab.id}`}
              aria-controls={`${tabId}-panel`} aria-selected={activeTab === tab.id}
              tabIndex={activeTab === tab.id ? 0 : -1} onKeyDown={(event) => handleTabKey(event, index)}
              onClick={() => setActiveTab(tab.id)} title={tab.label}
              className={cn(tabClasses, 'sidebar-section is-visible min-w-0 flex-1 basis-auto whitespace-normal [overflow-wrap:anywhere] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                activeTab === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              data-qqq-id={`record-tab-${tab.id}`}>
              {tab.label}
            </button>
          ))}
        </div>
        {overflow.length > 0 && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button type="button" className={cn(tabClasses, 'flex shrink-0 items-center gap-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring')}
                data-qqq-id="record-tabs-more" aria-label="More sections">
                More<ChevronDown className="h-4 w-4" aria-hidden="true" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={4}
                className="z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] max-w-[var(--radix-dropdown-menu-content-available-width)] overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
                data-qqq-id="record-tabs-more-menu">
                {overflow.map((tab) => (
                  <DropdownMenu.Item key={tab.id} onSelect={() => setActiveTab(tab.id)}
                    className="cursor-pointer rounded-sm px-3 py-2 text-sm break-words whitespace-normal outline-none focus:bg-accent focus:text-accent-foreground"
                    data-qqq-id={`record-tab-menu-${tab.id}`}>
                    {tab.label}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
      </div>
    </div>
  )
}
