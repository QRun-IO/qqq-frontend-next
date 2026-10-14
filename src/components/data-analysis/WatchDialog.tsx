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

/** @file Core CRUD watch creation with an explicit saved-watch preview. */
'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { DataAnalysisCapabilityFieldV1, QueryFilter } from '@/types/data-analysis'
import { insertRecord } from '@/lib/api/tables'
import { previewWatch } from '@/lib/api/data-analysis'
import { AnalysisDialog } from './AnalysisDialog'
import { controlClass, ProfileError } from './ProfileParts'
const ProfileChart = dynamic(() => import('./ProfileChart'), { ssr: false })
const detectors = {
  SPIKE: 'Spike',
  DROP: 'Drop',
  OUT_OF_RANGE: 'Out of range',
  NEW_CATEGORY: 'New category',
  NULL_RATE_CREEP: 'Null rate creep',
}
type Detector = keyof typeof detectors

/** Creates a watch, then previews exactly the persisted configuration.
 * @param props - Current profile scope and readable capability fields.
 * @returns Watch action and editor.
 */
export function WatchDialog({
  tableName,
  fields,
  filter,
  fieldName,
}: {
  tableName: string
  fields: DataAnalysisCapabilityFieldV1[]
  filter?: QueryFilter
  fieldName?: string
}) {
  const [open, setOpen] = useState(false)
  const [id, setId] = useState<string>()
  const [name, setName] = useState('')
  const [operator, setOperator] = useState('COUNT')
  const [field, setField] = useState(fieldName ?? '')
  const dates = fields.filter((f) => f && ['DATE', 'DATE_TIME'].includes(f.kind ?? ''))
  const [date, setDate] = useState(
    dates.find((f) => f?.name === fieldName)?.name ?? dates[0]?.name ?? ''
  )
  const [bucket, setBucket] = useState('MONTH')
  const [detector, setDetector] = useState<Detector>('SPIKE')
  const [severity, setSeverity] = useState('WARNING')
  const [parameters, setParameters] = useState({
    k: 14,
    threshold: 3.5,
    relativeChange: 0.5,
    min: 0,
    max: 100,
    delta: 0.05,
    n: 3,
  })
  const effectiveOperator =
    detector === 'NEW_CATEGORY'
      ? 'CATEGORY_SET'
      : detector === 'NULL_RATE_CREEP'
        ? 'NULL_SHARE'
        : operator
  const choices = fields.filter((f) =>
    effectiveOperator === 'SUM' || effectiveOperator === 'AVG'
      ? f?.kind === 'NUMERIC'
      : effectiveOperator === 'CATEGORY_SET'
        ? ['CATEGORY', 'TEXT', 'BOOLEAN'].includes(f?.kind ?? '')
        : true
  )
  const valid =
    Boolean(
      name.trim() &&
      date &&
      (effectiveOperator === 'COUNT' || choices.some((f) => f?.name === field))
    ) &&
    (detector !== 'OUT_OF_RANGE' || parameters.min <= parameters.max)
  const save = useMutation({
    mutationFn: () => {
      const params = {
        k: parameters.k,
        ...(detector === 'SPIKE' || detector === 'DROP'
          ? { threshold: parameters.threshold, relativeChange: parameters.relativeChange }
          : detector === 'OUT_OF_RANGE'
            ? { min: parameters.min, max: parameters.max }
            : detector === 'NULL_RATE_CREEP'
              ? { delta: parameters.delta, n: parameters.n }
              : {}),
      }
      return insertRecord('data_analysis_watch', {
        name: name.trim(),
        table_name: tableName,
        filter_json: JSON.stringify(filter ?? {}),
        metric_json: JSON.stringify({
          operator: effectiveOperator,
          ...(effectiveOperator !== 'COUNT' ? { field } : {}),
        }),
        date_field: date,
        bucket,
        detector,
        parameters_json: JSON.stringify(params),
        severity,
        enabled: true,
      })
    },
    onSuccess: (record) => {
      setId(String(record.values.id))
      toast.success('Watch saved')
    },
  })
  const preview = useMutation({ mutationFn: () => previewWatch(id!) })
  const select = (
    label: string,
    value: string,
    options: [string, string][],
    change: (value: string) => void
  ) => (
    <label className="block">
      {label}
      <select
        required
        aria-required="true"
        className={`${controlClass} w-full`}
        value={value}
        onChange={(e) => change(e.target.value)}
        data-qqq-id={`watch-${label.toLowerCase().replace(/ /g, '-')}`}
      >
        <option value="">Choose</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  )
  const number = (
    label: string,
    key: keyof typeof parameters,
    min: number,
    max?: number,
    step = 'any'
  ) => (
    <label className="block">
      {label}
      <input
        type="number"
        required
        min={min}
        max={max}
        step={step}
        value={parameters[key]}
        className={`${controlClass} w-full`}
        onChange={(e) => setParameters({ ...parameters, [key]: Number(e.target.value) })}
        data-qqq-id={`watch-${key}`}
      />
    </label>
  )
  return (
    <>
      <button className={controlClass} onClick={() => setOpen(true)} data-qqq-id="analysis-watch">
        Watch
      </button>
      <AnalysisDialog
        title="Watch this metric"
        description="Save a watch, then preview its series and detector verdict."
        open={open}
        onOpenChange={setOpen}
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (valid && !id) save.mutate()
          }}
        >
          <fieldset disabled={Boolean(id) || save.isPending} className="space-y-3">
            <legend className="sr-only">Watch configuration</legend>
            <label className="block">
              Name
              <input
                required
                aria-required="true"
                className={`${controlClass} w-full`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-qqq-id="watch-name"
              />
            </label>
            {select('Detector', detector, Object.entries(detectors), (value) =>
              setDetector(value as Detector)
            )}
            {select(
              'Metric',
              effectiveOperator,
              detector === 'NEW_CATEGORY'
                ? [['CATEGORY_SET', 'Category set']]
                : detector === 'NULL_RATE_CREEP'
                  ? [['NULL_SHARE', 'Null share']]
                  : [
                      ['COUNT', 'Count'],
                      ['NULL_SHARE', 'Null share'],
                      ...(fields.some((f) => f?.kind === 'NUMERIC')
                        ? ([
                            ['SUM', 'Sum'],
                            ['AVG', 'Average'],
                          ] as [string, string][])
                        : []),
                    ],
              setOperator
            )}
            {effectiveOperator !== 'COUNT' &&
              select(
                'Metric field',
                field,
                choices
                  .filter((f) => f?.name)
                  .map((f) => [f!.name!, f!.label ?? 'Unlabeled field']),
                setField
              )}
            {select(
              'Date field',
              date,
              dates.filter((f) => f?.name).map((f) => [f!.name!, f!.label ?? 'Unlabeled field']),
              setDate
            )}
            {!dates.length && <p>No readable date fields are available for a watch.</p>}
            {select(
              'Bucket',
              bucket,
              ['HOUR', 'DAY', 'WEEK', 'MONTH'].map((v) => [v, v]),
              setBucket
            )}
            {number('Baseline buckets', 'k', 1, 1000, '1')}
            {(detector === 'SPIKE' || detector === 'DROP') && (
              <>
                {number('Robust z threshold', 'threshold', 0.01)}
                {number('Relative change (fraction)', 'relativeChange', 0)}
              </>
            )}
            {detector === 'OUT_OF_RANGE' && (
              <>
                {number('Minimum', 'min', -Number.MAX_VALUE)}
                {number('Maximum', 'max', -Number.MAX_VALUE)}
                {parameters.min > parameters.max && (
                  <p role="alert">Maximum must be at least minimum.</p>
                )}
              </>
            )}
            {detector === 'NULL_RATE_CREEP' && (
              <>
                {number('Null share increase (fraction)', 'delta', 0, 1)}
                {number('Consecutive buckets', 'n', 1, 1000, '1')}
              </>
            )}
            {select(
              'Severity',
              severity,
              ['INFO', 'WARNING', 'ERROR', 'CRITICAL'].map((v) => [v, v]),
              setSeverity
            )}
          </fieldset>
          {!id && (
            <button
              type="submit"
              className={controlClass}
              disabled={!valid || save.isPending}
              data-qqq-id="watch-save"
            >
              Save watch
            </button>
          )}
        </form>
        {id && <p role="status">Watch saved. Preview uses the saved configuration.</p>}
        <button
          className={controlClass}
          disabled={!id || preview.isPending}
          onClick={() => preview.mutate()}
          data-qqq-id="watch-preview"
        >
          Preview
        </button>
        {(save.error || preview.error) && <ProfileError error={save.error ?? preview.error} />}
        {preview.data && (
          <section aria-label="Watch preview" className="min-w-0 space-y-3">
            <p role="status">{preview.data.verdict?.message}</p>
            {preview.data.chart && (
              <ProfileChart
                chart={preview.data.chart}
                baselineBand={
                  preview.data.verdict?.baselineLow != null &&
                  preview.data.verdict.baselineHigh != null
                    ? [preview.data.verdict.baselineLow, preview.data.verdict.baselineHigh]
                    : undefined
                }
              />
            )}
          </section>
        )}
      </AnalysisDialog>
    </>
  )
}
