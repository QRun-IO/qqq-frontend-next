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

/** @file Editable per-path descendants for one full-copy submission. */
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import type { QRecord } from '@/types'
import type { CopyNode } from '@/lib/utils/copy-tree'
import { copyTreePayload } from '@/lib/utils/copy-tree'
import { zodSchemaFromTableMetadata } from '@/lib/utils/zod-from-metadata'
import { DynamicFormField } from './DynamicFormField'
import type { EntityFormProps } from './EntityForm'

type CopyState = NonNullable<EntityFormProps['copyAssociations']>

/**
 * Maintain independent descendant drafts while the enclosing EntityForm owns Save.
 * @param props - Prepared immutable tree and parent readiness callback.
 * @returns Editors for exact named association paths.
 */
export function FullCopyDraft({ tree, onChange }: { tree: CopyNode; onChange: (state: CopyState) => void }) {
  const edits = useRef<Record<string, Record<string, unknown>>>({})
  const [revision, setRevision] = useState(0)
  const change = useCallback((path: string, values: Record<string, unknown>) => {
    edits.current[path] = values
    setRevision(value => value + 1)
  }, [])
  const state = useMemo<CopyState>(() => {
    let error: string | undefined
    try { copyTreePayload(tree, edits.current) } catch (failure) { error = failure instanceof Error ? failure.message : 'Full copy values are invalid.' }
    return {
      getRecords: rootValues => copyTreePayload(tree, edits.current, rootValues), error, dirty: revision > 0,
      validateResult: (record: QRecord) => {
        /**
         * Require confirmation of every nonempty path after the single insert.
         * @param node - Requested draft.
         * @param result - Corresponding saved record.
         */
        function check(node: CopyNode, result: QRecord) {
          const key = result.values[node.table.primaryKeyField]
          if (result.tableName !== node.table.name || (typeof key !== 'string' && typeof key !== 'number') || key === '') throw new Error('The server did not confirm every copied record identifier.')
          for (const [name, children] of Object.entries(node.groups)) {
            if (!children.length) continue
            const saved = result.associatedRecords?.[name]
            if (!saved || saved.length !== children.length) throw new Error('The server did not confirm every copied association.')
            children.forEach((child, index) => check(child, saved[index]))
          }
        }
        check(tree, record)
      },
    }
  }, [tree, revision])
  useEffect(() => { onChange(state) }, [onChange, state])
  return <CopyGroups node={tree} onChange={change} />
}

/**
 * Render exact group names, preserving known empty groups.
 * @param props - Node and draft-value callback.
 * @returns Named group panels.
 */
function CopyGroups({ node, onChange }: { node: CopyNode; onChange: (path: string, values: Record<string, unknown>) => void }) {
  return <div className="space-y-4">{Object.entries(node.groups).map(([name, children]) => <section key={name} className="min-w-0 rounded-lg border p-4">
    <h3 className="font-semibold">{name} <span className="font-normal text-muted-foreground">({children.length})</span></h3>
    {children.length === 0 ? <p className="text-sm text-muted-foreground">No associated records to copy.</p> : children.map(child => <CopyChild key={child.path} node={child} onChange={onChange} />)}
  </section>)}</div>
}

/**
 * Edit one node locally; no nested form or independent mutation is created.
 * @param props - Prepared node and shared draft-value callback.
 * @returns Metadata-driven fields and nested panels.
 */
function CopyChild({ node, onChange }: { node: CopyNode; onChange: (path: string, values: Record<string, unknown>) => void }) {
  const schema = useMemo(() => zodSchemaFromTableMetadata(node.table, node.fields, true), [node])
  const { register, control, watch, formState: { errors } } = useForm<Record<string, unknown>>({
    defaultValues: node.values, resolver: zodResolver(schema), mode: 'onChange',
  })
  useEffect(() => {
    const subscription = watch(values => onChange(node.path, values))
    return () => subscription.unsubscribe()
  }, [watch, node.path, onChange])
  const id = `copy-node-${encodeURIComponent(node.path)}`
  return <fieldset className="my-4 min-w-0 space-y-4 rounded-lg border p-4" data-qqq-id={id}>
    <legend className="px-2 font-medium">{node.table.label}</legend>
    <div className="grid gap-4 sm:grid-cols-2">{node.fields.map(name => <DynamicFormField key={name} idPrefix={id}
      field={node.table.fields[name]} register={register} control={control} errors={errors}
      possibleValueContext={{ type: 'table', tableName: node.table.name }} />)}</div>
    <CopyGroups node={node} onChange={onChange} />
  </fieldset>
}
