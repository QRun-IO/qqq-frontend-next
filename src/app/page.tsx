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
 * @file Root page — redirects the application root to the dashboard.
 */

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Root page that immediately redirects to `/app`.
 *
 * Client-side so the same page works in the static export hosted by the QQQ server.
 * The `(dashboard)` layout handles authentication and will redirect to `/login`
 * if the user is not authenticated.
 *
 * @returns Nothing; navigation replaces this page.
 */
export default function RootPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/app')
  }, [router])
  return null
}
