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

/** @file Shared help panel state and author permissions for the dashboard. */
'use client'

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

import { useQuery } from '@tanstack/react-query'

import type { QHelpContent, QInstance } from '@/types'

import { getUiApiVersion } from '@/lib/api/ui-api-version'
import { useHelpHelpActive } from '@/lib/context/q-context'
import { queryKeys } from '@/lib/query-client'

/** The core-defined help table, not an application table. */
export const HELP_CONTENT_TABLE = 'helpContent'

/** Content and navigation offered by the one shared panel. */
export interface HelpPanelEntry {
  key?: string
  label: string
  helpContent: QHelpContent
  href?: string
}

interface HelpPanelContextValue {
  openHelp: (entry: HelpPanelEntry) => void
  searchEnabled: boolean
  canAuthor: boolean
}

const HelpPanelContext = createContext<HelpPanelContextValue>({
  openHelp: () => {},
  searchEnabled: false,
  canAuthor: false,
})
const HelpPanel = dynamic(() => import('./HelpPanel').then((module) => module.HelpPanel), {
  ssr: false,
})

/**
 * Shares a lazy panel and metadata-derived capabilities across every help placement.
 * @param props - Children and the already loaded instance metadata.
 * @returns The provider and, after first use, the panel.
 */
export function HelpPanelProvider({
  children,
  instance,
}: {
  children: React.ReactNode
  instance?: QInstance
}) {
  const [entry, setEntry] = useState<HelpPanelEntry | null>(null)
  const [open, setOpen] = useState(false)
  const returnFocus = useRef<HTMLElement | null>(null)
  const authorMode = useHelpHelpActive()
  const { data: version } = useQuery({
    queryKey: queryKeys.uiApiVersion(),
    queryFn: getUiApiVersion,
    staleTime: Infinity,
  })
  const openHelp = useCallback(
    (next: HelpPanelEntry) => {
      if (!open)
        returnFocus.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null
      setEntry(next)
      setOpen(true)
    },
    [open]
  )
  const value = useMemo(
    () => ({
      openHelp,
      searchEnabled: version?.features.includes('help') ?? false,
      canAuthor: authorMode && instance?.tables?.[HELP_CONTENT_TABLE]?.insertPermission === true,
    }),
    [openHelp, version, authorMode, instance]
  )
  return (
    <HelpPanelContext.Provider value={value}>
      {children}
      {entry && (
        <HelpPanel entry={entry} open={open} onOpenChange={setOpen} returnFocus={returnFocus} />
      )}
    </HelpPanelContext.Provider>
  )
}

/** Reads the shared help controller.
 * @returns The shared panel actions and help capabilities; safe outside the dashboard. */
export function useHelpPanel(): HelpPanelContextValue {
  return useContext(HelpPanelContext)
}
