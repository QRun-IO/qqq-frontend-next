'use client'

// ProcessResultStep — renders the COMPLETE state
// Shows success message, record counts (inserted/updated/deleted), and navigation links

import React, { useEffect } from 'react'
import Link from 'next/link'
import { CheckCircle, ArrowLeft, ExternalLink } from 'lucide-react'

import type { QProcessMetaData } from '@/types'
import { cn } from '@/lib/utils/cn'
import { toast } from '@/lib/hooks/use-toast'

export interface ProcessResultStepProps {
  processMetaData: QProcessMetaData | null
  resultValues: Record<string, unknown>
  className?: string
}

interface ResultStat {
  label: string
  value: number
  color: string
}

function parseResultStats(resultValues: Record<string, unknown>): ResultStat[] {
  const stats: ResultStat[] = []

  const inserted = resultValues.recordsInserted ?? resultValues.insertedCount ?? resultValues.importedCount
  const updated = resultValues.recordsUpdated ?? resultValues.updatedCount
  const deleted = resultValues.recordsDeleted ?? resultValues.deletedCount
  const sent = resultValues.sentCount
  const failed = resultValues.failedCount
  const processed = resultValues.processedCount ?? resultValues.totalProcessed

  if (inserted !== undefined && Number(inserted) > 0) {
    stats.push({ label: 'Records Inserted', value: Number(inserted), color: 'text-green-600' })
  }
  if (updated !== undefined && Number(updated) > 0) {
    stats.push({ label: 'Records Updated', value: Number(updated), color: 'text-primary' })
  }
  if (deleted !== undefined && Number(deleted) > 0) {
    stats.push({ label: 'Records Deleted', value: Number(deleted), color: 'text-destructive' })
  }
  if (sent !== undefined) {
    stats.push({ label: 'Sent', value: Number(sent), color: 'text-green-600' })
  }
  if (failed !== undefined && Number(failed) > 0) {
    stats.push({ label: 'Failed', value: Number(failed), color: 'text-destructive' })
  }
  if (processed !== undefined && stats.length === 0) {
    stats.push({ label: 'Records Processed', value: Number(processed), color: 'text-green-600' })
  }

  return stats
}

export function ProcessResultStep({
  processMetaData,
  resultValues,
  className,
}: ProcessResultStepProps) {
  const stats = parseResultStats(resultValues)
  const tableName = processMetaData?.tableName
  const successMessage =
    (resultValues.successMessage as string) ??
    (resultValues.message as string) ??
    'Process completed successfully.'

  // Show a success toast when the result step mounts
  useEffect(() => {
    toast.success(`${processMetaData?.label ?? 'Process'} completed successfully.`)
  // We only want this to fire once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className={cn('space-y-6 text-center', className)}
      data-qqq-id="process-result-step"
    >
      {/* Success icon */}
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle
            className="h-10 w-10 text-green-600"
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Success heading */}
      <div>
        <h3 className="text-xl font-semibold text-foreground">
          {processMetaData?.label ?? 'Process'} Complete
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">{successMessage}</p>
      </div>

      {/* Result stats */}
      {stats.length > 0 && (
        <div
          className="mx-auto flex max-w-sm flex-wrap justify-center gap-6"
          data-qqq-id="process-result-stats"
        >
          {stats.map((stat, idx) => (
            <div key={idx} className="text-center">
              <div className={cn('text-3xl font-bold', stat.color)}>{stat.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Navigation links */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        {tableName && (
          <>
            <Link
              href={`/app/${tableName}`}
              className={cn(
                'inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium',
                'text-foreground bg-card hover:bg-accent',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                'transition-colors duration-150'
              )}
              data-qqq-id="button-back-to-table"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to {tableName}
            </Link>

            <Link
              href={`/app/${tableName}`}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
                'text-primary-foreground bg-primary hover:bg-primary/90',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                'transition-colors duration-150'
              )}
              data-qqq-id="button-view-records"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              View Records
            </Link>
          </>
        )}

        {!tableName && (
          <Link
            href="/app"
            className={cn(
              'inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium',
              'text-foreground bg-card hover:bg-accent',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'transition-colors duration-150'
            )}
            data-qqq-id="button-back-to-home"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Home
          </Link>
        )}
      </div>
    </div>
  )
}
