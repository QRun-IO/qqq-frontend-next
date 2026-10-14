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

/** @file Form help stays adjacent to labels without activating the field. */
import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { expect, it, vi } from 'vitest'

import type { QFieldMetaData } from '@/types'

import { DynamicFormField } from './DynamicFormField'
import { FieldLabel } from '@/components/records/FieldLabel'

vi.mock('@/lib/context/q-context', () => ({ useHelpHelpActive: () => false }))

/** Hosts a real field with React Hook Form registration and state. */
function Harness({ metadata }: { metadata: Partial<QFieldMetaData> }) {
  const { register, control, formState: { errors } } = useForm<Record<string, unknown>>()
  const field = {
    name: 'topic', label: 'Topic Name', type: 'STRING', isEditable: true,
    helpContents: [{ content: 'Topic instructions', roles: ['ALL_SCREENS'] }],
    ...metadata,
  } as QFieldMetaData
  return <DynamicFormField field={field} register={register} control={control} errors={errors} showReadOnly />
}

const cases: [string, Partial<QFieldMetaData>][] = [
  ...(['STRING', 'TEXT', 'HTML', 'INTEGER', 'LONG', 'DECIMAL', 'BOOLEAN', 'DATE', 'DATE_TIME', 'TIME', 'PASSWORD', 'BLOB'] as const)
    .map((type): [string, Partial<QFieldMetaData>] => [type, { type }]),
  ['possible values', { inlinePossibleValueSource: { enumValues: [{ id: 'one', label: 'One' }] } }],
  ['file adornment', { adornments: [{ type: 'FILE_UPLOAD' }] }],
  ['code editor', { adornments: [{ type: 'CODE_EDITOR', values: { languageMode: 'text' } }] }],
  ['read only', { isEditable: false }],
]

it.each(cases)('places %s help immediately beside its one label', (_, metadata) => {
  const { container } = render(<Harness metadata={metadata} />)
  const button = screen.getByRole('button', { name: 'Help for Topic Name' })
  const labelText = screen.getByText('Topic Name')
  const label = labelText.closest('label') ?? labelText
  const row = label.parentElement!
  expect(row).toHaveClass('items-center')
  expect(row).toContainElement(button)
  expect(button.closest('label')).toBeNull()
  expect(label.nextElementSibling).toContainElement(button)
  expect(container.querySelectorAll('[data-qqq-id="field-help-topic"]')).toHaveLength(1)
  expect(container.querySelector('[aria-describedby="field-help-content-topic"]')).toBeInTheDocument()
  expect(document.getElementById('field-help-content-topic')).toHaveTextContent('Topic instructions')
  const toggle = screen.queryByRole('checkbox')
  const checked = toggle?.getAttribute('aria-checked')
  fireEvent.click(button)
  expect(button).toHaveFocus()
  if (toggle) expect(toggle).toHaveAttribute('aria-checked', checked)
})

it('keeps view help beside the label inside caller layout classes', () => {
  render(<FieldLabel className="flex justify-between" field={{ name: 'topic', label: 'Topic Name', type: 'STRING', helpContents: [{ content: 'Help', roles: ['ALL_SCREENS'] }] } as QFieldMetaData} />)
  const label = screen.getByText('Topic Name')
  expect(label.parentElement).toHaveClass('inline-flex', 'items-center')
  expect(label.nextElementSibling).toContainElement(screen.getByRole('button', { name: 'Help for Topic Name' }))
})
