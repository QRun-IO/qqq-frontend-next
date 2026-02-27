/**
 * Not Found page — Next.js `not-found.tsx` rendered automatically when
 * `notFound()` is called or a route segment cannot be matched.
 *
 * Displays a large "404" heading, a brief explanation, and a "Go Home" button
 * that returns the user to the application root.
 */

import Link from 'next/link'
import { SearchX } from 'lucide-react'

/**
 * Full-screen 404 page shown for unknown routes or when `notFound()` is called.
 *
 * @returns A centered card containing the 404 error message and a home navigation link.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="flex flex-col items-center gap-6 text-center">
        <SearchX className="h-16 w-16 text-muted-foreground" aria-hidden="true" />
        <div>
          <h1 className="text-6xl font-bold text-foreground">404</h1>
          <p className="mt-2 text-xl text-muted-foreground">Page not found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          data-qqq-id="link-go-home"
        >
          Go Home
        </Link>
      </div>
    </div>
  )
}
