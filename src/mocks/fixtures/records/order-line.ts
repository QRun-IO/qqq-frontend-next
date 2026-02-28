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

// Mock order line records — child records of orders, referencing products

import type { QRecord } from '@/types'

export const orderLineRecords: QRecord[] = [
  // Order 1 (ORD-2024-0001, total $4,500)
  {
    tableName: 'orderLine',
    recordLabel: 'ORD-2024-0001 — Line 1',
    values: { id: 1, orderId: 1, productId: 1, sku: 'ELEC-001', productName: 'Wireless Mouse', quantity: 5, unitPrice: 29.99, lineTotal: 149.95 },
    displayValues: { orderId: 'ORD-2024-0001', productId: 'Wireless Mouse' },
  },
  {
    tableName: 'orderLine',
    recordLabel: 'ORD-2024-0001 — Line 2',
    values: { id: 2, orderId: 1, productId: 3, sku: 'ELEC-003', productName: 'USB-C Hub', quantity: 10, unitPrice: 45.00, lineTotal: 450.00 },
    displayValues: { orderId: 'ORD-2024-0001', productId: 'USB-C Hub' },
  },
  {
    tableName: 'orderLine',
    recordLabel: 'ORD-2024-0001 — Line 3',
    values: { id: 3, orderId: 1, productId: 7, sku: 'OFFC-002', productName: 'Standing Desk', quantity: 2, unitPrice: 649.00, lineTotal: 1298.00 },
    displayValues: { orderId: 'ORD-2024-0001', productId: 'Standing Desk' },
  },

  // Order 2 (ORD-2024-0002, total $1,200)
  {
    tableName: 'orderLine',
    recordLabel: 'ORD-2024-0002 — Line 1',
    values: { id: 4, orderId: 2, productId: 2, sku: 'ELEC-002', productName: 'Mechanical Keyboard', quantity: 3, unitPrice: 89.99, lineTotal: 269.97 },
    displayValues: { orderId: 'ORD-2024-0002', productId: 'Mechanical Keyboard' },
  },
  {
    tableName: 'orderLine',
    recordLabel: 'ORD-2024-0002 — Line 2',
    values: { id: 5, orderId: 2, productId: 5, sku: 'OFFC-001', productName: 'Ergonomic Chair', quantity: 1, unitPrice: 399.00, lineTotal: 399.00 },
    displayValues: { orderId: 'ORD-2024-0002', productId: 'Ergonomic Chair' },
  },

  // Order 3 (ORD-2024-0003, total $3,250)
  {
    tableName: 'orderLine',
    recordLabel: 'ORD-2024-0003 — Line 1',
    values: { id: 6, orderId: 3, productId: 4, sku: 'ELEC-004', productName: '27" Monitor', quantity: 4, unitPrice: 349.00, lineTotal: 1396.00 },
    displayValues: { orderId: 'ORD-2024-0003', productId: '27" Monitor' },
  },
  {
    tableName: 'orderLine',
    recordLabel: 'ORD-2024-0003 — Line 2',
    values: { id: 7, orderId: 3, productId: 1, sku: 'ELEC-001', productName: 'Wireless Mouse', quantity: 4, unitPrice: 29.99, lineTotal: 119.96 },
    displayValues: { orderId: 'ORD-2024-0003', productId: 'Wireless Mouse' },
  },

  // Order 4 (ORD-2024-0004, total $650)
  {
    tableName: 'orderLine',
    recordLabel: 'ORD-2024-0004 — Line 1',
    values: { id: 8, orderId: 4, productId: 10, sku: 'TOOL-002', productName: 'Cordless Drill', quantity: 2, unitPrice: 129.00, lineTotal: 258.00 },
    displayValues: { orderId: 'ORD-2024-0004', productId: 'Cordless Drill' },
  },
  {
    tableName: 'orderLine',
    recordLabel: 'ORD-2024-0004 — Line 2',
    values: { id: 9, orderId: 4, productId: 11, sku: 'TOOL-003', productName: 'Socket Set', quantity: 1, unitPrice: 89.99, lineTotal: 89.99 },
    displayValues: { orderId: 'ORD-2024-0004', productId: 'Socket Set' },
  },

  // Order 5 (ORD-2024-0005, total $8,750)
  {
    tableName: 'orderLine',
    recordLabel: 'ORD-2024-0005 — Line 1',
    values: { id: 10, orderId: 5, productId: 7, sku: 'OFFC-002', productName: 'Standing Desk', quantity: 5, unitPrice: 649.00, lineTotal: 3245.00 },
    displayValues: { orderId: 'ORD-2024-0005', productId: 'Standing Desk' },
  },
  {
    tableName: 'orderLine',
    recordLabel: 'ORD-2024-0005 — Line 2',
    values: { id: 11, orderId: 5, productId: 5, sku: 'OFFC-001', productName: 'Ergonomic Chair', quantity: 5, unitPrice: 399.00, lineTotal: 1995.00 },
    displayValues: { orderId: 'ORD-2024-0005', productId: 'Ergonomic Chair' },
  },
  {
    tableName: 'orderLine',
    recordLabel: 'ORD-2024-0005 — Line 3',
    values: { id: 12, orderId: 5, productId: 1, sku: 'ELEC-001', productName: 'Wireless Mouse', quantity: 5, unitPrice: 29.99, lineTotal: 149.95 },
    displayValues: { orderId: 'ORD-2024-0005', productId: 'Wireless Mouse' },
  },
  {
    tableName: 'orderLine',
    recordLabel: 'ORD-2024-0005 — Line 4',
    values: { id: 13, orderId: 5, productId: 2, sku: 'ELEC-002', productName: 'Mechanical Keyboard', quantity: 5, unitPrice: 89.99, lineTotal: 449.95 },
    displayValues: { orderId: 'ORD-2024-0005', productId: 'Mechanical Keyboard' },
  },

  // Order 6-10 (1-2 lines each)
  {
    tableName: 'orderLine',
    recordLabel: 'ORD-2024-0006 — Line 1',
    values: { id: 14, orderId: 6, productId: 12, sku: 'FOOD-001', productName: 'Coffee Beans (5lb)', quantity: 20, unitPrice: 24.99, lineTotal: 499.80 },
    displayValues: { orderId: 'ORD-2024-0006', productId: 'Coffee Beans (5lb)' },
  },
  {
    tableName: 'orderLine',
    recordLabel: 'ORD-2024-0007 — Line 1',
    values: { id: 15, orderId: 7, productId: 6, sku: 'OFFC-003', productName: 'Desk Lamp', quantity: 10, unitPrice: 34.99, lineTotal: 349.90 },
    displayValues: { orderId: 'ORD-2024-0007', productId: 'Desk Lamp' },
  },
  {
    tableName: 'orderLine',
    recordLabel: 'ORD-2024-0008 — Line 1',
    values: { id: 16, orderId: 8, productId: 4, sku: 'ELEC-004', productName: '27" Monitor', quantity: 2, unitPrice: 349.00, lineTotal: 698.00 },
    displayValues: { orderId: 'ORD-2024-0008', productId: '27" Monitor' },
  },
  {
    tableName: 'orderLine',
    recordLabel: 'ORD-2024-0008 — Line 2',
    values: { id: 17, orderId: 8, productId: 3, sku: 'ELEC-003', productName: 'USB-C Hub', quantity: 2, unitPrice: 45.00, lineTotal: 90.00 },
    displayValues: { orderId: 'ORD-2024-0008', productId: 'USB-C Hub' },
  },
  {
    tableName: 'orderLine',
    recordLabel: 'ORD-2024-0009 — Line 1',
    values: { id: 18, orderId: 9, productId: 14, sku: 'CLTH-001', productName: 'Safety Vest', quantity: 50, unitPrice: 12.99, lineTotal: 649.50 },
    displayValues: { orderId: 'ORD-2024-0009', productId: 'Safety Vest' },
  },
  {
    tableName: 'orderLine',
    recordLabel: 'ORD-2024-0010 — Line 1',
    values: { id: 19, orderId: 10, productId: 9, sku: 'TOOL-001', productName: 'Power Drill', quantity: 3, unitPrice: 149.00, lineTotal: 447.00 },
    displayValues: { orderId: 'ORD-2024-0010', productId: 'Power Drill' },
  },
  {
    tableName: 'orderLine',
    recordLabel: 'ORD-2024-0010 — Line 2',
    values: { id: 20, orderId: 10, productId: 10, sku: 'TOOL-002', productName: 'Cordless Drill', quantity: 3, unitPrice: 129.00, lineTotal: 387.00 },
    displayValues: { orderId: 'ORD-2024-0010', productId: 'Cordless Drill' },
  },
]
