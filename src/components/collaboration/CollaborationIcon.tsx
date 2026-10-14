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

/** @file Navigation icons shared by favorites menu and command palette. */

import {
  Bookmark,
  FileText,
  LayoutGrid,
  Table2,
  Workflow,
  ChartNoAxesCombined,
  type LucideIcon,
} from 'lucide-react'
import type { CollaborationTargetType } from '@/types/collaboration'

const ICONS: Record<CollaborationTargetType, LucideIcon> = {
  TABLE: Table2,
  APP: LayoutGrid,
  RECORD: FileText,
  PROCESS: Workflow,
  REPORT: ChartNoAxesCombined,
  SAVED_VIEW: Bookmark,
}

/**
 * Renders the icon corresponding to a navigation target's type.
 * @param props - Target type.
 * @returns A decorative icon.
 */
export function CollaborationIcon({ type }: { type: CollaborationTargetType }) {
  const Icon = ICONS[type]
  return <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
}
