'use client'

// RecordViewByUniqueKey — view a record by unique key
// Full implementation in Package 3

import React, { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useQContext } from '@/lib/context/q-context'

export default function RecordViewByKeyPage() {
  const params = useParams<{ slug: string }>()
  const { setPageHeader } = useQContext()
  const slug = params.slug

  useEffect(() => {
    setPageHeader(`View ${slug} by Key`)
  }, [slug, setPageHeader])

  return (
    <div data-qqq-id={`record-view-key-${slug}`}>
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-12 text-center dark:border-gray-700 dark:bg-gray-800">
        <p className="text-gray-600 dark:text-gray-400">Record view by key — implemented in Package 3</p>
      </div>
    </div>
  )
}
