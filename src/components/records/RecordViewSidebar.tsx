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

/** @file Sticky record-view navigation derived from visible table sections. */

'use client'

import type { QTableSection } from '@/types'
import { SectionIcon } from '@/components/layout/MetadataIcon'

/** Props for {@link RecordViewSidebar}. */
interface RecordViewSidebarProps {
  sections: QTableSection[]
  onNavigate: (section: QTableSection) => void
}

/**
 * Lists record sections with their metadata icon and label.
 *
 * @param props - Visible sections and their navigation callback.
 * @returns A sticky navigation landmark on desktop.
 */
export function RecordViewSidebar({ sections, onNavigate }: RecordViewSidebarProps) {
  return (
    <nav aria-label="Record sections" className="hidden self-start lg:sticky lg:top-4 lg:block" data-qqq-id="record-sidebar">
      <ul className="max-h-[calc(100vh-2rem)] space-y-1 overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-sm">
        {sections.map((section) => (
          <li key={section.name}>
            <button type="button" onClick={() => onNavigate(section)}
              data-qqq-id={`sidebar-item-${section.name}`}
              className="sidebar-section is-visible flex w-full items-center rounded-md px-2 py-2 text-left text-sm text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring">
              <SectionIcon section={section} />
              {section.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
