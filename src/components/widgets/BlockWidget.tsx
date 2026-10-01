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

/**
 * @file BlockWidget — Renders a heterogeneous collection of block elements from the backend.
 *
 * Supported block types: text, big_number, up_or_down, progress, button, icon,
 * image, audio, divider, input, and html. HTML content is sanitized with DOMPurify.
 */
'use client'

import React from 'react'
import {
  ArrowUp,
  ArrowDown,
  HelpCircle,
} from 'lucide-react'
import { sanitizeHtml } from '@/lib/utils/sanitize-html'

import type { BlockData } from '@/types'
import { cn } from '@/lib/utils/cn'
import { isHttpUrl, isRelativeUrl } from '@/lib/utils/string-utils'

/** Wire-format payload for a block widget or legacy HTML widget from the backend API. */
export interface BlockWidgetPayload {
  /** Discriminator widget type string, e.g. `'block'` or `'html'`. */
  type?: string
  /** Ordered array of typed block elements to render; takes precedence over `html`. */
  blocks?: BlockData[]
  /** Layout direction for the block container (default `'vertical'`). */
  layout?: 'vertical' | 'horizontal' | 'grid'
  /**
   * Legacy raw HTML string for backward compatibility with plain `'html'`-type widgets.
   * Only used when `blocks` is absent or empty; sanitized with DOMPurify before rendering.
   */
  html?: string
}

/** Props accepted by the BlockWidget component. */
interface BlockWidgetProps {
  /** Typed payload from the widget API response; `data.type` determines the rendering path. */
  data: BlockWidgetPayload
  /** Unique widget name used to scope `data-qqq-id` attributes on the container and each block. */
  widgetName: string
}

/**
 * Tailwind class map controlling the flex/grid layout of the block container.
 *
 * Keys correspond to the `layout` field in BlockWidgetPayload.
 */
const LAYOUT_CLASSES: Record<string, string> = {
  vertical: 'flex flex-col gap-4',
  horizontal: 'flex flex-row flex-wrap gap-4',
  grid: 'grid grid-cols-2 gap-4',
}

/**
 * Renders a collection of typed block elements in a configurable layout.
 *
 * Dispatched by `WidgetRenderer` for both `'block'` and `'html'` widget types.
 * Falls back to rendering DOMPurify-sanitized raw HTML when the payload contains
 * a legacy `html` string without any structured `blocks` array.  When `blocks`
 * is present but empty, a "No block content available" placeholder is shown.
 * Each block element is dispatched to `BlockRenderer` which covers all types:
 * text, big_number, up_or_down, progress, button, icon, image, audio, divider,
 * input, and html — with an exhaustive TypeScript check on the `default` branch
 * to surface unhandled types at compile time.
 *
 * @param props - Component properties; `data.type` controls which rendering path
 *   is taken (legacy `html` vs structured `blocks`).
 * @returns A layout `<div>` containing rendered block elements, a DOMPurify-sanitized
 *   HTML `<div>`, or an empty-state `<p>`.
 */
export function BlockWidget({ data, widgetName }: BlockWidgetProps) {
  // Legacy backward compat: if there's a raw html string and no blocks, render as HTML directly
  if (data.html && (!data.blocks || data.blocks.length === 0)) {
    return (
      <div
        className="prose prose-sm max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(data.html) }}
        data-qqq-id={`block-widget-${widgetName}`}
      />
    )
  }

  const blocks = data.blocks ?? []
  const layoutClass = LAYOUT_CLASSES[data.layout ?? 'vertical'] ?? LAYOUT_CLASSES.vertical

  if (blocks.length === 0) {
    return (
      <p
        className="text-sm text-muted-foreground"
        data-qqq-id={`block-widget-empty-${widgetName}`}
      >
        No block content available
      </p>
    )
  }

  return (
    <div
      className={layoutClass}
      data-qqq-id={`block-widget-${widgetName}`}
    >
      {blocks.map((block, index) => (
        <BlockRenderer key={`${block.type}-${index}`} block={block} widgetName={widgetName} index={index} />
      ))}
    </div>
  )
}

/** Props accepted by the internal BlockRenderer helper. */
interface BlockRendererProps {
  /** A single block element from the blocks array. */
  block: BlockData
  /** Parent widget name used for data-qqq-id scoping. */
  widgetName: string
  /** Zero-based index of this block within the parent list. */
  index: number
}

/**
 * Dispatches a single BlockData element to the appropriate JSX renderer.
 *
 * Covers all supported block types via a switch statement. An exhaustive check
 * on the `default` branch ensures TypeScript surfaces unhandled types at
 * compile time.
 *
 * @param props - Component properties.
 * @returns The rendered block element for the given block type.
 */
function BlockRenderer({ block, widgetName, index }: BlockRendererProps) {
  switch (block.type) {
    case 'text':
      return (
        <p
          className="text-sm text-foreground"
          style={block.styles}
          data-qqq-id={`block-text-${widgetName}-${index}`}
        >
          {block.text}
        </p>
      )

    case 'big_number':
      return (
        <div
          className="flex flex-col items-center gap-1"
          data-qqq-id={`block-big-number-${widgetName}-${index}`}
        >
          <span className="text-3xl font-bold text-foreground">
            {block.value}
          </span>
          {block.label && (
            <span className="text-xs text-muted-foreground">
              {block.label}
            </span>
          )}
        </div>
      )

    case 'up_or_down': {
      const isUp = block.value >= block.baseValue
      return (
        <div
          className="flex items-center gap-2"
          data-qqq-id={`block-up-or-down-${widgetName}-${index}`}
        >
          {isUp ? (
            <ArrowUp
              className="h-4 w-4 text-green-600"
              aria-label="Up"
            />
          ) : (
            <ArrowDown
              className="h-4 w-4 text-destructive"
              aria-label="Down"
            />
          )}
          <span
            className={cn(
              'text-lg font-semibold',
              isUp ? 'text-green-600' : 'text-destructive'
            )}
          >
            {block.value}
          </span>
          {block.label && (
            <span className="text-xs text-muted-foreground">
              {block.label}
            </span>
          )}
        </div>
      )
    }

    case 'progress': {
      const percentage = block.max > 0 ? Math.min(Math.round((block.value / block.max) * 100), 100) : 0
      return (
        <div
          className="flex flex-col gap-1"
          data-qqq-id={`block-progress-${widgetName}-${index}`}
        >
          {block.label && (
            <span className="text-xs font-medium text-muted-foreground">
              {block.label}
            </span>
          )}
          <div
            className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={block.value}
            aria-valuemin={0}
            aria-valuemax={block.max}
            aria-label={block.label ?? `Progress: ${percentage}%`}
          >
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {percentage}%
          </span>
        </div>
      )
    }

    case 'button':
      return (
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
          data-qqq-id={`block-button-${block.label}`}
          data-action-code={block.actionCode}
          aria-label={block.label}
        >
          {block.label}
        </button>
      )

    case 'icon':
      return (
        <div
          className="inline-flex items-center justify-center"
          data-qqq-id={`block-icon-${widgetName}-${index}`}
          aria-label={block.iconName}
        >
          <HelpCircle
            className="text-muted-foreground"
            style={{
              color: block.color ?? undefined,
              width: block.size ?? 24,
              height: block.size ?? 24,
            }}
            aria-hidden="true"
          />
        </div>
      )

    case 'image':
      return (isHttpUrl(block.src) || isRelativeUrl(block.src)) ? (
        <img
          src={block.src}
          alt={block.alt}
          width={block.width}
          height={block.height}
          className="max-w-full rounded"
          data-qqq-id={`block-image-${widgetName}-${index}`}
        />
      ) : (
        <div
          className="text-sm text-muted-foreground p-2"
          data-qqq-id={`block-image-${widgetName}-${index}`}
        >
          Invalid media source
        </div>
      )

    case 'audio':
      return (
        <div data-qqq-id={`block-audio-${widgetName}-${index}`}>
          {block.label && (
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              {block.label}
            </p>
          )}
          {(isHttpUrl(block.src) || isRelativeUrl(block.src)) ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <audio
              controls
              src={block.src}
              aria-label={block.label ?? 'Audio player'}
              className="w-full"
            >
              Your browser does not support the audio element.
            </audio>
          ) : (
            <div className="text-sm text-muted-foreground p-2">
              Invalid media source
            </div>
          )}
        </div>
      )

    case 'divider':
      return (
        <hr
          className="border-border"
          data-qqq-id={`block-divider-${widgetName}-${index}`}
        />
      )

    case 'input':
      return (
        <div
          className="flex flex-col gap-1"
          data-qqq-id={`block-input-${widgetName}-${block.name}`}
        >
          <label
            htmlFor={`block-input-${widgetName}-${block.name}`}
            className="text-xs font-medium text-muted-foreground"
          >
            {block.label}
          </label>
          <input
            id={`block-input-${widgetName}-${block.name}`}
            name={block.name}
            type={block.inputType ?? 'text'}
            defaultValue={block.defaultValue ?? ''}
            className="rounded-md border border-input px-3 py-1.5 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label={block.label}
            data-qqq-id={`block-input-field-${widgetName}-${block.name}`}
          />
        </div>
      )

    case 'html':
      return (
        <div
          className="prose prose-sm max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.html) }}
          data-qqq-id={`block-html-${widgetName}-${index}`}
        />
      )

    default: {
      // Exhaustive check: if a new block type is added without a case,
      // TypeScript will flag this assignment as an error.
      const _exhaustive: never = block
      return (
        <p className="text-xs text-muted-foreground" data-qqq-id={`block-unknown-${widgetName}-${index}`}>
          Unknown block type: {(_exhaustive as BlockData).type}
        </p>
      )
    }
  }
}
