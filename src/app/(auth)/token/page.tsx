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
 * @file Token page — the OAuth2 / Auth0 redirect URI (`{origin}/token`), matching the
 * Material dashboard so existing identity-provider registrations keep working.
 */

'use client'

import React, { Suspense } from 'react'

import CallbackContent from '../callback/CallbackContent'

/**
 * `/token` — completes the provider redirect.
 *
 * @returns The callback handler in a full-screen container.
 */
export default function TokenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">Loading...</p>}>
        <CallbackContent />
      </Suspense>
    </main>
  )
}
