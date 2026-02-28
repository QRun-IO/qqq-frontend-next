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

// Widget fixture data — Inventory dashboard widgets

import type { ChartWidgetData, RecordGridWidgetData, QFieldMetaData } from '@/types'
import type { StatisticsWidgetPayload } from '@/components/widgets/StatisticsWidget'

// ─── Row 1: KPI overview (4 tiles, full-width) ────────────────────────────────

export const invKpis: StatisticsWidgetPayload = {
  type: 'statistics',
  statistics: [
    {
      label: 'Total Products',
      value: 15,
      trend: { direction: 'up', value: 3, label: 'added this month' },
    },
    {
      label: 'Low Stock Alerts',
      value: 4,
      unit: 'SKUs',
      trend: { direction: 'up', value: 33, label: 'vs last week' },
    },
    {
      label: 'Inventory Value',
      value: '$136,254',
      unit: 'USD',
      trend: { direction: 'down', value: 21, label: 'vs last quarter' },
    },
    {
      label: 'Active Suppliers',
      value: 8,
      trend: { direction: 'flat', value: 0, label: 'no change' },
    },
  ],
}

// ─── Row 2a: Stock units by category (bar chart, span 2) ─────────────────────
// Stock quantities: Electronics 462, Office 1060, Food 495, Clothing 127, Tools 138

export const invStockByCategory: ChartWidgetData = {
  type: 'chart',
  chartType: 'bar',
  title: 'Stock Units by Category',
  labels: ['Office', 'Electronics', 'Food', 'Tools', 'Clothing'],
  datasets: [
    {
      label: 'Units in Stock',
      data: [1060, 462, 495, 138, 127],
      color: '#6366f1',
    },
  ],
}

// ─── Row 2b: Reorder required (single stat, span 1) ──────────────────────────

export const invLowStockCount: StatisticsWidgetPayload = {
  type: 'statistics',
  title: 'Reorder Required',
  value: 4,
  unit: 'SKUs',
  trend: { direction: 'up', value: 33, label: 'vs last week' },
}

// ─── Row 3: Inventory value trend — last 6 months (line chart, full-width) ───
// Declining trend as stock depletes without full restocking

export const invValueTrend: ChartWidgetData = {
  type: 'chart',
  chartType: 'line',
  title: 'Inventory Value — Last 6 Months',
  labels: ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'],
  datasets: [
    {
      label: 'Value (USD)',
      data: [178500, 182300, 165800, 152100, 141000, 136254],
      color: '#f59e0b',
    },
  ],
}

// ─── Row 4: Products needing reorder (record grid, full-width) ───────────────
// Sorted by urgency: out-of-stock first, then by qty/reorderLevel ratio

function f(name: string, label: string, type: QFieldMetaData['type'] = 'STRING'): QFieldMetaData {
  return { name, label, type, isRequired: false, isEditable: false, isHeavy: false, isHidden: false, adornments: [] }
}

export const invLowStockItems: RecordGridWidgetData = {
  type: 'recordGrid',
  tableName: 'product',
  fields: [
    f('sku', 'SKU'),
    f('name', 'Product Name'),
    f('category', 'Category'),
    f('stockQuantity', 'In Stock', 'INTEGER'),
    f('reorderLevel', 'Reorder At', 'INTEGER'),
    f('supplierId', 'Supplier'),
  ],
  records: [
    {
      values: { id: 13, sku: 'OFFC-MRK-002', name: 'Whiteboard Markers (8-pack)', category: 'Office', stockQuantity: 0, reorderLevel: 50, supplierId: 3 },
      displayValues: { supplierId: 'OfficeComfort Co.' },
    },
    {
      values: { id: 7, sku: 'TOOL-DRL-002', name: 'Heavy-Duty Drill Press', category: 'Tools', stockQuantity: 3, reorderLevel: 5, supplierId: 4 },
      displayValues: { supplierId: 'ProTools Manufacturing' },
    },
    {
      values: { id: 11, sku: 'CLTH-BOT-001', name: 'Steel-Toe Safety Boots (Size 10)', category: 'Clothing', stockQuantity: 7, reorderLevel: 10, supplierId: 6 },
      displayValues: { supplierId: 'SafeWear Apparel' },
    },
    {
      values: { id: 3, sku: 'ELEC-HP-003', name: 'Noise-Cancelling Headphones', category: 'Electronics', stockQuantity: 12, reorderLevel: 15, supplierId: 2 },
      displayValues: { supplierId: 'AudioWave Supplies' },
    },
  ],
  totalCount: 4,
}
