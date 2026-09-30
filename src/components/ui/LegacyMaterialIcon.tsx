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
 * @file A locally served legacy glyph inside the same scalable box used by Lucide icons.
 */
import React, { type SVGProps } from 'react'
import type { LucideIcon } from 'lucide-react'
import { legacyMaterialIconCodepoint } from '@/lib/utils/legacy-material-icons'

/** Props for a legacy icon whose name has already been resolved. */
interface LegacyMaterialIconProps extends SVGProps<SVGSVGElement> {
  /** Name from backend metadata, resolved only when this module is needed. */
  name: string
  /** Existing fallback for genuinely unknown names. */
  fallback: LucideIcon
  /** Preserved for unknown metadata names and removed for valid glyphs. */
  'data-qqq-icon-fallback'?: string
}

/**
 * Preserves SVG sizing, color and CSS hooks while drawing an unmapped legacy icon.
 * The bundled font has 512 units per em, ascent 512 and descent 0, so y=24 aligns
 * its full em with the 24px view box. Numeric glyphs avoid visible ligature names.
 * @param props - Glyph and standard SVG properties.
 * @returns A decorative, scalable icon.
 */
export function LegacyMaterialIcon({ name, fallback, ...props }: LegacyMaterialIconProps) {
  const codepoint = legacyMaterialIconCodepoint(name)
  if (!codepoint) return React.createElement(fallback, props)
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props} data-qqq-icon-fallback={undefined}>
      <text x="0" y="24" className="qqq-legacy-material-glyph" fill="currentColor" stroke="none">{codepoint}</text>
    </svg>
  )
}
