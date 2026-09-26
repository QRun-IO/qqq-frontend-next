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
 * pointer never timed out.
 */
export const TOASTER_POSITION = 'top-center' as const

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
      richColors
      closeButton
      toastOptions={{ duration: 4000 }}
      aria-live="polite"
      data-qqq-id="toast-container"
    />
  )
}
