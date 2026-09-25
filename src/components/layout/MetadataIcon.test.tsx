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

// Tests for MetadataIcon and the Material-to-Lucide icon map (#538)

import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'

import { MetadataIcon, SectionIcon } from './MetadataIcon'
import { materialIconComponent, normalizeMaterialIconName } from '@/lib/utils/material-icons'

function svgOf(ui: React.ReactElement) {
  return render(ui).container.firstElementChild as Element
}

describe('MetadataIcon', () => {
  it.each([
    ['person', 'lucide-user'],
    ['emoji_people', 'lucide-person-standing'],
    ['pets', 'lucide-paw-print'],
    ['local_shipping', 'lucide-truck'],
    ['science', 'lucide-flask-conical'],
    ['stars', 'lucide-star'],
    ['widgets', 'lucide-layout-grid'],
    ['badge', 'lucide-id-card'],
    ['waving_hand', 'lucide-hand'],
    ['content_copy', 'lucide-copy'],
  ])('renders the declared Material icon %s as its own glyph', (name, lucideClass) => {
    const svg = svgOf(<MetadataIcon icon={{ name }} />)
    expect(svg).toHaveClass(lucideClass)
    expect(svg).toHaveAttribute('data-qqq-icon', name)
    expect(svg).not.toHaveAttribute('data-qqq-icon-fallback')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('applies the declared color', () => {
    expect((svgOf(<MetadataIcon icon={{ name: 'folder', color: '#b91c1c' }} />) as SVGElement).style.color).toBe('rgb(185, 28, 28)')
  })

  it('renders an image for an icon path', () => {
    const img = svgOf(<MetadataIcon icon={{ path: '/kr-icon.png' }} />)
    expect(img.tagName).toBe('IMG')
    expect(img).toHaveAttribute('src', '/kr-icon.png')
    expect(img).toHaveAttribute('alt', '')
  })

  it('accepts the legacy iconName', () => {
    expect(svgOf(<MetadataIcon iconName="pets" />)).toHaveClass('lucide-paw-print')
  })

  it('falls back to the kind glyph for unknown or missing names', () => {
    const unknown = svgOf(<MetadataIcon icon={{ name: 'no_such_icon' }} kind="table" />)
    expect(unknown).toHaveClass('lucide-table-2')
    expect(unknown).toHaveAttribute('data-qqq-icon', 'no_such_icon')
    expect(unknown).toHaveAttribute('data-qqq-icon-fallback', 'true')
    expect(svgOf(<MetadataIcon kind="process" />)).toHaveAttribute('data-qqq-icon', 'none')
  })
})

describe('SectionIcon', () => {
  it('renders a declared section icon (structured or legacy) and nothing otherwise', () => {
    expect(svgOf(<SectionIcon section={{ icon: { name: 'badge' } }} />)).toHaveClass('lucide-id-card')
    expect(svgOf(<SectionIcon section={{ iconName: 'dataset' }} />)).toHaveClass('lucide-database')
    expect(render(<SectionIcon section={{}} />).container).toBeEmptyDOMElement()
  })
})

describe('material-icons', () => {
  it('normalizes case and style-variant suffixes', () => {
    expect(normalizeMaterialIconName(' People_Outlined ')).toBe('people')
    expect(normalizeMaterialIconName('person_outline')).toBe('person_outline')
    expect(materialIconComponent('pets_rounded')).toBe(materialIconComponent('pets'))
    expect(materialIconComponent(undefined)).toBeUndefined()
    expect(materialIconComponent('definitely_not_an_icon')).toBeUndefined()
  })
})
