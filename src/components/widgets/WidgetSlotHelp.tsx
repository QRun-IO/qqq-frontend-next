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
 * @file WidgetSlotHelp — help content declared for one of a widget's help slots
 * (Material `WidgetUtils.getHelp` / `HelpContent`), rendered in its format.
 */
'use client'

import React from 'react'

import type { QHelpContent, QWidgetMetaData } from '@/types'
import { WIDGET_HELP_ROLES } from '@/lib/utils/help-utils'
import { useHelpHelpActive } from '@/lib/context/q-context'
import { HelpContent } from '@/components/records/HelpContent'
import { widgetHelpKey, widgetSlotHelp } from './widget-utils'

/** Props accepted by {@link WidgetSlotHelp}. */
interface WidgetSlotHelpProps {
  /** The widget whose help content is read. */
  widgetMetaData: QWidgetMetaData
  /** Help slot name (for example `sectionSubhead` or `top`). */
  slot: string
  /** The screen's help roles, most specific first. */
  roles?: readonly string[]
  /** Extra classes (the default is Material's muted help paragraph). */
  className?: string
}

/**
 * Renders a widget slot's help as a muted block, or nothing when the slot has none
 * for the screen's roles. The slot's help key (`widget:{name};slot:{slot}`) is carried on
 * `data-help-key` for help-authoring mode.
 *
 * @param props - See {@link WidgetSlotHelpProps}.
 * @returns The help block, or null.
 */
export function WidgetSlotHelp({ widgetMetaData, slot, roles = WIDGET_HELP_ROLES, className }: WidgetSlotHelpProps) {
  const helpHelpActive = useHelpHelpActive()
  const entry = widgetSlotHelp(widgetMetaData, slot, roles, helpHelpActive)
  if (!entry) return null
  return (
    <div
      className={className ?? 'pb-2 text-sm text-muted-foreground'}
      data-help-key={widgetHelpKey(widgetMetaData.name, slot)}
      data-qqq-id={`widget-help-${slot}-${widgetMetaData.name}`}
    >
      <HelpContent helpContent={entry as QHelpContent} />
    </div>
  )
}
