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
 * @file Widget fixture data — chart and record grid widget payloads for the CRM dashboard.
 */

import type { ChartWidgetData, RecordGridWidgetData } from '@/types'

export const ordersByStatusChart: ChartWidgetData = {
  type: 'chart',
  chartType: 'bar',
  title: 'Orders by Status',
  labels: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
  datasets: [
    {
      label: 'Orders',
      data: [4, 4, 3, 7, 1],
      color: '#6366f1',
    },
  ],
}

export const revenueLastYearChart: ChartWidgetData = {
  type: 'chart',
  chartType: 'line',
  title: 'Revenue — Last 12 Months',
  labels: ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'],
  datasets: [
    {
      label: 'Revenue (USD)',
      data: [
        185000, 210000, 198000, 245000, 278000, 301000,
        289000, 315000, 342750, 328000, 367000, 402500,
      ],
      color: '#10b981',
    },
  ],
}

export const recentOrdersGrid: RecordGridWidgetData = {
  type: 'recordGrid',
  tableName: 'order',
  columns: ['orderNumber', 'personId', 'companyId', 'status', 'total', 'orderDate'],
  records: [
    {
      values: {
        id: 20,
        orderNumber: 'ORD-2024-0020',
        personId: 4,
        companyId: 4,
        status: 'Processing',
        total: 61500.00,
        orderDate: '2024-05-06T14:00:00',
      },
      displayValues: {
        personId: 'David Chen',
        companyId: 'Umbrella Inc',
        total: '$61,500.00',
        orderDate: '05/06/2024',
      },
    },
    {
      values: {
        id: 19,
        orderNumber: 'ORD-2024-0019',
        personId: 1,
        companyId: 2,
        status: 'Pending',
        total: 195000.00,
        orderDate: '2024-05-01T09:30:00',
      },
      displayValues: {
        personId: 'Alice Johnson',
        companyId: 'Globex Corporation',
        total: '$195,000.00',
        orderDate: '05/01/2024',
      },
    },
    {
      values: {
        id: 18,
        orderNumber: 'ORD-2024-0018',
        personId: 25,
        companyId: 9,
        status: 'Delivered',
        total: 28900.00,
        orderDate: '2024-04-26T11:45:00',
      },
      displayValues: {
        personId: 'Yusuf Khan',
        companyId: 'Wayne Enterprises',
        total: '$28,900.00',
        orderDate: '04/26/2024',
      },
    },
    {
      values: {
        id: 17,
        orderNumber: 'ORD-2024-0017',
        personId: 13,
        companyId: 3,
        status: 'Shipped',
        total: 7600.00,
        orderDate: '2024-04-20T13:00:00',
      },
      displayValues: {
        personId: 'Mia Taylor',
        companyId: 'Initech',
        total: '$7,600.00',
        orderDate: '04/20/2024',
      },
    },
    {
      values: {
        id: 16,
        orderNumber: 'ORD-2024-0016',
        personId: 16,
        companyId: 8,
        status: 'Pending',
        total: 44500.00,
        orderDate: '2024-04-14T09:00:00',
      },
      displayValues: {
        personId: 'Peter Clark',
        companyId: 'Stark Industries',
        total: '$44,500.00',
        orderDate: '04/14/2024',
      },
    },
  ],
  totalCount: 20,
}
