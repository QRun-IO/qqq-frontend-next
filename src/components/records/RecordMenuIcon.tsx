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
 * @file RecordMenuIcon — the icon of a record view menu item: the item's metadata icon, or the
 * Material dashboard's default for its kind.
 */

import React from 'react'
import { Code, Copy, Download, History, Pencil, Play, Plus, Trash2, type LucideIcon } from 'lucide-react'

import type { RecordMenuAction, RecordMenuEntry } from '@/lib/utils/record-menu-utils'
import { MetadataIcon } from '@/components/layout/MetadataIcon'

/** Default glyph per action (Material: add, copy, edit, delete, code, checklist, arrow_forward, file_download). */
const DEFAULT_ICONS: Record<RecordMenuAction['type'], LucideIcon> = {
  new: Plus,
  copy: Copy,
  edit: Pencil,
  delete: Trash2,
  developerMode: Code,
  audit: History,
  runProcess: Play,
  downloadFile: Download,
}

/**
 * Renders a menu item's icon (decorative; the label names the item).
 *
 * @param props - Component properties.
 * @param props.entry - A resolved menu item.
 * @returns The icon.
 */
export function RecordMenuIcon({ entry }: { entry: Extract<RecordMenuEntry, { kind: 'item' }> }) {
  if (entry.iconName) return <MetadataIcon iconName={entry.iconName} kind="process" />
  return React.createElement(DEFAULT_ICONS[entry.action.type], { className: 'h-4 w-4 flex-shrink-0', 'aria-hidden': 'true' })
}
