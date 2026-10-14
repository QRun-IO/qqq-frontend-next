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

/** @file Entry classes and group headings shared by the command palette and its lazy groups. */

import React from 'react'
import { cn } from '@/lib/utils/cn'

/** Shared classes of a palette entry (44 px tall on touch screens). */
export const ITEM_CLASS = cn(
  'flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm pointer-coarse:min-h-11',
  'text-foreground',
  'hover:bg-accent',
  'aria-selected:bg-primary/10 aria-selected:text-primary',
  'outline-none transition-colors'
)

/**
 * A palette group heading.
 *
 * @param props - Component properties.
 * @param props.children - Heading text.
 * @returns The heading element.
 */
export function GroupHeading({ children }: { children: React.ReactNode }) {
  return <span className="px-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">{children}</span>
}
