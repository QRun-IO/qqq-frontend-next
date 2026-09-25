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
 * @file Record-by-key page — `/app/{table}/key?{field}={value}...` opens the one record matching the given field values.
 */

'use client'

import React, { useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'

import { useRouteParams } from '@/lib/hooks/use-route-params'
import { useTableMetaData } from '@/lib/hooks/use-metadata'
import { useQContext } from '@/lib/context/q-context'
import { queryRecords } from '@/lib/api/tables'
import { queryKeys } from '@/lib/query-client'

/**
 * Looks up a record by field values from the query string, as Material
 * Dashboard's `RecordViewByUniqueKey` does (typically a unique key, e.g.
 * `/app/person/key?email=avery@example.invalid`).
 *
 * Each parameter becomes an `EQUALS` criterion. Exactly one match replaces the
 * URL with the record's view page; no match, several matches, an unknown field
 * or no parameters show an error.
 *
 * @returns A loading state, or an alert explaining why no single record matched.
 */
export default function RecordViewByKeyPage() {
  const { slug } = useRouteParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { setPageHeader } = useQContext()
  const { data: table, isError: tableError } = useTableMetaData(slug)

  const criteria = useMemo(() => [...searchParams.entries()], [searchParams])
  const unknownField = table ? criteria.find(([fieldName]) => !table.fields?.[fieldName])?.[0] : undefined

  const lookup = useQuery({
    queryKey: [...queryKeys.tableRecords(slug), 'byKey', searchParams.toString()],
    queryFn: () => queryRecords(slug, {
      filter: {
        criteria: criteria.map(([fieldName, value]) => ({ fieldName, operator: 'EQUALS' as const, values: [value] })),
        booleanOperator: 'AND',
        limit: 2,
      },
    }),
    enabled: Boolean(table) && criteria.length > 0 && !unknownField,
  })

  useEffect(() => {
    setPageHeader(`View ${table?.label ?? slug} by Key`)
  }, [slug, table?.label, setPageHeader])

  const records = lookup.data?.records
  const match = records?.length === 1 ? records[0] : undefined
  const primaryKey = match && table ? match.values[table.primaryKeyField] : undefined

  useEffect(() => {
    if (primaryKey !== undefined && primaryKey !== null) {
      router.replace(`/app/${encodeURIComponent(slug)}/${encodeURIComponent(String(primaryKey))}`)
    }
  }, [primaryKey, router, slug])

  let error: string | undefined
  if (tableError) error = `Could not load the ${slug} table.`
  else if (table && criteria.length === 0) error = `Add field values to the address to look up a ${table.label} record, for example ?${table.primaryKeyField}=1.`
  else if (table && unknownField) error = `Query-string parameter [${unknownField}] is not a defined field on the ${table.label} table.`
  else if (lookup.isError) error = lookup.error instanceof Error ? lookup.error.message : 'Unexpected error running query'
  else if (table && records?.length === 0) error = `No ${table.label} record was found matching the given values.`
  else if (table && records && records.length > 1) error = `More than one ${table.label} record was found matching the given values.`

  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive" data-qqq-id={`record-view-key-error-${slug}`}>
        {error}
      </div>
    )
  }

  return (
    <div role="status" aria-label="Looking up record" className="flex items-center justify-center py-12" data-qqq-id={`record-view-key-${slug}`}>
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}
