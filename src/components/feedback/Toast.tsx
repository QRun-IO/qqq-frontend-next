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
 * @file Toast — re-exports the `Toaster` component from sonner for placement in the providers tree.
 */

'use client'

/**
 * Re-exports `Toaster` from sonner for global toast notification support.
 *
 * Add `<Toaster />` once in the root providers to enable toast notifications.
 * Trigger toasts with `toast()`, `toast.success()`, or `toast.error()` from `sonner`.
 */
export { Toaster } from 'sonner'
