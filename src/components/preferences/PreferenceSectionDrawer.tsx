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

/** @file Lazy, focus-trapped preference sheet shared by notification shortcuts. */
'use client'

import type { RefObject } from 'react'
import Link from 'next/link'
import * as Dialog from '@radix-ui/react-dialog'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import type { PreferenceSection } from '@/types/preferences'
import { getPreferenceSection } from '@/lib/api/preferences'
import { queryKeys } from '@/lib/query-client'
import { BUTTON_CLASS } from '@/components/ui/controls'
import { PreferenceSectionForm } from './PreferenceSectionForm'

/** A right-side sheet on larger screens and full-screen sheet on phones.
 * @param props - Known section, open state, and persistent gear focus target.
 * @returns Modal section editor.
 */
export default function PreferenceSectionDrawer({
  section,
  open,
  onOpenChange,
  returnFocusRef,
}: {
  section: PreferenceSection
  open: boolean
  onOpenChange: (open: boolean) => void
  returnFocusRef: RefObject<HTMLButtonElement | null>
}) {
  const query = useQuery({
    queryKey: queryKeys.preferenceSection(section.name),
    queryFn: () => getPreferenceSection(section.name),
    enabled: open,
    retry: false,
  })
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[var(--qqq-z-overlay,400)] bg-foreground/40" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 z-[var(--qqq-z-modal,1000)] flex h-dvh w-full flex-col border-l border-border bg-card text-foreground shadow-xl sm:max-w-3xl"
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            returnFocusRef.current?.focus({ preventScroll: true })
          }}
          data-qqq-id="preferences-drawer"
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-4">
            <div>
              <Dialog.Title className="text-lg font-semibold">{section.label}</Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">
                {section.description || 'Manage your preferences for this section.'}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Close settings"
              className={BUTTON_CLASS}
              data-qqq-id="preferences-drawer-close"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {query.isLoading ? (
              <p role="status" className="animate-pulse rounded-lg bg-muted p-6">
                Loading preferences…
              </p>
            ) : query.isError ? (
              <div role="alert" className="space-y-3 text-destructive">
                <p>Could not load this preference section.</p>
                <button
                  type="button"
                  onClick={() => void query.refetch()}
                  className={BUTTON_CLASS}
                  data-qqq-id="preferences-drawer-retry"
                >
                  Retry
                </button>
              </div>
            ) : (
              query.data && <PreferenceSectionForm key={query.data.name} section={query.data} hideHeading />
            )}
          </div>
          <div className="shrink-0 border-t border-border p-4">
            <Link
              href={`/app/preferences?section=${encodeURIComponent(section.name)}`}
              onClick={() => onOpenChange(false)}
              className="text-sm font-medium text-primary underline underline-offset-2"
              data-qqq-id="preferences-manage-all"
            >
              Manage all preferences
            </Link>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
