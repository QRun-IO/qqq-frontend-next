/**
 * StatisticsWidget stories — demonstrates KPI tile grid rendering.
 *
 * StatisticsWidget supports both the multi-tile array shape and the legacy
 * single-tile payload, with optional trend indicators and a compact mini variant.
 */
import type { Meta, StoryObj } from '@storybook/react'

import { StatisticsWidget } from './StatisticsWidget'

const meta = {
  title: 'Widgets/StatisticsWidget',
  component: StatisticsWidget,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Renders a responsive grid of KPI stat tiles with optional trend indicators. Supports multi-tile array and legacy single-tile payload shapes.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    widgetName: {
      control: 'text',
      description: 'Widget name used to scope data-qqq-id attributes',
    },
  },
} satisfies Meta<typeof StatisticsWidget>

export default meta
type Story = StoryObj<typeof meta>

// ─── Default (4 tiles) ────────────────────────────────────────────────────────

/**
 * Default story with four KPI tiles in a 4-column grid.
 */
export const Default: Story = {
  args: {
    widgetName: 'dashboard-kpis',
    data: {
      type: 'statistics',
      statistics: [
        { label: 'Total Revenue', value: '$124,500', description: 'All time' },
        { label: 'New Customers', value: '2,840', description: 'This month' },
        { label: 'Active Orders', value: '348', description: 'In progress' },
        { label: 'Avg Order Value', value: '$438', description: 'Last 30 days' },
      ],
    },
  },
}

// ─── SingleTile ───────────────────────────────────────────────────────────────

/**
 * Single tile using the legacy top-level payload shape (title + value + unit).
 */
export const SingleTile: Story = {
  args: {
    widgetName: 'single-kpi',
    data: {
      type: 'statistics',
      title: 'Total Users',
      value: 15_234,
      unit: 'users',
    },
  },
}

// ─── MiniVariant ──────────────────────────────────────────────────────────────

/**
 * Mini variant — compact single-line layout for dense dashboards.
 * Trend indicators and descriptions are omitted in this mode.
 */
export const MiniVariant: Story = {
  args: {
    widgetName: 'mini-stats',
    data: {
      type: 'statistics',
      mini: true,
      statistics: [
        { label: 'CPU Usage', value: '42%' },
        { label: 'Memory', value: '3.2 GB' },
        { label: 'Disk', value: '78%' },
        { label: 'Requests/s', value: '1,204' },
      ],
    },
  },
}

// ─── WithTrendIndicators ──────────────────────────────────────────────────────

/**
 * Tiles with trend badges — up, down, and flat directions.
 */
export const WithTrendIndicators: Story = {
  args: {
    widgetName: 'trend-kpis',
    data: {
      type: 'statistics',
      statistics: [
        {
          label: 'Monthly Revenue',
          value: '$84,000',
          trend: { direction: 'up', value: 12.5, label: 'vs last month' },
        },
        {
          label: 'Churn Rate',
          value: '3.2%',
          trend: { direction: 'down', value: 0.8, label: 'vs last month' },
        },
        {
          label: 'Avg Response Time',
          value: '142 ms',
          trend: { direction: 'flat', value: 0.1, label: 'stable' },
        },
      ],
    },
  },
}

// ─── WithCurrencyFormat ───────────────────────────────────────────────────────

/**
 * Tiles with unit suffixes (currency and percentage examples).
 */
export const WithCurrencyFormat: Story = {
  args: {
    widgetName: 'currency-stats',
    data: {
      type: 'statistics',
      statistics: [
        { label: 'Gross Revenue', value: '1,240,500', unit: 'USD' },
        { label: 'Net Margin', value: '24.8', unit: '%' },
        { label: 'CAC', value: '142', unit: '$/customer' },
      ],
    },
  },
}

// ─── LoadingState (empty/minimal) ────────────────────────────────────────────

/**
 * Minimal payload — single tile with an em-dash placeholder value.
 * Simulates a loading or empty-data state from the backend.
 */
export const LoadingState: Story = {
  args: {
    widgetName: 'loading-stat',
    data: {
      type: 'statistics',
      title: 'Fetching...',
      value: '—',
    },
  },
}

// ─── TwoTiles ─────────────────────────────────────────────────────────────────

/**
 * Two-tile grid — renders a 2-column layout on sm+ screens.
 */
export const TwoTiles: Story = {
  args: {
    widgetName: 'two-tiles',
    data: {
      type: 'statistics',
      statistics: [
        { label: 'Imports Today', value: '1,024', description: 'Across all tables' },
        { label: 'Errors', value: '3', description: 'Requires attention' },
      ],
    },
  },
}
