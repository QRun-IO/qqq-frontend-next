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
 * @file QqqComposite — renders a canonical QQQ `CompositeWidgetData` payload: a
 * (possibly nested) list of blocks arranged by one of the backend layouts.
 *
 * Parity reference: Material dashboard `CompositeWidget.tsx` / `WidgetBlock.tsx`.
 * Not rendered: `modalMode` composites are shown inline (no modal), and block
 * `conditional` is not evaluated outside a process step.
 */
'use client'

import React, { useCallback } from 'react'
import { AlertTriangle } from 'lucide-react'

import type { QWidgetMetaData } from '@/types'
import type { BlockActionCallback, QqqBlockData, QqqCompositeData } from '../widget-types'
import { asList, isPlainObject, payloadProblem } from '../widget-types'
import { cn } from '@/lib/utils/cn'
import { SafeHtml } from '../SafeHtml'
import { WidgetPayloadNotice } from '../WidgetNotice'
import { NestedCompositeContext } from './BlockSlot'
import { blockColor, blockQqqId, blockStyles, styleMap } from './block-utils'
import {
  AudioBlock, BigNumberBlock, ButtonBlock, DividerBlock, IconBlock, ImageBlock, InputFieldBlock,
  NumberIconBadgeBlock, ProgressBarBlock, TableSubRowDetailRowBlock, TextBlock, UpOrDownNumberBlock,
} from './QqqBlocks'
import type { LeafBlockProps } from './QqqBlocks'

/** Tailwind classes for each backend `CompositeWidgetData.Layout` (Material flex semantics). */
const LAYOUT_CLASSES: Record<string, string> = {
  FLEX_COLUMN: 'flex flex-col flex-wrap gap-2',
  FLEX_ROW_WRAPPED: 'flex flex-row flex-wrap gap-2',
  FLEX_ROW: 'flex flex-row gap-2',
  FLEX_ROW_SPACE_BETWEEN: 'flex flex-row justify-between gap-1',
  FLEX_ROW_CENTER: 'flex flex-row flex-wrap justify-center gap-1',
  TABLE_SUB_ROW_DETAILS: 'flex flex-col border-r border-[#D0D0D0] text-sm font-normal',
  BADGES_WRAPPER: 'flex gap-1 rounded-lg border border-gray-500 bg-white px-1 text-sm font-normal text-gray-900',
}

/** Leaf block components by `blockTypeName`. */
const LEAF_BLOCKS: Record<string, React.ComponentType<LeafBlockProps>> = {
  TEXT: TextBlock,
  NUMBER_ICON_BADGE: NumberIconBadgeBlock,
  UP_OR_DOWN_NUMBER: UpOrDownNumberBlock,
  TABLE_SUB_ROW_DETAIL_ROW: TableSubRowDetailRowBlock,
  PROGRESS_BAR: ProgressBarBlock,
  DIVIDER: DividerBlock,
  BIG_NUMBER: BigNumberBlock,
  INPUT_FIELD: InputFieldBlock,
  BUTTON: ButtonBlock,
  AUDIO: AudioBlock,
  IMAGE: ImageBlock,
  ICON: IconBlock,
}

/** Props accepted by {@link QqqComposite}. */
export interface QqqCompositeProps {
  /** Metadata for the owning widget (its name scopes every `data-qqq-id`). */
  widgetMetaData: QWidgetMetaData
  /** The composite payload (the widget data itself, or a nested COMPOSITE block). */
  data: QqqCompositeData
  /** Callback for BUTTON and INPUT_FIELD blocks (e.g. a hosting process step). */
  actionCallback?: BlockActionCallback
}

/** Props accepted by the internal composite/block renderers. */
interface InnerProps {
  widgetName: string
  actionCallback?: BlockActionCallback
}

/**
 * Renders a composite container: optional overlay HTML, then its blocks laid out
 * per `layout`, with `styleOverrides`, `styles.backgroundColor` and `styles.padding`.
 *
 * @param props - The composite and inner render context.
 * @returns The rendered composite, or a payload notice when `blocks` is malformed.
 */
function CompositeContainer({ data, widgetName, actionCallback }: InnerProps & { data: QqqCompositeData }) {
  const blocks = asList<unknown>(data.blocks)
  if (!blocks) {
    return <WidgetPayloadNotice widgetName={widgetName} message={payloadProblem('composite', 'blocks')} />
  }
  const layout = typeof data.layout === 'string' ? data.layout : undefined
  const styles = blockStyles(data)
  const style: React.CSSProperties = { ...styleMap(data.styleOverrides) }
  const background = blockColor(styles.backgroundColor)
  if (background) style.backgroundColor = background
  if (isPlainObject(styles.padding)) {
    const padding = styles.padding
    const px = (side: string) => (typeof padding[side] === 'number' ? `${padding[side]}px` : undefined)
    Object.assign(style, { paddingTop: px('top'), paddingBottom: px('bottom'), paddingLeft: px('left'), paddingRight: px('right') })
  }
  return (
    <>
      {typeof data.overlayHtml === 'string' && data.overlayHtml && (
        <div style={styleMap(data.overlayStyleOverrides)} data-qqq-id={`block-overlay-${widgetName}`}>
          <SafeHtml html={data.overlayHtml} />
        </div>
      )}
      <div
        className={cn(layout ? LAYOUT_CLASSES[layout] : undefined)}
        style={style}
        data-qqq-id={blockQqqId('COMPOSITE', widgetName)}
        data-block-type="COMPOSITE"
        data-block-id={data.blockId}
        data-layout={layout ?? 'NONE'}
      >
        {blocks.map((block, index) => (
          <React.Fragment key={index}>
            {isPlainObject(block)
              ? <QqqBlock block={block as QqqBlockData} widgetName={widgetName} actionCallback={actionCallback} />
              : <WidgetPayloadNotice widgetName={widgetName} message={payloadProblem('composite', `blocks[${index}]`)} />}
          </React.Fragment>
        ))}
      </div>
    </>
  )
}

/**
 * Dispatches one block to its renderer; COMPOSITE recurses, unknown types show a
 * contained `Unsupported block type` warning.
 *
 * @param props - The block and inner render context.
 * @returns The rendered block.
 */
function QqqBlock({ block, widgetName, actionCallback }: InnerProps & { block: QqqBlockData }) {
  const type = typeof block.blockTypeName === 'string' ? block.blockTypeName : ''
  if (type === 'COMPOSITE') {
    return <CompositeContainer data={block as QqqCompositeData} widgetName={widgetName} actionCallback={actionCallback} />
  }
  const Leaf = LEAF_BLOCKS[type]
  if (Leaf) return <Leaf block={block} widgetName={widgetName} actionCallback={actionCallback} />
  return (
    <div
      role="alert"
      className="m-2 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
      data-qqq-id={`block-unsupported-${widgetName}`}
      data-block-type={type || 'UNKNOWN'}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>Unsupported block type: {type || '(none)'}</span>
    </div>
  )
}

/**
 * Renders a canonical QQQ composite payload — every block type (COMPOSITE, TEXT,
 * NUMBER_ICON_BADGE, UP_OR_DOWN_NUMBER, TABLE_SUB_ROW_DETAIL_ROW, PROGRESS_BAR,
 * DIVIDER, BIG_NUMBER, INPUT_FIELD, BUTTON, AUDIO, IMAGE, ICON) in every layout.
 * A malformed payload renders a contained notice and never throws.
 *
 * @param props - See {@link QqqCompositeProps}.
 * @returns The rendered composite.
 */
export function QqqComposite({ widgetMetaData, data, actionCallback }: QqqCompositeProps) {
  const widgetName = widgetMetaData.name
  const renderNested = useCallback(
    (nested: QqqCompositeData) => <CompositeContainer data={nested} widgetName={widgetName} />,
    [widgetName]
  )
  if (!isPlainObject(data)) {
    return <WidgetPayloadNotice widgetName={widgetName} message={payloadProblem('composite', 'data')} />
  }
  // A single leaf block (Material's `block` widget, a table `block` cell) renders as that block.
  const leafType = typeof data.blockTypeName === 'string' && data.blockTypeName !== 'COMPOSITE' && !('blocks' in data) ? data.blockTypeName : null
  return (
    <NestedCompositeContext.Provider value={renderNested}>
      <div data-qqq-id={`composite-${widgetName}`}>
        {leafType
          ? <QqqBlock block={data as QqqBlockData} widgetName={widgetName} actionCallback={actionCallback} />
          : <CompositeContainer data={data} widgetName={widgetName} actionCallback={actionCallback} />}
      </div>
    </NestedCompositeContext.Provider>
  )
}
