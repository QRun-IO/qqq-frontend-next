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
 * @file use-toast — Lightweight toast notification hook backed by sonner.
 * Provides toast.success / toast.error / toast.info / toast.warning / toast.dismiss.
 */

// use-toast — Lightweight toast hook backed by sonner
// Provides toast.success / toast.error / toast.info / toast.warning / toast.dismiss

import { toast as sonnerToast } from 'sonner'

/**
 * Optional display configuration for a toast notification.
 */
export interface ToastOptions {
  /** How long the toast is visible in milliseconds. Defaults to 4000. */
  duration?: number
  /** Secondary descriptive text shown below the main message. */
  description?: string
}

const DEFAULT_DURATION = 4000

/**
 * Displays a success toast notification.
 *
 * @param message - Primary message text shown in the toast.
 * @param options - Optional duration and description overrides.
 */
function success(message: string, options?: ToastOptions) {
  sonnerToast.success(message, {
    duration: options?.duration ?? DEFAULT_DURATION,
    description: options?.description,
  })
}

/**
 * Displays an error toast notification.
 *
 * @param message - Primary message text shown in the toast.
 * @param options - Optional duration and description overrides.
 */
function error(message: string, options?: ToastOptions) {
  sonnerToast.error(message, {
    duration: options?.duration ?? DEFAULT_DURATION,
    description: options?.description,
  })
}

/**
 * Displays an informational toast notification.
 *
 * @param message - Primary message text shown in the toast.
 * @param options - Optional duration and description overrides.
 */
function info(message: string, options?: ToastOptions) {
  sonnerToast.info(message, {
    duration: options?.duration ?? DEFAULT_DURATION,
    description: options?.description,
  })
}

/**
 * Displays a warning toast notification.
 *
 * @param message - Primary message text shown in the toast.
 * @param options - Optional duration and description overrides.
 */
function warning(message: string, options?: ToastOptions) {
  sonnerToast.warning(message, {
    duration: options?.duration ?? DEFAULT_DURATION,
    description: options?.description,
  })
}

/**
 * Dismisses a specific toast by ID, or all toasts when no ID is provided.
 *
 * @param id - The toast ID to dismiss. Omit to dismiss all active toasts.
 */
function dismiss(id?: string | number) {
  if (id !== undefined) {
    sonnerToast.dismiss(id)
  } else {
    sonnerToast.dismiss()
  }
}

export const toast = { success, error, info, warning, dismiss }

/**
 * Returns the toast notification object with `success`, `error`, `info`, `warning`, and `dismiss` methods.
 *
 * @returns An object containing the toast notification helpers.
 */
export function useToast() {
  return { toast }
}
