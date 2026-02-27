/**
 * Root layout — Server Component that wraps the entire Next.js application.
 *
 * Sets up the Inter font variable, global CSS, Next.js metadata defaults, and
 * mounts the `<Providers>` client component that supplies TanStack Query,
 * authentication, and toast infrastructure to all pages.
 */

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Providers from './providers'
import '@/styles/globals.css'

/** Inter font configuration with the CSS variable `--font-inter`. */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

/**
 * Default Next.js metadata applied to every page in the application.
 *
 * Individual pages may override `title` via their own `export const metadata`.
 */
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

/**
 * The root HTML layout for the entire Next.js application.
 *
 * Renders the `<html>` and `<body>` elements, applies the Inter font variable,
 * suppresses hydration warnings caused by browser extensions, and wraps all
 * page content in `<Providers>`.
 *
 * @param children - The active page or nested layout content.
 * @returns The fully-structured HTML document shell.
 */
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
