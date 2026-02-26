// Root layout — wraps entire application with providers
// This is a Server Component that sets up client-side providers

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Providers from './providers'
import '@/styles/globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: {
    default: 'QQQ Admin',
    template: '%s | QQQ Admin',
  },
  description: 'Low-code application admin interface',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
