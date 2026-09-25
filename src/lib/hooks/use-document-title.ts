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
 * @file useDocumentTitle — keeps the metadata-derived document title in place.
 */

import { useEffect } from 'react'

/**
 * Sets `document.title` and keeps it: Next.js re-applies the route's static metadata title
 * after a client navigation, and in some engines (WebKit) that happens after this effect ran,
 * leaving the generic "QQQ Admin" (QRun-IO/qqq#649). A head observer restores the title.
 *
 * @param title - The title to show, or undefined to leave the title alone.
 */
export function useDocumentTitle(title: string | undefined): void {
  useEffect(() => {
    if (!title || typeof document === 'undefined') return
    const apply = () => { if (document.title !== title) document.title = title }
    apply()
    const observer = new MutationObserver(apply)
    observer.observe(document.head, { subtree: true, childList: true, characterData: true })
    return () => observer.disconnect()
  }, [title])
}
