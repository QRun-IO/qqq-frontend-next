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

/** @file Debounced help search shared by the palette, search page and help sheet. */
'use client'

import React, { useEffect, useState } from 'react'

import { Command } from 'cmdk'
import { useQuery } from '@tanstack/react-query'

import { searchHelp } from '@/lib/api/help'
import { HANDLES_OWN_ERRORS, queryKeys } from '@/lib/query-client'

import { GroupHeading, ITEM_CLASS } from '@/components/feedback/command-menu-parts'

import { useHelpPanel } from './HelpPanelProvider'

/**
 * Searches core help after 200 ms and opens results in the shared panel.
 * @param props - Query text and optional palette integration.
 * @returns Results with explicit loading, empty and failure states.
 */
export function HelpSearchResults({
  search,
  heading = 'Help',
  palette = false,
  onSelect,
  excludeKey,
  requireSummary = false,
  limit = 10,
}: {
  search: string
  heading?: string
  palette?: boolean
  excludeKey?: string
  requireSummary?: boolean
  limit?: number
  onSelect?: () => void
}) {
  const { searchEnabled, openHelp } = useHelpPanel()
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 200)
    return () => clearTimeout(timer)
  }, [search])
  const current = debounced === search.trim()
  const result = useQuery({
    queryKey: queryKeys.helpSearch(debounced),
    queryFn: ({ signal }) => searchHelp(debounced, 10, signal),
    enabled: searchEnabled && current && debounced.length >= 2,
    meta: HANDLES_OWN_ERRORS,
  })
  if (!searchEnabled || search.trim().length < 2) return null
  const items = (current ? (result.data ?? []) : [])
    .filter((item) => item.key !== excludeKey && (!requireSummary || Boolean(item.summary?.trim())))
    .slice(0, limit)
    .map((item) => {
      const choose = () => {
        onSelect?.()
        openHelp({
          key: item.key,
          label: item.label,
          helpContent: {
            content: item.text,
            contentAsHtml: item.contentAsHtml,
            summary: item.summary,
            format: item.contentAsHtml ? 'MARKDOWN' : 'TEXT',
          },
          href: item.href,
        })
      }
      const content = (
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{item.label}</span>
          <span className="block truncate text-xs text-muted-foreground">{item.summary}</span>
        </span>
      )
      const className =
        'block w-full rounded px-4 py-2 text-left text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring aria-selected:bg-accent'
      return palette ? (
        <Command.Item
          key={item.key}
          value={`help:${item.key}`}
          onSelect={choose}
          className={ITEM_CLASS}
          data-qqq-id={`help-result-${item.key}`}
        >
          {content}
        </Command.Item>
      ) : (
        <button
          key={item.key}
          type="button"
          onClick={(event) => { event.currentTarget.focus(); choose() }}
          className={className}
          data-qqq-id={`help-result-${item.key}`}
        >
          {content}
        </button>
      )
    })
  const status =
    !current || result.isFetching
      ? 'Searching help…'
      : result.isError
        ? 'Help search is unavailable.'
        : !items.length
          ? 'No help found.'
          : null
  return palette ? (
    <Command.Group heading={<GroupHeading>{heading}</GroupHeading>} data-qqq-id="command-group-help">
      {status && (
        <p role="status" className="px-4 text-sm text-muted-foreground">
          {status}
        </p>
      )}
      {items}
    </Command.Group>
  ) : (
    <section aria-label={heading} data-qqq-id="help-search-results" className="mt-5">
      <h3 className="font-semibold">{heading}</h3>
      {status && <p role="status">{status}</p>}
      {items}
    </section>
  )
}
