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
