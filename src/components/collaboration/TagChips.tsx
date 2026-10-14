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

/** @file Record tags with accessible vocabulary completion and policy-aware creation. */
'use client'
import { useId, useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { CollaborationRecord, RecordFeaturesV1, CollaborationTag } from '@/types/collaboration'
import {
  useRecordTags,
  useTagVocabulary,
  useUpdateTags,
  useCreateTag,
} from '@/lib/hooks/use-collaboration-record'

/** Keeps a chip control at its drawn size on touch screens, where the global rule lifts every
 * button to 44 px and turned each chip into a tall pill; a transparent overlay of at least
 * 44 x 44 px keeps the touch target. That rule is unlayered, so it outranks any utility class
 * and only the important modifier resets it.
 * @param classes - The control's own classes.
 * @returns Classes with the compact size and the enlarged hit area.
 */
function compactTouchTarget(classes: string) {
  return `${classes} relative min-h-0! min-w-0! after:absolute after:left-1/2 after:top-1/2 after:min-h-11 after:min-w-11 after:h-full after:w-full after:-translate-x-1/2 after:-translate-y-1/2 after:content-[''] pointer-fine:after:hidden`
}

/** Applied chips and tag combobox; pending suggestions are never applied.
 * @param props - Parent and effective tag policy.
 * @returns Wrapping tags.
 */
export function TagChips({
  record,
  features,
}: {
  record: CollaborationRecord
  features: RecordFeaturesV1
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const [notice, setNotice] = useState('')
  const tags = useRecordTags(record)
  const vocabulary = useTagVocabulary(record.table, q, open)
  const update = useUpdateTags(record)
  const create = useCreateTag(record.table)
  const canTag = features.capabilities?.tag === true
  const approvedOnly = features.settings?.TAGS?.mode === 'APPROVED_ONLY'
  const options = (vocabulary.data?.items ?? []).filter(
    (tag) => tag.approved && !tags.data?.items.some((item) => item.id === tag.id)
  )
  const busy = update.isPending || create.isPending || !tags.isSuccess
  const add = (tag: CollaborationTag) => {
    update.mutate({ add: [tag] })
    setQ('')
    setOpen(false)
  }
  const exact = vocabulary.data?.items.some(
    (tag) =>
      (tag.name ?? tag.label).toLowerCase().replace(/\s+/g, ' ').trim() ===
      q.toLowerCase().replace(/\s+/g, ' ').trim()
  )
  return (
    <div className="mt-2 space-y-2" data-qqq-id="record-tags">
      <div className="flex flex-wrap items-center gap-2">
        {tags.data?.items.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs leading-5"
          >
            <span className="min-w-0 break-words">{tag.label}</span>
            {canTag && (
              <button
                type="button"
                disabled={busy}
                aria-label={`Remove tag ${tag.label}`}
                data-qqq-id={`tag-remove-${tag.id}`}
                className={compactTouchTarget('rounded-full p-0.5 hover:bg-accent')}
                onClick={() => update.mutate({ remove: [tag.id] })}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
          </span>
        ))}
        {canTag && (
          <button
            type="button"
            aria-expanded={open}
            className={compactTouchTarget(
              'inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs leading-5'
            )}
            data-qqq-id="tag-add"
            onClick={() => setOpen(!open)}
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            Add tag
          </button>
        )}
      </div>
      {open && canTag && (
        <div className="max-w-sm space-y-1 rounded border border-border bg-popover p-2">
          <label htmlFor={id} className="sr-only">
            Find or create a tag
          </label>
          <input
            id={id}
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-controls={`${id}-options`}
            aria-activedescendant={options[active] ? `${id}-${active}` : undefined}
            autoFocus
            value={q}
            maxLength={60}
            className="w-full rounded border border-border bg-background p-2 text-sm"
            placeholder="Find or create a tag"
            data-qqq-id="tag-search"
            onChange={(event) => {
              setQ(event.target.value)
              setActive(0)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpen(false)
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault()
                setActive((current) =>
                  Math.max(
                    0,
                    Math.min(options.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1))
                  )
                )
              }
              if (event.key === 'Enter' && options[active] && !busy) {
                event.preventDefault()
                add(options[active])
              }
            }}
          />
          <div role="listbox" id={`${id}-options`} aria-label="Tags">
            {options.map((tag, index) => (
              <button
                key={tag.id}
                type="button"
                role="option"
                id={`${id}-${index}`}
                aria-selected={active === index}
                disabled={busy}
                onClick={() => add(tag)}
                className="block w-full rounded p-2 text-left text-sm aria-selected:bg-accent"
                data-qqq-id={`tag-option-${tag.id}`}
              >
                {tag.label}
              </button>
            ))}
          </div>
          {vocabulary.isError && <p role="alert">Could not load tags.</p>}
          {q.trim() && !exact && vocabulary.isSuccess && (
            <button
              type="button"
              disabled={busy || (features.capabilities?.createTag === false && !approvedOnly)}
              className="block w-full rounded p-2 text-left text-sm text-primary"
              data-qqq-id="tag-create"
              onClick={() =>
                create.mutate(q.trim(), {
                  onSuccess: (tag) => {
                    if (!approvedOnly && tag.approved) add(tag)
                    else {
                      setNotice(`Suggested tag: ${tag.label}`)
                      setQ('')
                      setOpen(false)
                    }
                  },
                })
              }
            >
              {approvedOnly ? 'Suggest tag' : 'Create tag'} “{q.trim()}”
            </button>
          )}
        </div>
      )}
      {notice && (
        <p role="status" className="text-xs text-muted-foreground">
          {notice}
        </p>
      )}
      {(tags.isError || update.isError || create.isError) && (
        <p role="alert" className="text-xs text-destructive">
          Could not update tags. Please try again.
        </p>
      )}
    </div>
  )
}
