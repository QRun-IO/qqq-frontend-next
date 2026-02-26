// MSW handlers for widget endpoints

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

const BASE = '/qqq/v1'

const widgetData: Record<string, unknown> = {
  crmTotalPeople: totalPeopleStats,
  crmActiveCompanies: activeCompaniesStats,
  crmOpenOrders: openOrdersStats,
  crmMonthlyRevenue: monthlyRevenueStats,
  crmOrdersByStatus: ordersByStatusChart,
  crmRevenueChart: revenueLastYearChart,
  crmRecentOrders: recentOrdersGrid,
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
