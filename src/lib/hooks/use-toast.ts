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

// use-toast — Lightweight toast hook backed by sonner
// Provides toast.success / toast.error / toast.info / toast.warning / toast.dismiss

import { toast as sonnerToast } from 'sonner'

export interface ToastOptions {
  duration?: number
  description?: string
}

const DEFAULT_DURATION = 4000

function success(message: string, options?: ToastOptions) {
  sonnerToast.success(message, {
    duration: options?.duration ?? DEFAULT_DURATION,
    description: options?.description,
  })
}

function error(message: string, options?: ToastOptions) {
  sonnerToast.error(message, {
    duration: options?.duration ?? DEFAULT_DURATION,
    description: options?.description,
  })
}

function info(message: string, options?: ToastOptions) {
  sonnerToast.info(message, {
    duration: options?.duration ?? DEFAULT_DURATION,
    description: options?.description,
  })
}

function warning(message: string, options?: ToastOptions) {
  sonnerToast.warning(message, {
    duration: options?.duration ?? DEFAULT_DURATION,
    description: options?.description,
  })
}

function dismiss(id?: string | number) {
  if (id !== undefined) {
    sonnerToast.dismiss(id)
  } else {
    sonnerToast.dismiss()
  }
}

export const toast = { success, error, info, warning, dismiss }

export function useToast() {
  return { toast }
}
