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
 * @file A small header badge shown while the user's self-serve QA mode turned capture on
 * (`reason == QA_MODE`). It links to the QA mode preference section when there is one.
 */

'use client'

import Link from 'next/link'
import { Bug } from 'lucide-react'
import { useQaCaptureCapability } from '@/lib/hooks/use-qa-capture'

/**
 * The "QA mode on" badge.
 *
 * @returns The badge, or null when QA mode is not what enabled capture.
 */
export function QaModeIndicator() {
  const capability = useQaCaptureCapability()
  if (!capability?.enabled || capability.reason !== 'QA_MODE') return null
  const section = capability.qaMode.preferenceSection
  const className = 'inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100'
  const content = (
    <>
      <Bug className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="hidden sm:inline">QA mode on</span>
      <span className="sr-only sm:hidden">QA mode on</span>
    </>
  )
  return section ? (
    <Link href={`/app/preferences?section=${encodeURIComponent(section)}`} className={className} title="QA capture is on for you (QA mode)" data-qqq-id="qa-mode-indicator">
      {content}
    </Link>
  ) : (
    <span className={className} title="QA capture is on for you (QA mode)" data-qqq-id="qa-mode-indicator">{content}</span>
  )
}
