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
 * @file MSW handlers for widget data endpoints (`GET /widget/:widgetName`).
 */

import { http, HttpResponse } from 'msw'
import {
  totalPeopleStats,
  activeCompaniesStats,
  openOrdersStats,
  monthlyRevenueStats,
} from '../fixtures/widgets/statistics'
import {
  ordersByStatusChart,
  revenueLastYearChart,
  recentOrdersGrid,
} from '../fixtures/widgets/charts'
import {
  invKpis,
  invStockByCategory,
  invLowStockCount,
  invValueTrend,
  invLowStockItems,
} from '../fixtures/widgets/inventory'

const BASE = '/qqq/v1'

const widgetData: Record<string, unknown> = {
  // CRM widgets
  crmTotalPeople: totalPeopleStats,
  crmActiveCompanies: activeCompaniesStats,
  crmOpenOrders: openOrdersStats,
  crmMonthlyRevenue: monthlyRevenueStats,
  crmOrdersByStatus: ordersByStatusChart,
  crmRevenueChart: revenueLastYearChart,
  crmRecentOrders: recentOrdersGrid,
  // Inventory widgets
  invKpis,
  invStockByCategory,
  invLowStockCount,
  invValueTrend,
  invLowStockItems,
}

export const widgetHandlers = [
  // GET /widget/:widgetName
  http.get(`${BASE}/widget/:widgetName`, ({ params }) => {
    const { widgetName } = params as { widgetName: string }
    const data = widgetData[widgetName]

    if (!data) {
      return HttpResponse.json(
        { error: `Widget '${widgetName}' not found` },
        { status: 404 }
      )
    }

    return HttpResponse.json(data)
  }),
]
