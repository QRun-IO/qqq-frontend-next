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

import React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { QFieldMetaData } from '@/types'
import { MaskedValue } from '@/components/secured-data/MaskedValue'
import { PasswordField } from '@/components/forms/field-types/PasswordField'
import { TextField } from '@/components/forms/field-types/TextField'
import { DataCell } from '@/components/query/DataCell'
import { isSecureField, secureValueAttributes } from './secure-attributes'

const field = (overrides: Partial<QFieldMetaData>) => ({ name: 'f', label: 'F', type: 'STRING', ...overrides }) as QFieldMetaData

describe('secure value attributes', () => {
  it('classifies password, reveal and secured-data restricted fields as secure', () => {
    expect(isSecureField(field({ type: 'PASSWORD' }))).toBe(true)
    expect(isSecureField(field({ accessTier: 'MASKED' }))).toBe(true)
    expect(isSecureField(field({ accessTier: 'REVEALABLE' }))).toBe(true)
    expect(isSecureField(field({ adornments: [{ type: 'REVEAL' }] } as Partial<QFieldMetaData>))).toBe(true)
    expect(isSecureField(field({ accessTier: 'FULL' }))).toBe(false)
    expect(isSecureField(undefined)).toBe(false)
    expect(secureValueAttributes(field({}))).toEqual({})
    expect(secureValueAttributes(field({ type: 'PASSWORD' }))).toEqual({ 'data-jam-blur': '', 'data-qqq-secure': '' })
  })

  it('marks masked values, password inputs, secure text inputs and grid secrets', () => {
    render(
      <>
        <MaskedValue value="***-**-6789" tier="MASKED" />
        <PasswordField id="pw" label="Password" registration={{ name: 'pw', onChange: async () => {}, onBlur: async () => {}, ref: () => {} }} />
        <TextField id="key" label="Key" secure registration={{ name: 'key', onChange: async () => {}, onBlur: async () => {}, ref: () => {} }} />
        <TextField id="plain" label="Plain" registration={{ name: 'plain', onChange: async () => {}, onBlur: async () => {}, ref: () => {} }} />
        <DataCell field={field({ name: 'secret', type: 'PASSWORD' })} value="x" displayValue={undefined} record={{ tableName: 't', values: { secret: 'x' } }} />
      </>
    )
    expect(screen.getByLabelText('Masked value: ***-**-6789')).toHaveAttribute('data-jam-blur')
    expect(screen.getByLabelText('Password')).toHaveAttribute('data-qqq-secure')
    expect(screen.getByLabelText('Key')).toHaveAttribute('data-jam-blur')
    expect(screen.getByLabelText('Plain')).not.toHaveAttribute('data-jam-blur')
    expect(document.querySelector('[data-qqq-id="grid-cell-secret"]')).toHaveAttribute('data-qqq-secure')
  })
})
