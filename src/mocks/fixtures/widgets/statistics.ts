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
 * @file Widget fixture data — statistics widget payloads for the CRM dashboard.
 */

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
