// 404 Not Found page

import Link from 'next/link'
import { SearchX } from 'lucide-react'

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
