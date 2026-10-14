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

/** @file Preferences page entry point, compatible with the dashboard static export. */
'use client'

import dynamic from 'next/dynamic'

const PreferencesPage = dynamic(
  () => import('@/components/preferences/PreferencesPage').then((module) => module.PreferencesPage),
  {
    ssr: false,
    loading: () => (
      <p role="status" className="p-6 text-muted-foreground">
        Loading preferences…
      </p>
    ),
  }
)

/** Renders current-user preferences.
 * @returns The dynamically loaded preferences page.
 */
export default function PreferencesRoute() {
  return <PreferencesPage />
}
