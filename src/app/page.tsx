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
 * @file Root page — handles the Material Auth0 callback or opens the dashboard.
 */

'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import CallbackContent from './(auth)/callback/CallbackContent'

/**
 * Root page that immediately redirects to `/app`.
 *
 * Client-side so the same page works in the static export hosted by the QQQ server.
 * The `(dashboard)` layout handles authentication and will redirect to `/login`
 * if the user is not authenticated.
 *
 * @returns Nothing; navigation replaces this page.
 */
function RootContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isCallback = searchParams.has('code') || searchParams.has('error')
  useEffect(() => {
    if (!isCallback) router.replace('/app')
  }, [isCallback, router])
  if (isCallback) {
    return <main className="flex min-h-screen items-center justify-center bg-muted p-4"><CallbackContent /></main>
  }
  return null
}

/**
 * Wraps the root route in the search parameter boundary required by static export.
 * @returns The root route.
 */
export default function RootPage() {
  return <Suspense fallback={null}><RootContent /></Suspense>
}
