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

/** @file Save, export and SQL actions shared by every analysis view. */
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AnalysisDefinition } from '@/types/data-analysis'
import { insertRecord } from '@/lib/api/tables'
import { analysisSql, exportAnalysis, exportSavedAnalysis } from '@/lib/api/data-analysis'
import { chartPng, downloadAnalysisFile } from '@/lib/utils/analysis-download'
import { AnalysisDialog } from './AnalysisDialog'
import { controlClass, ProfileError } from './ProfileParts'

/** Produces core CRUD field values while preserving both comparison populations.
 * @param definition - Typed operation.
 * @param tableName - Source table.
 * @param name - User's name.
 * @param description - User's description.
 * @param shared - Shared read visibility.
 * @param chartKind - Displayed chart kind.
 * @returns Core insert values.
 */
export function savedAnalysisValues(
  definition: AnalysisDefinition,
  tableName: string,
  name: string,
  description: string,
  shared: boolean,
  chartKind?: string | null
) {
  const filter =
    definition.kind === 'COMPARE' ? definition.request.filterA : definition.request.filter
  return {
    name: name.trim(),
    description,
    shared,
    table_name: tableName,
    kind: definition.kind,
    filter_json: JSON.stringify(filter ?? {}),
    definition_json: JSON.stringify(definition.request),
    chart_kind: chartKind ?? null,
  }
}

/** Renders the same actions for profiles, explorers and saved results.
 * @param props - Current executed request and optional saved id/chart scope.
 * @returns Action toolbar and save dialog.
 */
export function AnalysisActions({
  definition,
  tableName,
  chartKind,
  sqlAvailable = false,
  savedId,
  chartRoot,
  pngAvailable = true,
}: {
  definition: AnalysisDefinition
  tableName: string
  chartKind?: string | null
  sqlAvailable?: boolean
  savedId?: string
  chartRoot?: () => HTMLElement | null
  pngAvailable?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [shared, setShared] = useState(false)
  const [note, setNote] = useState('')
  const save = useMutation({
    mutationFn: () =>
      insertRecord(
        'data_analysis_saved',
        savedAnalysisValues(definition, tableName, name, description, shared, chartKind)
      ),
    onSuccess: (record) => {
      setOpen(false)
      toast.success('Analysis saved', {
        action: {
          label: 'Open',
          onClick: () =>
            router.push(`/app/data_analysis_saved/${encodeURIComponent(String(record.values.id))}`),
        },
      })
    },
  })
  const action = useMutation({
    mutationFn: async (kind: 'csv' | 'xlsx' | 'png' | 'sql') => {
      setNote('')
      if (kind === 'sql') {
        const result = await analysisSql(tableName, { ...definition, tableName })
        if (result.available && result.sql)
          router.push(`/app/sqlWorkbench?${new URLSearchParams({ sql: result.sql })}`)
        else setNote(result.note || 'SQL is not available for this analysis.')
      } else if (kind === 'png') {
        const svg = chartRoot?.()?.querySelector<SVGSVGElement>(
          'svg.recharts-surface, svg[role="img"]'
        )
        if (!svg) throw new Error('Display a chart before exporting Chart PNG.')
        downloadAnalysisFile(await chartPng(svg), 'analysis.png')
      } else {
        const blob = savedId
          ? await exportSavedAnalysis(savedId, kind)
          : await exportAnalysis({ ...definition, tableName, format: kind })
        downloadAnalysisFile(blob, `analysis.${kind}`)
      }
    },
  })
  return (
    <div className="space-y-2" data-qqq-id="analysis-actions">
      <div className="flex flex-wrap gap-2">
        {!savedId && (
          <button
            className={controlClass}
            onClick={() => setOpen(true)}
            data-qqq-id="analysis-save"
          >
            Save
          </button>
        )}
        {(['csv', 'xlsx'] as const).map((format) => (
          <button
            key={format}
            className={controlClass}
            disabled={action.isPending}
            onClick={() => action.mutate(format)}
            data-qqq-id={`analysis-export-${format}`}
          >
            {format.toUpperCase()}
          </button>
        ))}
        {savedId && (
          <button
            className={controlClass}
            disabled={action.isPending || !pngAvailable}
            onClick={() => action.mutate('png')}
            data-qqq-id="analysis-export-png"
          >
            Chart PNG
          </button>
        )}
        {sqlAvailable && (
          <button
            className={controlClass}
            disabled={action.isPending}
            onClick={() => action.mutate('sql')}
            data-qqq-id="analysis-sql"
          >
            Open in SQL Workbench
          </button>
        )}
      </div>
      {savedId && !pngAvailable && (
        <p className="text-sm text-muted-foreground">
          Chart PNG is available when an SVG chart is displayed.
        </p>
      )}
      {note && <p role="status">{note}</p>}
      {action.error && <ProfileError error={action.error} />}
      <AnalysisDialog
        title="Save analysis"
        description="Save this request to run again with current permissions."
        open={open}
        onOpenChange={setOpen}
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) save.mutate()
          }}
        >
          <label className="block">
            Name
            <input
              required
              aria-required="true"
              className={`${controlClass} w-full`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-qqq-id="analysis-save-name"
            />
          </label>
          <label className="block">
            Description
            <textarea
              className={`${controlClass} w-full`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-qqq-id="analysis-save-description"
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={shared}
              onChange={(e) => setShared(e.target.checked)}
              data-qqq-id="analysis-save-shared"
            />
            Shared
          </label>
          {save.error && <ProfileError error={save.error} />}
          <button
            type="submit"
            className={controlClass}
            disabled={!name.trim() || save.isPending}
            data-qqq-id="analysis-save-submit"
          >
            Save analysis
          </button>
        </form>
      </AnalysisDialog>
    </div>
  )
}
