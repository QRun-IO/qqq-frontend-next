// 404 Not Found page

import Link from 'next/link'
import { SearchX } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="flex flex-col items-center gap-6 text-center">
        <SearchX className="h-16 w-16 text-gray-400" aria-hidden="true" />
        <div>
          <h1 className="text-6xl font-bold text-gray-900 dark:text-gray-100">404</h1>
          <p className="mt-2 text-xl text-gray-600 dark:text-gray-400">Page not found</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          data-qqq-id="link-go-home"
        >
          Go Home
        </Link>
      </div>
    </div>
  )
}
