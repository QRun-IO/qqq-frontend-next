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

/**
 * @file EntityCreate page — serves the route `/app/[slug]/create` and renders the record-creation form.
 */

'use client'

/**
 * EntityCreate page — serves the route `/app/[slug]/create` and renders the
 * record-creation form for the table identified by `slug`.
 *
 * Route params:
 * - `slug` — the QQQ table name for which a new record should be created.
 */

import React, { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'

import { useQContext } from '@/lib/context/q-context'
import { loadMetaData } from '@/lib/api/metadata'
import { queryKeys } from '@/lib/query-client'
import { EntityForm } from '@/components/forms/EntityForm'

/**
 * Renders the record-creation form for the table identified by `slug`.
 *
 * Fetches application metadata to resolve the table definition, then renders
 * `<EntityForm>` with no initial record (create mode). Shows a permission
 * error banner when the user lacks `insertPermission` on the table, and a
 * loading spinner while metadata is being fetched.
 *
 * @returns A composed page that renders one of:
 *   - A full-screen spinner while metadata resolves
 *   - A permission-error banner when the user lacks `insertPermission`
 *   - `<EntityForm>` in create mode (no `record` prop) wrapped in a centered `max-w-4xl` container
 */
export default function EntityCreatePage() {
  const params = useParams<{ slug: string }>()
  const { setPageHeader, setTableMetaData } = useQContext()
  const slug = params.slug

  const { data: metaData } = useQuery({
    queryKey: queryKeys.metadataAll(),
    queryFn: loadMetaData,
    staleTime: 1000 * 60 * 30,
  })

  const tableMetaData = metaData?.tables?.[slug]

  useEffect(() => {
    setPageHeader(`Create ${tableMetaData?.label ?? slug}`)
    if (tableMetaData) {
      setTableMetaData(tableMetaData)
    }
  }, [tableMetaData?.label, slug, tableMetaData, setPageHeader, setTableMetaData])

  if (!tableMetaData) {
    return (
      <div className="flex items-center justify-center py-16" aria-busy="true" aria-live="polite">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!tableMetaData.insertPermission) {
    return (
      <div
        className="rounded-xl border border-yellow-200 bg-yellow-50 p-8 text-center"
        role="alert"
      >
        <p className="text-sm text-yellow-700">
          You do not have permission to create {tableMetaData.label} records.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl" data-qqq-id={`entity-create-${slug}`}>
      <EntityForm tableMetaData={tableMetaData} />
    </div>
  )
}
