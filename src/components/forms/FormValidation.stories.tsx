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
 * Form validation stories — the quiet states of a record form: clean, near a length limit
 * (the counter appears only there), and with errors after a failed save.
 */
import React, { useEffect } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import type { QFieldMetaData } from '@/types'
import { zodSchemaFromFields } from '@/lib/utils/zod-from-metadata'
import { DynamicForm } from './DynamicForm'

function makeField(overrides: Partial<QFieldMetaData> & Pick<QFieldMetaData, 'name' | 'label' | 'type'>): QFieldMetaData {
  return { isEditable: true, isRequired: false, isHeavy: false, isHidden: false, adornments: [], ...overrides }
}

const FIELDS: QFieldMetaData[] = [
  makeField({ name: 'name', label: 'Name', type: 'STRING', isRequired: true, maxLength: 20, behaviors: ['ERROR'] }),
  makeField({ name: 'nickname', label: 'Nickname', type: 'STRING', maxLength: 12, behaviors: ['TRUNCATE'] }),
  makeField({ name: 'quantity', label: 'Quantity', type: 'INTEGER', minValue: 1, maxValue: 100 }),
  makeField({ name: 'price', label: 'Price', type: 'DECIMAL', displayFormat: '$%.2f' }),
  makeField({ name: 'due', label: 'Due Date', type: 'DATE', isRequired: true }),
]

function Form({ values, validate }: { values: Record<string, unknown>; validate?: boolean }) {
  const { register, control, formState: { errors }, trigger } = useForm<Record<string, unknown>>({
    resolver: zodResolver(zodSchemaFromFields(FIELDS)),
    defaultValues: values,
    mode: 'onBlur',
  })
  useEffect(() => { if (validate) void trigger() }, [validate, trigger])
  return (
    <div className="max-w-xl p-4">
      <DynamicForm fields={FIELDS} register={register} control={control} errors={errors} enforceMaxLength={false} />
    </div>
  )
}

const meta = { title: 'Forms/Validation', component: Form, parameters: { layout: 'fullscreen' } } satisfies Meta<typeof Form>
export default meta
type Story = StoryObj<typeof meta>

/** Nothing to say yet: no counters, no errors, no hints. */
export const Clean: Story = { args: { values: { name: '', nickname: '', quantity: '', price: '', due: '' } } }

/** Within the last 20% of a limit the counter appears; a trimming field notes the extra characters. */
export const NearLimit: Story = { args: { values: { name: 'Eighteen characters', nickname: 'A very long nickname', quantity: '5', price: '', due: '2026-10-12' } } }

/** After a failed save, each field says what is wrong in plain words. */
export const WithErrors: Story = { args: { values: { name: '', nickname: '', quantity: '500', price: '', due: '' }, validate: true } }
