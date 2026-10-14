/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

/** @file EDI mapper route and local rule workspace. Server state is never edited until Save. */
'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QRecord, QTableMetaData } from '@/types'
import type { EdiGuideTreeV1, EdiRuleV1, EdiTargetV1, EdiValidationV1 } from '@/types/edi'
import { getEdiGuide, getEdiTarget, validateEdiRules } from '@/lib/api/edi'
import { deleteRecord, getRecord, insertRecord, updateRecord } from '@/lib/api/tables'
import { loadMetaData } from '@/lib/api/metadata'
import {
  canDeleteRecords,
  canEditRecords,
  canInsertRecords,
  canReadRecords,
} from '@/lib/auth/permissions'
import { useEdiAvailable } from '@/lib/hooks/use-edi'
import { queryKeys } from '@/lib/query-client'
import { buttonClass, tabClass } from '@/components/ui/controls'
import { GuideTree, control } from './GuideTree'
import { RuleEditor } from './RuleEditor'

const PreviewPane = dynamic(() => import('./PreviewPane'), {
  loading: () => <p role="status">Loading preview…</p>,
})
const views = ['Guide', 'Fields', 'Rules', 'Preview'] as const
type View = (typeof views)[number]
type LocalRule = { key: number; value: EdiRuleV1 }

/** Loads only permitted map data after extension discovery.
 * @param props - Positive map record identifier.
 * @returns Guarded mapper route.
 */
export default function EdiMapperPage({ mapId }: { mapId: number }) {
  const available = useEdiAvailable()
  const metadata = useQuery({
    queryKey: queryKeys.metadataAll(),
    queryFn: loadMetaData,
    staleTime: 30 * 60_000,
  })
  const allowed =
    available.data === true &&
    canReadRecords(metadata.data?.tables?.edi_map) &&
    Number.isSafeInteger(mapId) &&
    mapId > 0
  const map = useQuery({
    queryKey: queryKeys.ediMap(mapId),
    queryFn: () => getRecord('edi_map', mapId),
    enabled: allowed,
  })
  const target = useQuery({
    queryKey: queryKeys.ediTarget(mapId),
    queryFn: () => getEdiTarget(mapId),
    enabled: !!map.data && allowed,
  })
  const guideId = Number(map.data?.values.guideId)
  const guide = useQuery({
    queryKey: queryKeys.ediGuide(guideId),
    queryFn: () => getEdiGuide(guideId),
    enabled: allowed && !!map.data && guideId > 0,
  })
  if (available.isError || metadata.isError || map.isError || target.isError || guide.isError)
    return (
      <p role="alert">
        Could not open mapper. Check your access to this map, guide and target, then reload.
      </p>
    )
  if (available.data === false)
    return <p role="status">EDI Mapper is not available on this server.</p>
  if (metadata.data && !canReadRecords(metadata.data.tables?.edi_map))
    return <p role="alert">You do not have permission to read this map.</p>
  if (!Number.isSafeInteger(mapId) || mapId <= 0) return <p role="alert">Invalid map identifier.</p>
  if (map.data && !(guideId > 0))
    return <p role="alert">This map does not have a guide. Set a guide on the map record first.</p>
  if (!map.data || !target.data || !guide.data) return <p role="status">Loading mapper…</p>
  return (
    <MapperWorkspace
      mapId={mapId}
      map={map.data}
      target={target.data}
      guide={guide.data}
      ruleTable={metadata.data?.tables?.edi_map_rule}
    />
  )
}

/** Edits rules locally; confirmed writes update the baseline so partial failures can be retried.
 * @param props - Permitted map, guide, target and rule permissions.
 * @returns Responsive mapper panes.
 */
export function MapperWorkspace({
  mapId,
  map,
  target,
  guide,
  ruleTable,
}: {
  mapId: number
  map: QRecord
  target: EdiTargetV1
  guide: EdiGuideTreeV1
  ruleTable?: QTableMetaData
}) {
  const initial = [...(target.rules ?? [])].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
  const [rules, setRules] = useState<LocalRule[]>(() =>
    initial.map((value, key) => ({ key, value }))
  )
  const [baseline, setBaseline] = useState(initial)
  const [status, setStatus] = useState(String(map.values.status))
  const [selectedElement, setSelectedElement] = useState('')
  const [selectedField, setSelectedField] = useState('')
  const [view, setView] = useState<View>('Guide')
  const [previewOpened, setPreviewOpened] = useState(false)
  const [validation, setValidation] = useState<EdiValidationV1 | null>(null)
  const [message, setMessage] = useState('')
  const [needsReload, setNeedsReload] = useState(false)
  const nextKey = useRef(rules.length)
  const client = useQueryClient()
  const sorted = [...rules].sort((a, b) => (a.value.sequence ?? 0) - (b.value.sequence ?? 0))
  const values = sorted.map((rule) => rule.value)
  const dirty =
    JSON.stringify(values) !==
    JSON.stringify([...baseline].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)))
  const draft = status === 'DRAFT'
  const canSave =
    (!values.some((rule) => !rule.id) || canInsertRecords(ruleTable)) &&
    (!values.some(
      (rule) =>
        rule.id &&
        JSON.stringify(rule) !== JSON.stringify(baseline.find((old) => old.id === rule.id))
    ) ||
      canEditRecords(ruleTable)) &&
    (!baseline.some((rule) => !values.some((current) => current.id === rule.id)) ||
      canDeleteRecords(ruleTable))

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const validate = useMutation({
    mutationFn: () => validateEdiRules(mapId, values),
    onSuccess: (result) => {
      setValidation(result)
      if (result.rules?.some((rule) => rule.errors?.length)) setView('Rules')
      setMessage(
        result.rules?.some((rule) => rule.errors?.length)
          ? 'Fix the rule errors below.'
          : 'Validation passed.'
      )
    },
  })
  const save = useMutation({
    mutationFn: async () => {
      if (!draft || !canSave || needsReload)
        throw new Error('This map cannot be saved with your current permissions.')
      const currentMap = await getRecord('edi_map', mapId)
      setStatus(String(currentMap.values.status))
      if (currentMap.values.status !== 'DRAFT')
        throw new Error('The map is no longer a draft. Open its record to create a draft revision.')
      const result = await validateEdiRules(mapId, values)
      setValidation(result)
      if (result.rules?.some((rule) => rule.errors?.length)) {
        setView('Rules')
        throw new Error('Fix the rule errors before saving.')
      }
      // Core CRUD is not a transaction. Keep confirmed IDs and deletions after each operation;
      // a later refusal must not cause an inserted rule to be inserted again on retry.
      let saved = [...baseline]
      for (const local of sorted) {
        const rule = local.value
        if (
          rule.id &&
          JSON.stringify(rule) === JSON.stringify(saved.find((old) => old.id === rule.id))
        )
          continue
        const record = rule.id
          ? await updateRecord('edi_map_rule', rule.id, { ...rule, mapId })
          : await insertRecord('edi_map_rule', { ...rule, mapId })
        const id = Number(record.values.id)
        if (!Number.isSafeInteger(id) || id <= 0) {
          setNeedsReload(true)
          throw new Error(
            'The server did not return a rule identifier. Reload before saving again.'
          )
        }
        const confirmed = { ...rule, id }
        saved = [...saved.filter((old) => old.id !== id), confirmed]
        setBaseline(saved)
        setRules((current) =>
          current.map((item) => (item.key === local.key ? { ...item, value: confirmed } : item))
        )
      }
      for (const old of baseline) {
        if (old.id && !values.some((rule) => rule.id === old.id)) {
          await deleteRecord('edi_map_rule', old.id)
          saved = saved.filter((rule) => rule.id !== old.id)
          setBaseline(saved)
        }
      }
      await client.invalidateQueries({ queryKey: queryKeys.ediTarget(mapId) })
      setMessage('Rules saved.')
    },
  })
  const busy = validate.isPending || save.isPending
  const changed = (next: LocalRule[]) => {
    setRules(next)
    setValidation(null)
    setMessage('')
    validate.reset()
    save.reset()
  }
  const addRule = (path = selectedElement, field = selectedField) => {
    if (!path || !field) return
    changed([
      ...rules,
      {
        key: nextKey.current++,
        value: {
          ediPath: path,
          qqqPath: field,
          sequence: Math.max(0, ...values.map((rule) => rule.sequence ?? 0)) + 10,
          required: false,
          transform: null,
          transformArgs: '{}',
        },
      },
    ])
    setView('Rules')
  }
  const panelClass = (name: View) =>
    `${view === name ? 'block' : 'hidden'} min-w-0 space-y-3 rounded-lg border border-border bg-card p-4 lg:block`
  const fieldGroups = [
    { label: target.table ?? 'Target fields', prefix: '', fields: target.fields },
    ...(target.associations ?? [])
      .filter((association) => association.name)
      .map((association) => ({
        label: association.label ?? association.name ?? 'Association',
        prefix: `${association.name}.`,
        fields: association.fields,
      })),
  ]

  return (
    <div className="min-w-0 max-w-full space-y-4 text-foreground" data-qqq-id="edi-mapper">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold">
            EDI Mapper — {String(map.values.name ?? map.recordLabel ?? mapId)}
          </h1>
          <p>
            {status} · {dirty ? 'Unsaved changes' : 'Saved rules'}
          </p>
        </div>
        <Link
          href={`/app/edi_map/${mapId}`}
          onClick={(event) => {
            if (dirty && !window.confirm('Discard unsaved rule changes and open the map record?'))
              event.preventDefault()
          }}
          className={control}
          data-qqq-id="edi-map-record"
        >
          Map record
        </Link>
      </header>
      {!draft && (
        <p className="rounded border border-border bg-muted p-3">
          Create Draft Revision: open the map record and use the qbit&apos;s Activate Map revision
          workflow. You can try changes in preview here; Save is available only for DRAFT maps.
        </p>
      )}
      <p id="edi-mapping-help" className="text-sm">
        Select a guide element, select a target field, then choose Add rule. You can also drag an
        element onto a field.
      </p>
      <p role="status" className="break-words">
        Selected element: {selectedElement || 'None'} · Field: {selectedField || 'None'}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonClass()}
          data-qqq-id="edi-add-rule"
          disabled={busy || !selectedElement || !selectedField}
          onClick={() => addRule()}
        >
          Add rule
        </button>
        <button
          type="button"
          className={buttonClass()}
          data-qqq-id="edi-validate"
          disabled={busy}
          onClick={() => validate.mutate()}
        >
          Validate rules
        </button>
        <button
          type="button"
          className={buttonClass('primary')}
          data-qqq-id="edi-save"
          disabled={busy || !draft || !dirty || !canSave || needsReload}
          onClick={() => save.mutate()}
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
      {dirty && draft && !canSave && (
        <p role="status">Your rule permissions do not allow all these changes.</p>
      )}
      {message && <p role="status">{message}</p>}
      {(save.error || validate.error) && (
        <p role="alert">
          {save.error?.message ?? 'Validation failed. Check your access and try again.'} Your local
          changes are retained; earlier confirmed writes may already be saved.
        </p>
      )}
      <div role="tablist" aria-label="Mapper panes" className="grid grid-cols-4 gap-1 lg:hidden">
        {views.map((name, index) => (
          <button
            key={name}
            type="button"
            role="tab"
            id={`edi-tab-${name}`}
            aria-controls={`edi-panel-${name}`}
            aria-selected={view === name}
            tabIndex={view === name ? 0 : -1}
            className={`${tabClass(view === name)} min-w-0 px-1`}
            data-qqq-id={`edi-tab-${name}`}
            onClick={() => {
              setView(name)
              if (name === 'Preview') setPreviewOpened(true)
            }}
            onKeyDown={(event) => {
              const next =
                event.key === 'ArrowRight'
                  ? (index + 1) % 4
                  : event.key === 'ArrowLeft'
                    ? (index + 3) % 4
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? 3
                        : -1
              if (next >= 0) {
                event.preventDefault()
                setView(views[next])
                if (views[next] === 'Preview') setPreviewOpened(true)
                document.getElementById(`edi-tab-${views[next]}`)?.focus()
              }
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <fieldset
        disabled={busy}
        className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-2 xl:grid-cols-3"
      >
        <legend className="sr-only">Mapping workspace</legend>
        <section
          id="edi-panel-Guide"
          role="tabpanel"
          aria-labelledby="edi-tab-Guide"
          className={panelClass('Guide')}
        >
          <h2 className="text-lg font-semibold">Guide</h2>
          <GuideTree tree={guide} selected={selectedElement} onSelect={setSelectedElement} />
        </section>
        <div className="min-w-0 space-y-4">
          <section
            id="edi-panel-Fields"
            role="tabpanel"
            aria-labelledby="edi-tab-Fields"
            className={panelClass('Fields')}
          >
            <h2 className="text-lg font-semibold">Fields</h2>
            {fieldGroups.map((group, index) => (
              <section key={index} className="space-y-2">
                <h3 className="break-words font-medium">{group.label}</h3>
                {group.fields
                  ?.filter((field) => field.name)
                  .map((field) => {
                    const path = `${group.prefix}${field.name}`
                    return (
                      <button
                        key={path}
                        type="button"
                        className={`${control} block w-full whitespace-normal text-left break-words`}
                        data-qqq-id={`edi-field-${path}`}
                        aria-pressed={selectedField === path}
                        aria-describedby="edi-mapping-help"
                        onClick={() => setSelectedField(path)}
                        onDragOver={(event) => {
                          if (event.dataTransfer.types.includes('application/x-edi-path')) {
                            event.preventDefault()
                            event.dataTransfer.dropEffect = 'copy'
                          }
                        }}
                        onDrop={(event) => {
                          event.preventDefault()
                          const pathFromGuide = event.dataTransfer.getData('application/x-edi-path')
                          if (pathFromGuide && !busy) {
                            setSelectedField(path)
                            addRule(pathFromGuide, path)
                          }
                        }}
                      >
                        {field.label ?? field.name}
                        {field.required ? ' (required)' : ''}
                        <span className="block text-xs text-muted-foreground">
                          {path} · {field.type}
                        </span>
                      </button>
                    )
                  })}
              </section>
            ))}
          </section>
          <section
            id="edi-panel-Rules"
            role="tabpanel"
            aria-labelledby="edi-tab-Rules"
            className={panelClass('Rules')}
          >
            <h2 className="text-lg font-semibold">Rules ({rules.length})</h2>
            {!rules.length && <p>No rules yet. Select an element and field to add one.</p>}
            {sorted.map((local, index) => (
              <details
                key={local.key}
                open={local.value.id == null}
                className="min-w-0 space-y-3 rounded border border-border p-3"
              >
                <summary
                  className="cursor-pointer break-words"
                  data-qqq-id={`edi-rule-${local.key}`}
                >
                  Rule {local.value.sequence ?? index + 1}: {local.value.ediPath} →{' '}
                  {local.value.qqqPath}
                </summary>
                <RuleEditor
                  id={`edi-rule-${local.key}`}
                  rule={local.value}
                  transforms={target.transforms ?? []}
                  onChange={(value) =>
                    changed(
                      rules.map((item) => (item.key === local.key ? { ...item, value } : item))
                    )
                  }
                />
                {validation?.rules
                  ?.filter((error) => error.index === index)
                  .flatMap((error) => error.errors ?? [])
                  .map((error, i) => (
                    <p key={i} role="alert" className="break-words text-destructive">
                      {error}
                    </p>
                  ))}
                <button
                  type="button"
                  className={control}
                  data-qqq-id={`edi-delete-rule-${local.key}`}
                  aria-label={`Delete rule ${local.value.sequence ?? index + 1}`}
                  onClick={() => changed(rules.filter((item) => item.key !== local.key))}
                >
                  Delete rule
                </button>
              </details>
            ))}
          </section>
        </div>
        <section
          id="edi-panel-Preview"
          role="tabpanel"
          aria-labelledby="edi-tab-Preview"
          className={`${panelClass('Preview')} lg:col-span-2 xl:col-span-1`}
        >
          <h2 className="text-lg font-semibold">Preview</h2>
          {previewOpened ? (
            <PreviewPane mapId={mapId} rules={values} />
          ) : (
            <button
              type="button"
              data-qqq-id="edi-open-preview"
              className={control}
              onClick={() => setPreviewOpened(true)}
            >
              Choose sample and preview
            </button>
          )}
        </section>
      </fieldset>
    </div>
  )
}
