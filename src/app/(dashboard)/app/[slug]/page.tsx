'use client'

// Unified slug page — routes to AppHome, RecordQuery, or ProcessRun
// based on what the slug resolves to in the app metadata

import React, { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { FileBarChart } from 'lucide-react'

import { useQContext } from '@/lib/context/q-context'
import { loadMetaData } from '@/lib/api/metadata'
import { queryKeys } from '@/lib/query-client'
import { getProcessesForTable } from '@/lib/utils/process-utils'
import { RecordQuery } from '@/components/query'
import { ProcessRun } from '@/components/process'
import { AppHome } from '@/components/widgets'

export default function SlugPage() {
  const params = useParams<{ slug: string }>()
  const { setPageHeader, setTableMetaData } = useQContext()
  const slug = params.slug

  const { data: metaData } = useQuery({
    queryKey: queryKeys.metadataAll(),
    queryFn: loadMetaData,
    staleTime: 1000 * 60 * 30,
  })

  // Determine what this slug is
  const isApp = Boolean(metaData?.apps?.[slug])
  const isTable = Boolean(metaData?.tables?.[slug])
  const isProcess = Boolean(metaData?.processes?.[slug])
  const isReport = Boolean(metaData?.reports?.[slug])

  const app = metaData?.apps?.[slug]
  const table = metaData?.tables?.[slug]
  const process = metaData?.processes?.[slug]
  const report = metaData?.reports?.[slug]

  useEffect(() => {
    if (isApp) {
      setPageHeader(app?.label ?? slug)
    } else if (isTable) {
      setPageHeader(table?.label ?? slug)
      if (table) setTableMetaData(table)
    } else if (isProcess) {
      setPageHeader(process?.label ?? slug)
    } else if (isReport) {
      setPageHeader((report as { label?: string })?.label ?? slug)
    } else {
      setPageHeader(slug)
    }
  }, [isApp, isTable, isProcess, isReport, app, table, process, report, slug, setPageHeader, setTableMetaData])

  if (!metaData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  // App dashboard — Package 5 implementation
  if (isApp && app) {
    return (
      <AppHome
        appMetaData={app}
        widgetRegistry={metaData.widgets ?? {}}
      />
    )
  }

  // Table record query — Package 2 implementation
  if (isTable && table) {
    const tableProcesses = getProcessesForTable(metaData, slug)
    return <RecordQuery tableName={slug} tableMetaData={table} processes={tableProcesses} />
  }

  // Table loading state (table found but metadata not yet available)
  if (isTable && !table) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  // Process run — Package 4 implementation
  if (isProcess && process) {
    return <ProcessRun processName={slug} processMetaData={process} />
  }

  // Process loading state (process found but metadata not yet available)
  if (isProcess && !process) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  // Report run
  if (isReport) {
    return (
      <div className="space-y-6" data-qqq-id={`report-run-${slug}`}>
        <div className="flex items-center gap-3">
          <FileBarChart className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-2xl font-semibold text-foreground">
            {(report as { label?: string })?.label ?? slug}
          </h2>
        </div>
        <div className="rounded-xl border border-dashed border-border bg-muted p-12 text-center">
          <p className="mt-4 text-muted-foreground">
            Report — implemented in a future package
          </p>
        </div>
      </div>
    )
  }

  // Unknown slug
  return (
    <div className="space-y-4" data-qqq-id={`unknown-slug-${slug}`}>
      <h2 className="text-2xl font-semibold text-foreground">{slug}</h2>
      <div className="rounded-xl border border-dashed border-border bg-muted p-12 text-center">
        <p className="text-muted-foreground">
          Unknown resource: <code className="font-mono">{slug}</code>
        </p>
      </div>
    </div>
  )
}
