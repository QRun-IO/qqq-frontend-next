/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

/** @file Searchable, keyboard-selectable guide tree with native disclosure controls. */
'use client'
import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import type { EdiGuideTreeV1, EdiLoopV1, EdiSegmentV1 } from '@/types/edi'
import { INPUT_CLASS } from '@/components/ui/controls'
import { cn } from '@/lib/utils/cn'

/** Shared control styles, using the application's light and dark theme tokens. */
export const control = cn(
  INPUT_CLASS,
  'w-auto min-w-0 max-w-full disabled:opacity-50 aria-pressed:border-primary aria-pressed:bg-accent'
)

/** Displays usage without relying on color.
 * @param props - Usage code.
 * @returns Usage badge.
 */
function Usage({ value }: { value?: string | null }) {
  return value ? (
    <span
      className="rounded border border-border px-1 text-xs"
      title={{ R: 'Required', S: 'Situational', N: 'Not used' }[value] ?? value}
    >
      {value}
    </span>
  ) : null
}

/** Renders segments within their loop scope.
 * @param props - Segments, path prefix, search and selection.
 * @returns Segment disclosures and element controls.
 */
function Segments({
  segments = [],
  prefix,
  search,
  selected,
  onSelect,
}: {
  segments?: EdiSegmentV1[]
  prefix: string
  search: string
  selected: string
  onSelect: (path: string) => void
}) {
  return segments.map((segment, index) => {
    const allMatch = `${segment.id} ${segment.name}`.toLowerCase().includes(search)
    const elements = (segment.elements ?? []).filter(
      (element) => allMatch || `${element.id} ${element.name}`.toLowerCase().includes(search)
    )
    if (search && !allMatch && !elements.length) return null
    return (
      <details
        key={`${segment.id}-${index}`}
        open={search ? true : undefined}
        className="min-w-0 rounded border border-border p-2"
      >
        <summary
          className="cursor-pointer break-words"
          data-qqq-id={`edi-segment-${prefix}${segment.id}`}
        >
          <span>
            {segment.id} — {segment.name}
          </span>{' '}
          <Usage value={segment.usage} />
        </summary>
        <ul className="mt-2 space-y-2">
          {elements.map((element, i) => {
            const path =
              segment.id && element.position != null
                ? `${prefix}${segment.id}${String(element.position).padStart(2, '0')}${element.component ? `-${element.component}` : ''}`
                : ''
            return (
              <li key={`${path}-${i}`} className="min-w-0 space-y-1">
                <button
                  type="button"
                  className={`${control} w-full whitespace-normal text-left break-words`}
                  draggable
                  disabled={!path}
                  aria-pressed={selected === path}
                  aria-describedby="edi-mapping-help"
                  data-qqq-id={`edi-element-${path}`}
                  onDragStart={(event) => {
                    event.dataTransfer.setData('application/x-edi-path', path)
                    event.dataTransfer.effectAllowed = 'copy'
                    onSelect(path)
                  }}
                  onClick={() => onSelect(path)}
                >
                  {path || 'Position unavailable'} — {element.name} <Usage value={element.usage} />
                </button>
                <details className="text-sm">
                  <summary className="cursor-pointer" data-qqq-id={`edi-element-details-${path}`}>
                    Element details
                  </summary>
                  <p>
                    Type: {element.type ?? 'Unspecified'} · Length: {element.minLength ?? '—'} to{' '}
                    {element.maxLength ?? '—'}
                  </p>
                </details>
                {!!element.codes?.length && (
                  <Popover.Root>
                    <Popover.Trigger
                      className={`${control} text-xs`}
                      data-qqq-id={`edi-codes-${path}`}
                    >
                      Codes for {path}
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Content
                        sideOffset={4}
                        className="z-50 max-h-64 w-64 max-w-[calc(100vw-2rem)] overflow-y-auto rounded border border-border bg-popover p-3 text-popover-foreground shadow-lg"
                      >
                        <p className="font-medium">Allowed codes</p>
                        <ul className="break-words">
                          {element.codes.map((code, codeIndex) => (
                            <li key={codeIndex}>{code}</li>
                          ))}
                        </ul>
                        <Popover.Close
                          className={control}
                          aria-label="Close codes"
                          data-qqq-id="edi-close-codes"
                        >
                          Close
                        </Popover.Close>
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>
                )}
              </li>
            )
          })}
        </ul>
      </details>
    )
  })
}

/** Keeps nested loop scopes in generated EDI paths.
 * @param props - Loops and selection state.
 * @returns Nested loop disclosures.
 */
function Loops({
  loops = [],
  prefix = '',
  ...props
}: {
  loops?: EdiLoopV1[]
  prefix?: string
  search: string
  selected: string
  onSelect: (path: string) => void
}) {
  return loops
    .filter(
      (loop) =>
        loop.id && (!props.search || JSON.stringify(loop).toLowerCase().includes(props.search))
    )
    .map((loop, index) => (
      <details
        key={`${loop.id}-${index}`}
        open={props.search ? true : undefined}
        className="min-w-0 rounded border border-border p-2"
      >
        <summary
          className="cursor-pointer break-words"
          data-qqq-id={`edi-loop-${prefix}${loop.id}`}
        >
          Loop {loop.id} (repeat {loop.repeat ?? 1})
        </summary>
        <div className="mt-2 space-y-2">
          <Segments
            segments={loop.segments}
            prefix={`${prefix}${loop.id}${(loop.repeat ?? 1) > 1 ? '[*]' : ''}/`}
            {...props}
            search={loop.id?.toLowerCase().includes(props.search) ? '' : props.search}
          />
          <Loops
            loops={loop.loops}
            prefix={`${prefix}${loop.id}${(loop.repeat ?? 1) > 1 ? '[*]' : ''}/`}
            {...props}
            search={loop.id?.toLowerCase().includes(props.search) ? '' : props.search}
          />
        </div>
      </details>
    ))
}

/** Renders the server's guide, never a synthetic fallback.
 * @param props - Guide and selected element.
 * @returns Search and guide disclosures.
 */
export function GuideTree({
  tree,
  selected,
  onSelect,
}: {
  tree: EdiGuideTreeV1
  selected: string
  onSelect: (path: string) => void
}) {
  const [search, setSearch] = useState('')
  return (
    <div className="min-w-0 space-y-3">
      <label className="block" htmlFor="edi-guide-search">
        Search guide
      </label>
      <input
        id="edi-guide-search"
        data-qqq-id="edi-guide-search"
        className={`${control} w-full`}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <Segments
        segments={tree.segments}
        prefix=""
        search={search.toLowerCase()}
        selected={selected}
        onSelect={onSelect}
      />
      <Loops
        loops={tree.loops}
        search={search.toLowerCase()}
        selected={selected}
        onSelect={onSelect}
      />
      {!tree.segments?.length && !tree.loops?.length && <p>No guide elements are available.</p>}
    </div>
  )
}
