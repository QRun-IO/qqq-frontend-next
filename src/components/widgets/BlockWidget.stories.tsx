/**
 * BlockWidget stories — demonstrates all block layout and content variations.
 *
 * BlockWidget renders a heterogeneous collection of typed block elements
 * (text, big_number, progress, button, html, divider, etc.) in vertical,
 * horizontal, or grid layouts.
 */
import type { Meta, StoryObj } from '@storybook/react'

import { BlockWidget } from './BlockWidget'

const meta = {
  title: 'Widgets/BlockWidget',
  component: BlockWidget,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Renders a collection of typed block elements from the QQQ backend. Supports vertical, horizontal, and grid layouts.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    widgetName: {
      control: 'text',
      description: 'Unique widget name used to scope data-qqq-id attributes',
    },
  },
} satisfies Meta<typeof BlockWidget>

export default meta
type Story = StoryObj<typeof meta>

// ─── HtmlContent ──────────────────────────────────────────────────────────────

/**
 * Legacy HTML content block — uses the `html` field on the payload.
 * Rendered with DOMPurify sanitization.
 */
export const HtmlContent: Story = {
  args: {
    widgetName: 'html-demo',
    data: {
      type: 'block',
      html: '<h2>Hello, World!</h2><p>This is <strong>sanitized</strong> HTML rendered by BlockWidget.</p>',
    },
  },
}

// ─── PlainText ────────────────────────────────────────────────────────────────

/**
 * Simple vertical layout with multiple text blocks.
 */
export const PlainText: Story = {
  args: {
    widgetName: 'plain-text-demo',
    data: {
      type: 'block',
      layout: 'vertical',
      blocks: [
        { type: 'text', text: 'First line of content rendered as a text block.' },
        { type: 'text', text: 'Second line with different styling.', styles: { fontWeight: 'bold' } },
        { type: 'divider' },
        { type: 'text', text: 'Content after a divider separator.' },
      ],
    },
  },
}

// ─── BigNumber ────────────────────────────────────────────────────────────────

/**
 * Big number blocks for KPI-style display.
 */
export const BigNumber: Story = {
  args: {
    widgetName: 'big-number-demo',
    data: {
      type: 'block',
      layout: 'horizontal',
      blocks: [
        { type: 'big_number', value: '1,234', label: 'Total Orders' },
        { type: 'big_number', value: '$98.7K', label: 'Revenue' },
        { type: 'big_number', value: '99.8%', label: 'Uptime' },
      ],
    },
  },
}

// ─── ProgressBlocks ───────────────────────────────────────────────────────────

/**
 * Progress bar blocks showing numeric values against a maximum.
 */
export const ProgressBlocks: Story = {
  args: {
    widgetName: 'progress-demo',
    data: {
      type: 'block',
      layout: 'vertical',
      blocks: [
        { type: 'progress', value: 75, max: 100, label: 'Completion' },
        { type: 'progress', value: 40, max: 200, label: 'Records Processed' },
        { type: 'progress', value: 100, max: 100, label: 'Fully Complete' },
      ],
    },
  },
}

// ─── LoadingState (empty blocks) ─────────────────────────────────────────────

/**
 * Empty state — when the payload has no blocks and no html, BlockWidget
 * renders a "No block content available" message.
 */
export const LoadingState: Story = {
  args: {
    widgetName: 'empty-demo',
    data: {
      type: 'block',
      blocks: [],
    },
  },
}

// ─── MixedLayout ─────────────────────────────────────────────────────────────

/**
 * Mixed block types in a vertical layout — text, number, progress, button, and HTML.
 */
export const MixedLayout: Story = {
  args: {
    widgetName: 'mixed-demo',
    data: {
      type: 'block',
      layout: 'vertical',
      blocks: [
        { type: 'text', text: 'Process summary report' },
        { type: 'big_number', value: '42', label: 'Items Imported' },
        { type: 'progress', value: 42, max: 50, label: 'Progress' },
        { type: 'button', label: 'View Details', actionCode: 'VIEW_DETAILS' },
        { type: 'divider' },
        { type: 'html', html: '<p>Generated at <time>2024-01-15 10:30 AM</time></p>' },
      ],
    },
  },
}

// ─── GridLayout ───────────────────────────────────────────────────────────────

/**
 * Grid layout — blocks arranged in a 2-column grid.
 */
export const GridLayout: Story = {
  args: {
    widgetName: 'grid-demo',
    data: {
      type: 'block',
      layout: 'grid',
      blocks: [
        { type: 'big_number', value: '100', label: 'Inserted' },
        { type: 'big_number', value: '5', label: 'Updated' },
        { type: 'big_number', value: '2', label: 'Errors' },
        { type: 'big_number', value: '0', label: 'Skipped' },
      ],
    },
  },
}
