'use client'

// RecordDeveloperView — shows raw record data and table metadata as formatted JSON
// Useful for debugging field values, types, and backend responses

import React, { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Code, ChevronDown, ChevronUp } from 'lucide-react'

import { useQContext } from '@/lib/context/q-context'
import { getRecord } from '@/lib/api/tables'
import { loadTableMetaData } from '@/lib/api/metadata'
import { queryKeys } from '@/lib/query-client'

export default function RecordDeveloperViewPage() {
  const params = useParams<{ slug: string; recordId: string }>()
  const { setPageHeader } = useQContext()
  const { slug, recordId } = params

  useEffect(() => {
    setPageHeader(`Dev: ${slug} #${recordId}`)
  }, [slug, recordId, setPageHeader])

  const { data: record, isLoading: recordLoading, error: recordError } = useQuery({
    queryKey: queryKeys.tableRecord(slug, recordId),
    queryFn: () => getRecord(slug, recordId),
    staleTime: 1000 * 60 * 5,
  })

  const { data: metaData, isLoading: metaLoading } = useQuery({
    queryKey: queryKeys.tableMetadata(slug),
    queryFn: () => loadTableMetaData(slug),
    staleTime: 1000 * 60 * 30,
  })

  const isLoading = recordLoading || metaLoading

  return (
    <div className="space-y-6" data-qqq-id={`record-dev-${slug}-${recordId}`}>
      <div className="flex items-center gap-3">
        <Code className="h-6 w-6 text-gray-400" aria-hidden="true" />
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Record Developer View:{' '}
          <span className="font-mono text-blue-600">{slug}</span>
          {' '}
          <span className="font-mono text-gray-500">#{recordId}</span>
        </h2>
      </div>

      {isLoading && (
        <div
          className="flex items-center justify-center py-12"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      )}

      {recordError && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
          role="alert"
        >
          Failed to load record: {recordError instanceof Error ? recordError.message : 'Unknown error'}
        </div>
      )}

      {!isLoading && record && (
        <div className="space-y-4">
          {/* Field values summary */}
          {metaData && (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full text-sm" data-qqq-id="record-dev-field-table">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                      Field
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                      Type
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(record.values).map(([fieldName, value]) => {
                    const field = metaData.fields[fieldName]
                    return (
                      <tr
                        key={fieldName}
                        className="border-t border-gray-100 dark:border-gray-800"
                      >
                        <td className="px-4 py-2 font-mono text-xs text-blue-600 dark:text-blue-400">
                          {fieldName}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-gray-500 dark:text-gray-400">
                          {field?.type ?? '—'}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-gray-900 dark:text-gray-100">
                          {value === null || value === undefined
                            ? <span className="text-gray-400 italic">null</span>
                            : String(value)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <JsonBlock label="Raw Record" value={record} />
          {metaData && <JsonBlock label="Table Metadata" value={metaData} defaultOpen={false} />}
        </div>
      )}
    </div>
  )
}

function JsonBlock({
  label,
  value,
  defaultOpen = true,
}: {
  label: string
  value: unknown
  defaultOpen?: boolean
}) {
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        aria-expanded={open}
        data-qqq-id="button-json-block-toggle"
      >
        <span className="flex items-center gap-2">
          <Code className="h-4 w-4" aria-hidden="true" />
          {label}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
      {open && (
        <pre
          className="overflow-x-auto bg-gray-900 p-4 text-xs text-green-300 dark:bg-black"
          data-qqq-id="json-output"
        >
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  )
}
