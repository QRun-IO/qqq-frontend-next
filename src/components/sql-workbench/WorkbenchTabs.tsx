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
 * @file WorkbenchTabs — the standard underlined tab bar (as on the record view and the script
 * viewer) for the workbench's library and result views, with the WAI-ARIA tabs keyboard model:
 * one tab stop, arrow keys, Home and End.
 */

'use client'

import React, { useRef } from 'react'

import { cn } from '@/lib/utils/cn'
import { TAB_LIST_CLASS, tabClass } from '@/components/ui/controls'

/** One tab. */
export interface WorkbenchTab<T extends string> {
  value: T
  label: string
  qqqId?: string
}

/** Props for {@link WorkbenchTabs}. */
export interface WorkbenchTabsProps<T extends string> {
  /** Accessible name of the tab list. */
  label: string
  tabs: WorkbenchTab<T>[]
  value: T
  onChange: (value: T) => void
  /** When set, tab ids are `${idBase}-tab-${value}` and they control `${idBase}-panel`. */
  idBase?: string
  /** Content after the tabs, on the same row (e.g. a status). */
  children?: React.ReactNode
  className?: string
}

/**
 * Renders the tab bar.
 *
 * @param props - Component props.
 * @returns The tab list.
 */
export function WorkbenchTabs<T extends string>(props: WorkbenchTabsProps<T>) {
  const { label, tabs, value, onChange, idBase, children, className } = props
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const last = tabs.length - 1
    const targets: Record<string, number> = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    }
    const next = targets[event.key]
    if (next === undefined) return
    event.preventDefault()
    onChange(tabs[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div className={cn('flex flex-wrap items-end gap-x-3', className)}>
      <div role="tablist" aria-label={label} className={cn(TAB_LIST_CLASS, 'flex-[1_0_auto]')}>
        {tabs.map((tab, index) => (
          <button
            key={tab.value}
            ref={(element) => {
              refs.current[index] = element
            }}
            type="button"
            role="tab"
            id={idBase ? `${idBase}-tab-${tab.value}` : undefined}
            aria-controls={idBase ? `${idBase}-panel` : undefined}
            aria-selected={tab.value === value}
            tabIndex={tab.value === value ? 0 : -1}
            className={tabClass(tab.value === value)}
            onClick={() => onChange(tab.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            data-qqq-id={tab.qqqId}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {children}
    </div>
  )
}
