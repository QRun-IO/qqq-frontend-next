'use client'

// Client-side providers wrapper
// Separated from root layout to avoid Server Component issues with useEffect/contexts

import React, { useEffect, useState, type ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'

import { queryClient } from '@/lib/query-client'
import { AuthProvider } from '@/lib/auth/auth-provider'
import { ThemeProvider } from '@/lib/theme/theme-provider'
import { injectThemeTokens } from '@/lib/theme/tokens'
import { Toaster } from '@/components/feedback/Toast'

// Inject default theme tokens on first render
if (typeof window !== 'undefined') {
  injectThemeTokens()
}

const isMockMode = process.env.NEXT_PUBLIC_MOCK_API === 'true'

export default function Providers({ children }: { children: ReactNode }) {
  // When mock mode is enabled, block rendering until the MSW service worker
  // is fully started — otherwise AuthProvider fires its first API call before
  // MSW is ready and gets a real 404.
  const [mockReady, setMockReady] = useState(!isMockMode)

  useEffect(() => {
    if (!isMockMode) return
    import('@/mocks/init')
      .then(({ initMocks }) => initMocks())
      .then(() => setMockReady(true))
      .catch((e) => {
        console.error('[MSW] Failed to start mock worker:', e)
        setMockReady(true) // unblock the app anyway
      })
  }, [])

  if (!mockReady) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 text-indigo-500">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        <span className="text-sm font-medium">Starting mock API…</span>
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
      <Toaster
        position="bottom-right"
        richColors
        closeButton
        toastOptions={{ duration: 4000 }}
        aria-live="polite"
        data-qqq-id="toast-container"
      />
    </QueryClientProvider>
  )
}
