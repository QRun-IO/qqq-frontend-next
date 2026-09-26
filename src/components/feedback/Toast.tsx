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
 * @file Toast — the application's sonner `Toaster`, placed once in the providers tree.
 */

'use client'

import React from 'react'
import { Toaster } from 'sonner'

/**
 * Where toasts appear. Primary actions sit at the bottom right on every viewport
 * (form Save and Cancel, process Back, Next and Submit, a phone's sticky action bar
 * and action sheets), so toasts appear at the top center instead: a toast that slid
 * in over Save took the tap meant for it, and one that stayed under a resting
 * pointer never timed out. They start below the dashboard header, clear of its controls.
 */
export const TOASTER_POSITION = 'top-center' as const

/**
 * CSS variable the dashboard header sets to just below itself (see `useToastTopBelow`), so a
 * top-center toast never covers the header's breadcrumbs, search, menu or help controls.
 * Without a header (sign-in pages) toasts keep sonner's default distance from the top.
 */
export const TOAST_TOP_VARIABLE = '--qqq-toast-top'

/** Toaster offsets (desktop and phone): below the header when one is shown. */
export const TOASTER_OFFSET = { top: `var(${TOAST_TOP_VARIABLE}, 24px)` }
export const TOASTER_MOBILE_OFFSET = { top: `var(${TOAST_TOP_VARIABLE}, 16px)` }

/** Space between the header's bottom edge and the first toast, in px. */
const TOAST_HEADER_GAP = 8

/**
 * Keeps {@link TOAST_TOP_VARIABLE} just below an element (the dashboard header) while it is
 * mounted, following its size and position (a site banner appearing above it, a resized window).
 *
 * @param ref - The element toasts must stay below.
 */
export function useToastTopBelow(ref: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    const element = ref.current
    if (!element) return
    const root = document.documentElement
    const update = () => root.style.setProperty(TOAST_TOP_VARIABLE, `${Math.max(0, Math.round(element.getBoundingClientRect().bottom)) + TOAST_HEADER_GAP}px`)
    update()
    // Content appearing above the element (a site banner once branding loads) moves it without
    // resizing it, but resizes one of its ancestors, so the whole chain is observed.
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update)
    for (let node: HTMLElement | null = element; node; node = node.parentElement) observer?.observe(node)
    window.addEventListener('resize', update)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', update)
      root.style.removeProperty(TOAST_TOP_VARIABLE)
    }
  }, [ref])
}

/**
 * The global toast container. Trigger toasts with `toast()`, `toast.success()` or
 * `toast.error()` from `sonner`.
 *
 * @returns The configured sonner `Toaster`.
 */
export function AppToaster() {
  return (
    <Toaster
      position={TOASTER_POSITION}
      offset={TOASTER_OFFSET}
      mobileOffset={TOASTER_MOBILE_OFFSET}
      richColors
      closeButton
      toastOptions={{ duration: 4000 }}
      aria-live="polite"
      data-qqq-id="toast-container"
    />
  )
}
