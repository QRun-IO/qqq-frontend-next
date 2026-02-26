// Widget fixture data — statistics widgets

import type { StatisticsWidgetData } from '@/types'

export const totalPeopleStats: StatisticsWidgetData = {
  type: 'statistics',
  title: 'Total People',
  value: 25,
  unit: 'contacts',
  trend: {
    direction: 'up',
    value: 12,
    label: 'vs last month',
  },
}

export const activeCompaniesStats: StatisticsWidgetData = {
  type: 'statistics',
  title: 'Active Companies',
  value: 9,
  unit: 'accounts',
  trend: {
    direction: 'up',
    value: 2,
    label: 'vs last month',
  },
}

export const openOrdersStats: StatisticsWidgetData = {
  type: 'statistics',
  title: 'Open Orders',
  value: 7,
  unit: 'orders',
  trend: {
    direction: 'down',
    value: 3,
    label: 'vs last month',
  },
}

export const monthlyRevenueStats: StatisticsWidgetData = {
  type: 'statistics',
  title: 'Monthly Revenue',
  value: '$342,750',
  unit: 'USD',
  trend: {
    direction: 'up',
    value: 18,
    label: 'vs last month',
  },
}
