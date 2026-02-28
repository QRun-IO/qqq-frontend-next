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
 * FieldValue stories — demonstrates all field type and adornment rendering.
 *
 * FieldValue is a read-only renderer that takes a QFieldMetaData descriptor
 * and a QRecord, then produces the appropriate display element for the field
 * type and adornments.
 */
import type { Meta, StoryObj } from '@storybook/react'

import type { QFieldMetaData, QRecord } from '@/types'
import { FieldValue } from './FieldValue'

// ─── Shared helpers ────────────────────────────────────────────────────────────

/** Build a minimal QRecord for story use. */
function makeRecord(fieldName: string, value: unknown, displayValue?: string): QRecord {
  return {
    tableName: 'demo',
    recordLabel: String(value),
    values: { [fieldName]: value },
    displayValues: displayValue ? { [fieldName]: displayValue } : {},
  }
}

/** Build a minimal QFieldMetaData with sensible defaults. */
function makeField(
  overrides: Partial<QFieldMetaData> & Pick<QFieldMetaData, 'name' | 'label' | 'type'>
): QFieldMetaData {
  return {
    isEditable: true,
    isRequired: false,
    isHeavy: false,
    isHidden: false,
    adornments: [],
    ...overrides,
  }
}

// ─── Meta ──────────────────────────────────────────────────────────────────────

const meta = {
  title: 'Records/FieldValue',
  component: FieldValue,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Read-only renderer for a single QQQ field value. Handles all QFieldType values and adornment types (LINK, CHIP, REVEAL, SIZE, RENDER_HTML, TOOLTIP, ERROR).',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof FieldValue>

export default meta
type Story = StoryObj<typeof meta>

// ─── StringField ───────────────────────────────────────────────────────────────

/** Renders a plain STRING field value. */
export const StringField: Story = {
  args: {
    field: makeField({ name: 'firstName', label: 'First Name', type: 'STRING' }),
    record: makeRecord('firstName', 'Alice Johnson'),
  },
}

// ─── IntegerField ─────────────────────────────────────────────────────────────

/** Renders an INTEGER field — displayed as a plain number. */
export const IntegerField: Story = {
  args: {
    field: makeField({ name: 'age', label: 'Age', type: 'INTEGER' }),
    record: makeRecord('age', 34),
  },
}

// ─── BooleanTrue ──────────────────────────────────────────────────────────────

/** Renders a BOOLEAN field with a truthy value (shows a green "Yes" badge). */
export const BooleanTrue: Story = {
  args: {
    field: makeField({ name: 'isActive', label: 'Active', type: 'BOOLEAN' }),
    record: makeRecord('isActive', true),
  },
}

// ─── BooleanFalse ─────────────────────────────────────────────────────────────

/** Renders a BOOLEAN field with a falsy value (shows a gray "No" badge). */
export const BooleanFalse: Story = {
  args: {
    field: makeField({ name: 'isActive', label: 'Active', type: 'BOOLEAN' }),
    record: makeRecord('isActive', false),
  },
}

// ─── DateField ────────────────────────────────────────────────────────────────

/** Renders a DATE field using the backend-formatted displayValue. */
export const DateField: Story = {
  args: {
    field: makeField({ name: 'createdAt', label: 'Created At', type: 'DATE' }),
    record: makeRecord('createdAt', '2024-01-15', 'Jan 15, 2024'),
  },
}

// ─── NullValue ────────────────────────────────────────────────────────────────

/** Renders an em-dash when the field value is null or empty. */
export const NullValue: Story = {
  args: {
    field: makeField({ name: 'email', label: 'Email', type: 'STRING' }),
    record: makeRecord('email', null),
  },
}

// ─── ChipAdornment ────────────────────────────────────────────────────────────

/** Renders a CHIP adornment — colored badge based on value. */
export const ChipAdornment: Story = {
  args: {
    field: makeField({
      name: 'status',
      label: 'Status',
      type: 'STRING',
      adornments: [
        {
          type: 'CHIP',
          values: {
            colorMap: {
              Active: 'green',
              Inactive: 'gray',
              Pending: 'yellow',
              Error: 'red',
            },
          },
        },
      ],
    }),
    record: makeRecord('status', 'Active'),
  },
}

// ─── ChipAdornmentRed ─────────────────────────────────────────────────────────

/** CHIP adornment with a red (error) color. */
export const ChipAdornmentRed: Story = {
  args: {
    field: makeField({
      name: 'status',
      label: 'Status',
      type: 'STRING',
      adornments: [
        {
          type: 'CHIP',
          values: { colorMap: { Error: 'red' } },
        },
      ],
    }),
    record: makeRecord('status', 'Error'),
  },
}

// ─── LinkAdornment ────────────────────────────────────────────────────────────

/** LINK adornment — renders the value as a clickable external link. */
export const LinkAdornment: Story = {
  args: {
    field: makeField({
      name: 'website',
      label: 'Website',
      type: 'STRING',
      adornments: [{ type: 'LINK', values: { linkURL: 'https://example.com' } }],
    }),
    record: makeRecord('website', 'example.com'),
  },
}

// ─── SizeAdornment ────────────────────────────────────────────────────────────

/** SIZE adornment — formats a byte value as a human-readable file size. */
export const SizeAdornment: Story = {
  args: {
    field: makeField({
      name: 'fileSize',
      label: 'File Size',
      type: 'INTEGER',
      adornments: [{ type: 'SIZE' }],
    }),
    record: makeRecord('fileSize', 1572864),
  },
}

// ─── AutoLinkUrl ──────────────────────────────────────────────────────────────

/** STRING field containing an http URL — auto-linked without a LINK adornment. */
export const AutoLinkUrl: Story = {
  args: {
    field: makeField({ name: 'homepage', label: 'Homepage', type: 'STRING' }),
    record: makeRecord('homepage', 'https://www.qqq.com'),
  },
}

// ─── TextField ────────────────────────────────────────────────────────────────

/** TEXT field — preserves whitespace with pre-wrap. */
export const TextField: Story = {
  args: {
    field: makeField({ name: 'notes', label: 'Notes', type: 'TEXT' }),
    record: makeRecord('notes', 'First line.\nSecond line.\nThird line.'),
  },
}
