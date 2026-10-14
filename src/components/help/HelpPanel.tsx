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

/** @file Lazy, sanitized long-help side sheet and related help. */
'use client'

import React from 'react'
import Link from 'next/link'

import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

import type { HelpPanelEntry } from './HelpPanelProvider'

import { HelpContent } from '@/components/records/HelpContent'
import { HelpSearchResults } from './HelpSearchResults'

/**
 * Shows one object's long help in a modal sheet with focus trapping and restoration.
 * @param props - Selected help, visibility and the invoking control.
 * @returns The accessible sheet.
 */
export function HelpPanel({
  entry,
  open,
  onOpenChange,
  returnFocus,
}: {
  entry: HelpPanelEntry
  open: boolean
  onOpenChange: (open: boolean) => void
  returnFocus: React.RefObject<HTMLElement | null>
}) {
  const safeHref =
    entry.href?.startsWith('/') && !entry.href.startsWith('//') && !entry.href.includes('\\')
      ? entry.href
      : undefined
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[var(--qqq-z-modal,1000)] bg-background/80 backdrop-blur-sm" />
        <Dialog.Content
          data-help-surface="true"
          data-qqq-id="help-panel"
          className="fixed inset-y-0 right-0 z-[var(--qqq-z-modal,1000)] w-full max-w-lg overflow-y-auto border-l border-border bg-background p-5 text-foreground shadow-xl"
          onEscapeKeyDown={(event) => event.stopPropagation()}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            if (returnFocus.current?.isConnected) returnFocus.current.focus()
            else
              document.querySelector<HTMLElement>('[data-qqq-id="button-command-palette"]')?.focus()
          }}
        >
          <Dialog.Title className="pr-12 text-xl font-semibold">{entry.label}</Dialog.Title>
          <Dialog.Description className="sr-only">
            Detailed help and related topics
          </Dialog.Description>
          <Dialog.Close
            aria-label="Close help"
            data-qqq-id="help-panel-close"
            className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </Dialog.Close>
          <div
            className="my-5 break-words text-sm leading-relaxed [&_img]:max-w-full [&_pre]:overflow-x-auto [&_table]:block [&_table]:overflow-x-auto [&_p]:!block [&_p]:mb-3"
            data-qqq-id="help-panel-content"
          >
            <HelpContent helpContent={entry.helpContent} />
          </div>
          {entry.helpContent.links
            ?.filter(
              (link) =>
                /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(link.url) && !link.url.includes('\\')
            )
            .map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                data-qqq-id="help-documentation-link"
                className="mb-2 block text-primary underline"
              >
                {link.label}
              </a>
            ))}
          {safeHref && (
            <Link
              href={safeHref}
              prefetch={false}
              onClick={() => onOpenChange(false)}
              data-qqq-id="help-go-to"
              className="text-primary underline"
            >
              Go to {entry.label}
            </Link>
          )}
          {open && <HelpSearchResults search={entry.label} heading="Related help" excludeKey={entry.key} requireSummary limit={5} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
