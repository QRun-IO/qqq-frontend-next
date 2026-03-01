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
 * @file cn — utility for merging Tailwind class names with clsx and tailwind-merge.
 */

// cn — utility for merging Tailwind class names

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges Tailwind CSS class names, resolving conflicts using `tailwind-merge`.
 *
 * Accepts any mix of strings, arrays, and conditional objects (via `clsx`) then
 * deduplicates conflicting Tailwind utilities so the last one wins.
 *
 * @param inputs - Class name values to merge (strings, arrays, or objects).
 * @returns A single merged class name string with Tailwind conflicts resolved.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
