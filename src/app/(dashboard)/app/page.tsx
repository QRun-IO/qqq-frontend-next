'use client'

// App root redirect — redirects to the first available app

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'

import { loadMetaData } from '@/lib/api/metadata'
import { queryKeys } from '@/lib/query-client'
import { useQContext } from '@/lib/context/q-context'
import { useAppTreeRoutes } from '@/lib/hooks/use-routes'

export default function AppRootPage() {
  const router = useRouter()
  const { setPageHeader } = useQContext()

  const { data: metaData } = useQuery({
    queryKey: queryKeys.metadataAll(),
    queryFn: loadMetaData,
    staleTime: 1000 * 60 * 30,
  })

  const { defaultRoute } = useAppTreeRoutes(metaData)

  useEffect(() => {
    setPageHeader('Dashboard')
  }, [setPageHeader])

  useEffect(() => {
    if (metaData && defaultRoute && defaultRoute !== '/no-apps') {
      router.replace(defaultRoute)
    }
  }, [metaData, defaultRoute, router])

  return (
    <div className="flex items-center justify-center py-12" data-qqq-id="app-root-loading">
      <div
        className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"
        role="status"
        aria-label="Redirecting to default app"
      />
    </div>
  )
}
