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

/** @file Preferences route content, with device display settings and server-owned sections. */
'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { getPreferences } from '@/lib/api/preferences'
import { queryKeys } from '@/lib/query-client'
import { useQContext } from '@/lib/context/q-context'
import { useMediaQuery } from '@/lib/hooks/use-media-query'
import { BUTTON_CLASS } from '@/components/ui/controls'
import { MetadataIcon } from '@/components/layout/MetadataIcon'
import { DisplayPreferencesPanel } from '@/components/layout/DisplayPreferencesPanel'
import { PreferenceSectionForm } from './PreferenceSectionForm'

/** Loading placeholders shared by the page and section drawer.
 * @returns Accessible skeleton status.
 */
export function PreferencesSkeleton() {
  return (
    <div role="status" aria-busy="true" className="space-y-4 p-4" data-qqq-id="preferences-loading">
      <span className="sr-only">Loading preferences…</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  )
}

/** Every registered section and a client-only Display section, selected through the URL.
 * @returns Preferences navigation and selected section.
 */
export function PreferencesPage() {
  const { setPageHeader } = useQContext()
  useEffect(() => setPageHeader('Preferences'), [setPageHeader])
  const router = useRouter()
  const params = useSearchParams()
  const wide = useMediaQuery('(min-width: 1024px)')
  const query = useQuery({
    queryKey: queryKeys.preferencesIndex(),
    queryFn: getPreferences,
    retry: false,
  })
  // A client-only key cannot collide with the backend's [a-z] section names.
  const requested = params.get('section')
  const selected =
    requested === 'display' && !query.data?.sections.some((section) => section.name === 'display')
      ? '__display'
      : (requested ?? '__display')
  const sections = [
    {
      name: '__display',
      label: 'Display',
      description: 'Appearance and default views. Saved on this device.',
      icon: { name: 'display_settings' },
    },
    ...(query.data?.sections ?? []),
  ]
  const section = query.data?.sections.find((section) => section.name === selected)
  const navigate = (name: string) =>
    router.replace(
      name === '__display'
        ? '/app/preferences'
        : `/app/preferences?section=${encodeURIComponent(name)}`,
      { scroll: false }
    )
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6" data-qqq-id="preferences-page">
      <h1 className="text-2xl font-semibold text-foreground">Preferences</h1>
      <div className="grid min-w-0 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <nav aria-label="Preference sections" className="min-w-0">
          {wide ? (
            <ul className="space-y-2">
              {sections.map((item) => (
                <li key={item.name}>
                  <button
                    type="button"
                    onClick={() => navigate(item.name)}
                    aria-current={selected === item.name ? 'page' : undefined}
                    className={`flex w-full items-start gap-3 rounded-lg p-3 text-left focus-visible:ring-2 focus-visible:ring-ring ${selected === item.name ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent'}`}
                    data-qqq-id={`preferences-section-nav-${item.name === '__display' ? 'display' : item.name}`}
                  >
                    <MetadataIcon
                      icon={item.icon}
                      kind="section"
                      className="mt-1 h-5 w-5 shrink-0"
                    />
                    <span className="min-w-0 break-words">
                      <span className="block font-medium">{item.label}</span>
                      <span className="block text-sm text-muted-foreground">
                        {item.description}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <label className="block space-y-2 text-sm font-medium">
              <span>Section</span>
              <select
                value={selected}
                onChange={(event) => navigate(event.target.value)}
                className="w-full min-w-0 rounded-md border border-input bg-background p-3 text-foreground"
                data-qqq-id="preferences-section-select"
              >
                {!sections.some((item) => item.name === selected) && (
                  <option value={selected}>Unavailable section</option>
                )}
                {sections.map((item) => (
                  <option
                    key={item.name}
                    value={item.name}
                    data-qqq-id={`preferences-section-nav-${item.name === '__display' ? 'display' : item.name}`}
                  >
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </nav>
        <div className="min-w-0 space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6">
          {query.isError && (
            <div role="alert" className="space-y-2 text-sm text-destructive">
              <p>Could not load preferences.</p>
              <button
                type="button"
                onClick={() => void query.refetch()}
                className={BUTTON_CLASS}
                data-qqq-id="preferences-retry"
              >
                Retry
              </button>
            </div>
          )}
          {selected === '__display' ? (
            <>
              <h2 className="text-lg font-semibold">Display</h2>
              <DisplayPreferencesPanel />
            </>
          ) : query.isLoading ? (
            <PreferencesSkeleton />
          ) : section ? (
            <>
              <PreferenceSectionForm key={section.name} section={section} />
            </>
          ) : (
            !query.isError && (
              <p role="status" className="text-muted-foreground">
                This preference section is not available.
              </p>
            )
          )}
          {query.isLoading && selected === '__display' && <PreferencesSkeleton />}
          {query.data?.sections.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No additional preferences are available.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
