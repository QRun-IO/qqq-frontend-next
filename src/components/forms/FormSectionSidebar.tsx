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
 * @file FormSectionSidebar — the record form's sticky list of its sections (icon and label);
 * choosing one scrolls to it and moves keyboard focus there, as the Material dashboard's
 * record form sidebar does (EntityForm, QRecordSidebar).
 */

'use client'

import React from 'react'

import type { QTableSection } from '@/types'
import { cn } from '@/lib/utils/cn'
import { SectionIcon } from '@/components/layout/MetadataIcon'

import { formSectionElementId } from './DynamicForm'

/** Props for {@link FormSectionSidebar}. */
export interface FormSectionSidebarProps {
  /** The form's sections, in order. */
  sections: QTableSection[]
  /** Accessible name of the navigation landmark. */
  label: string
  /** Extra classes (the form shows the sidebar on large screens only). */
  className?: string
}

/**
 * Scrolls to a form section and focuses it.
 *
 * @param sectionName - Section name from metadata.
 */
function goToSection(sectionName: string) {
  const element = document.getElementById(formSectionElementId(sectionName))
  if (!element) return
  element.scrollIntoView({ block: 'start' })
  element.focus({ preventScroll: true })
}

/**
 * Renders the section links of a record form.
 *
 * @param props - See {@link FormSectionSidebarProps}.
 * @returns A navigation landmark, or `null` when the form has no sections.
 */
export function FormSectionSidebar({ sections, label, className }: FormSectionSidebarProps) {
  if (sections.length === 0) return null
  return (
    <nav aria-label={label} className={cn('self-start lg:sticky lg:top-4', className)} data-qqq-id="form-sidebar">
      <ul className="space-y-1 rounded-xl border border-border bg-card p-2 shadow-sm">
        {sections.map((section) => (
          <li key={section.name}>
            <button
              type="button"
              onClick={() => goToSection(section.name)}
              className={cn(
                'flex w-full items-center rounded-md px-2 py-2 text-left text-sm text-foreground',
                'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring'
              )}
              data-qqq-id={`form-sidebar-item-${section.name}`}
            >
              <SectionIcon section={section} />
              {section.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
