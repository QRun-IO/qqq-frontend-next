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
 * Button stories — visual catalog of the Tailwind button variants used
 * throughout the QQQ frontend.
 *
 * The project does not use a pre-built Button component; instead, native
 * <button> elements are styled inline with Tailwind utility classes.  These
 * stories serve as a living reference for the standard button styles.
 */
import type { Meta, StoryObj } from '@storybook/react'
import React from 'react'
import { Loader2 } from 'lucide-react'

// ─── ButtonDemo helper ────────────────────────────────────────────────────────

/** Props for the ButtonDemo helper component used in stories. */
interface ButtonDemoProps {
  /** Visible button text. */
  children: React.ReactNode
  /** Tailwind class string applied to the button element. */
  className: string
  /** When true, renders a spinner icon before the text. */
  loading?: boolean
  /** When true, the button is disabled. */
  disabled?: boolean
  /** Accessible label overrides button text when loading. */
  'aria-label'?: string
}

/** Thin wrapper that renders a standard HTML button with the given Tailwind classes. */
function ButtonDemo({ children, className, loading = false, disabled = false, ...rest }: ButtonDemoProps) {
  return (
    <button
      type="button"
      className={className}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}

// ─── Meta ──────────────────────────────────────────────────────────────────────

const meta = {
  title: 'UI/Button',
  component: ButtonDemo,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Native HTML buttons styled with Tailwind CSS utility classes. The QQQ frontend uses inline button classes rather than a pre-built Button component.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    children: { control: 'text', description: 'Button label text' },
    loading: { control: 'boolean', description: 'Show loading spinner' },
    disabled: { control: 'boolean', description: 'Disabled state' },
  },
} satisfies Meta<typeof ButtonDemo>

export default meta
type Story = StoryObj<typeof meta>

// ─── Default (primary) ────────────────────────────────────────────────────────

/** Primary action button — used for Save, Submit, and other primary CTAs. */
export const Default: Story = {
  args: {
    children: 'Save',
    className:
      'inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50',
  },
}

// ─── Secondary ────────────────────────────────────────────────────────────────

/** Secondary button — used for Cancel, Back, and secondary actions. */
export const Secondary: Story = {
  args: {
    children: 'Cancel',
    className:
      'inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50',
  },
}

// ─── Destructive ──────────────────────────────────────────────────────────────

/** Destructive button — used for Delete and other irreversible actions. */
export const Destructive: Story = {
  args: {
    children: 'Delete',
    className:
      'inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground shadow-sm hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50',
  },
}

// ─── Ghost ────────────────────────────────────────────────────────────────────

/** Ghost button — minimal visual footprint, used for icon actions and inline links. */
export const Ghost: Story = {
  args: {
    children: 'View Details',
    className:
      'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  },
}

// ─── Outline ──────────────────────────────────────────────────────────────────

/** Outline button — bordered variant without a filled background. */
export const Outline: Story = {
  args: {
    children: 'Export',
    className:
      'inline-flex items-center gap-2 rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50',
  },
}

// ─── Disabled ─────────────────────────────────────────────────────────────────

/** Disabled primary button — opacity reduced, pointer-events removed. */
export const Disabled: Story = {
  args: {
    children: 'Save',
    disabled: true,
    className:
      'inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  },
}

// ─── Loading ──────────────────────────────────────────────────────────────────

/** Loading state — renders a spinning Loader2 icon before the label. */
export const Loading: Story = {
  args: {
    children: 'Saving...',
    loading: true,
    'aria-label': 'Saving, please wait',
    className:
      'inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70',
  },
}

// ─── SizeSmall ────────────────────────────────────────────────────────────────

/** Small variant — compact button for toolbar and inline use. */
export const SizeSmall: Story = {
  args: {
    children: 'Add Filter',
    className:
      'inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
  },
}

// ─── SizeLarge ────────────────────────────────────────────────────────────────

/** Large variant — prominent CTA for empty states and landing sections. */
export const SizeLarge: Story = {
  args: {
    children: 'Get Started',
    className:
      'inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  },
}
