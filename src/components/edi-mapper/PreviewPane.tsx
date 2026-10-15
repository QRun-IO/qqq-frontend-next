/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

/** @file Sandbox preview with local overrides and PHI-safe result rendering. */
'use client'
import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { EdiPreviewV1, EdiRuleV1 } from '@/types/edi'
import { queryRecords } from '@/lib/api/tables'
import { previewEdi } from '@/lib/api/edi'
import { queryKeys } from '@/lib/query-client'
import { control } from './GuideTree'

/** Readable, wrapping JSON tree for arbitrary associated records and structured diffs.
 * @param props - JSON value and accessible label.
 * @returns Recursive disclosure tree without horizontal scrolling.
 */
function JsonTree({ value, label }: { value: unknown; label: string }) {
  if (value !== null && typeof value === 'object')
    return (
      <details open className="min-w-0 border-l border-border pl-2">
        <summary className="cursor-pointer break-words">{label}</summary>
        <div className="space-y-1">
          {Object.entries(value).map(([key, child]) => (
            <JsonTree
              key={key}
              value={child}
              label={Array.isArray(value) ? `Record ${Number(key) + 1}` : key}
            />
          ))}
          {!Object.keys(value).length && <p>None</p>}
        </div>
      </details>
    )
  return (
    <p className="break-words [overflow-wrap:anywhere]">
      <span className="font-medium">{label}: </span>
      {String(value ?? '—')}
    </p>
  )
}

/** Displays all preview sections, suppressing sensitive sections when requested by the server.
 * @param props - Preview response.
 * @returns Preview results.
 */
export function PreviewResult({ result }: { result: EdiPreviewV1 }) {
  const levels = [
    ...new Set((result.findings ?? []).map((finding) => finding.snipLevel ?? 0)),
  ].sort((a, b) => a - b)
  return (
    <div className="min-w-0 space-y-4" data-qqq-id="edi-preview-result">
      <p role="status">
        Interchanges: {result.parse?.interchanges ?? 0} · Groups: {result.parse?.groups ?? 0} ·
        Documents: {result.parse?.documents ?? 0}
      </p>
      {result.phiSuppressed && (
        <p role="status" className="rounded border border-border bg-muted p-3 font-medium">
          PHI suppressed — mapped records, acknowledgement text and diffs are hidden.
        </p>
      )}
      <h3 className="font-medium">Findings</h3>
      {!levels.length && <p>No findings.</p>}
      {levels.map((level) => (
        <section key={level}>
          <h4 className="font-medium">{level ? `SNIP level ${level}` : 'Other findings'}</h4>
          <ul className="space-y-2">
            {result.findings
              ?.filter((finding) => (finding.snipLevel ?? 0) === level)
              .map((finding, index) => (
                <li key={index} className="break-words">
                  {finding.severity} {finding.code}: {finding.message}
                  <span className="block text-sm text-muted-foreground">
                    {finding.loopId} {finding.segmentId}{' '}
                    {finding.segmentPosition != null ? `segment ${finding.segmentPosition}` : ''}{' '}
                    {finding.elementPosition != null ? `element ${finding.elementPosition}` : ''}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      ))}
      {!result.phiSuppressed && (
        <>
          <h3 className="font-medium">Acknowledgement {result.ack?.type}</h3>
          <pre className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm">
            {result.ack?.text || 'No acknowledgement text.'}
          </pre>
          <h3 className="font-medium">Mapped records</h3>
          <button
            type="button"
            className={control}
            data-qqq-id="edi-download-result"
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(result.result ?? { records: [] }, null, 2)], {
                  type: 'application/json',
                })
              )
              const link = document.createElement('a')
              link.href = url
              link.download = 'edi-preview.json'
              link.click()
              setTimeout(() => URL.revokeObjectURL(url), 1000)
            }}
          >
            Download mapped records
          </button>
          <JsonTree value={result.result?.records ?? []} label="Records" />
          <h3 className="font-medium">Differences</h3>
          <JsonTree value={result.diff?.againstExpected ?? []} label="Against expected result" />
          <JsonTree
            value={result.diff?.againstPreviousRevision ?? []}
            label="Against previous revision"
          />
        </>
      )}
    </div>
  )
}

/** Fetches sample labels and runs the sandbox with a complete snapshot of unsaved rules.
 * @param props - Map identifier and local rules.
 * @returns Sample picker, upload and results.
 */
export default function PreviewPane({ mapId, rules }: { mapId: number; rules: EdiRuleV1[] }) {
  const [sampleId, setSampleId] = useState('')
  const [upload, setUpload] = useState<{ sampleBase64: string; sampleName: string } | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [reading, setReading] = useState(false)
  const [revision, setRevision] = useState<'ORIGINAL' | 'CURRENT'>('ORIGINAL')
  const samples = useQuery({
    queryKey: queryKeys.ediSamples(mapId),
    queryFn: async () => {
      const records = []
      for (let skip = 0; ; skip += 100) {
        const page = await queryRecords('edi_map_sample', {
          filter: {
            criteria: [{ fieldName: 'mapId', operator: 'EQUALS', values: [mapId] }],
            orderBys: [{ fieldName: 'id', isAscending: true }],
            skip,
            limit: 100,
          },
        })
        records.push(...page.records)
        if (page.records.length < 100) return records
      }
    },
  })
  const preview = useMutation({
    mutationFn: () =>
      previewEdi({
        mapId,
        ruleOverrides: rules,
        guideRevision: revision,
        ...(upload ?? { sampleId: Number(sampleId) }),
      }),
  })
  return (
    <div className="min-w-0 space-y-3">
      <p className="text-sm text-muted-foreground">
        Preview uses unsaved rules and does not write target records. Uploaded samples are stored
        encrypted.
      </p>
      {samples.isError && (
        <p role="alert">Could not load samples. You can still upload a sample.</p>
      )}
      <div className="grid gap-1">
        <label htmlFor="edi-sample">Sample</label>
        <select
          id="edi-sample"
          data-qqq-id="edi-sample"
          className={control}
          value={sampleId}
          disabled={preview.isPending || reading}
          onChange={(event) => {
            setSampleId(event.target.value)
            setUpload(null)
            setUploadError('')
            preview.reset()
          }}
        >
          <option value="">Choose a sample</option>
          {samples.data?.map((sample) => (
            <option key={String(sample.values.id)} value={String(sample.values.id)}>
              {String(sample.values.name ?? sample.recordLabel ?? sample.values.id)}
            </option>
          ))}
        </select>
      </div>
      <label className="grid gap-1" htmlFor="edi-upload">
        Upload sample (maximum 5 MB)
        <input
          id="edi-upload"
          data-qqq-id="edi-upload"
          type="file"
          disabled={reading || preview.isPending}
          className={`${control} w-full`}
          onChange={async (event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            setUpload(null)
            setSampleId('')
            setUploadError('')
            preview.reset()
            if (!file) return
            if (file.size > 5 * 1024 * 1024) {
              setUploadError('Sample exceeds the 5 MB limit.')
              return
            }
            setReading(true)
            try {
              const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () => resolve(String(reader.result).split(',')[1])
                reader.onerror = () => reject(new Error('Could not read sample.'))
                reader.readAsDataURL(file)
              })
              setUpload({ sampleBase64: base64, sampleName: file.name.slice(0, 255) })
            } catch {
              setUploadError('Could not read sample.')
            } finally {
              setReading(false)
            }
          }}
        />
      </label>
      {upload && <p className="break-words">Selected upload: {upload.sampleName}</p>}
      {uploadError && <p role="alert">{uploadError}</p>}
      <div className="grid gap-1">
        <label htmlFor="edi-revision">Guide revision</label>
        <select
          id="edi-revision"
          data-qqq-id="edi-revision"
          className={control}
          value={revision}
          onChange={(event) => {
            setRevision(event.target.value as 'ORIGINAL' | 'CURRENT')
            preview.reset()
          }}
        >
          <option value="ORIGINAL">Pinned guide</option>
          <option value="CURRENT">Newest active guide</option>
        </select>
      </div>
      <button
        type="button"
        data-qqq-id="edi-run-preview"
        className={control}
        disabled={reading || preview.isPending || (!upload && !sampleId)}
        onClick={() => preview.mutate()}
      >
        {preview.isPending ? 'Running preview…' : 'Run preview'}
      </button>
      {preview.isError && (
        <p role="alert">
          Preview failed. Check your sample and preview permission, then try again.
        </p>
      )}
      {preview.data && (
        <>
          <p className="text-sm text-muted-foreground">
            Results reflect the rules at the time of the last preview.
          </p>
          <PreviewResult result={preview.data} />
        </>
      )}
    </div>
  )
}
