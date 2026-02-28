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

// Mock audit records — keyed by "{tableName}:{primaryKey}"
import type { QAuditRecord } from '@/types'

function audit(
  id: number,
  tableName: string,
  recordId: string | number,
  timestamp: string,
  user: string,
  action: 'INSERT' | 'UPDATE' | 'DELETE',
  fieldChanges: Array<{ fieldName: string; oldValue: unknown; newValue: unknown }>,
  message?: string
): QAuditRecord {
  return { id, auditTableName: tableName, recordId, timestamp, user, action, fieldChanges, message }
}

export const auditRecords: Record<string, QAuditRecord[]> = {
  'person:1': [
    audit(1, 'person', 1, '2023-01-15T09:00:00', 'system', 'INSERT', [
      { fieldName: 'firstName', oldValue: null, newValue: 'Alice' },
      { fieldName: 'lastName', oldValue: null, newValue: 'Johnson' },
      { fieldName: 'email', oldValue: null, newValue: 'alice.johnson@globex.example.com' },
      { fieldName: 'status', oldValue: null, newValue: 'Lead' },
    ], 'Record created'),
    audit(2, 'person', 1, '2023-03-22T14:30:00', 'admin@example.com', 'UPDATE', [
      { fieldName: 'status', oldValue: 'Lead', newValue: 'Active' },
      { fieldName: 'title', oldValue: null, newValue: 'Senior Engineer' },
    ], 'Converted from lead'),
    audit(3, 'person', 1, '2023-07-10T11:15:00', 'admin@example.com', 'UPDATE', [
      { fieldName: 'title', oldValue: 'Senior Engineer', newValue: 'VP of Engineering' },
    ]),
    audit(4, 'person', 1, '2024-01-08T16:45:00', 'jsmith@example.com', 'UPDATE', [
      { fieldName: 'phone', oldValue: '555-0100', newValue: '555-0101' },
      { fieldName: 'notes', oldValue: null, newValue: 'Key technical decision maker. Prefers email communication.' },
    ]),
  ],
  'order:4': [
    audit(10, 'order', 4, '2024-02-01T11:00:00', 'system', 'INSERT', [
      { fieldName: 'orderNumber', oldValue: null, newValue: 'ORD-2024-0004' },
      { fieldName: 'status', oldValue: null, newValue: 'Pending' },
      { fieldName: 'total', oldValue: null, newValue: 42000.00 },
    ], 'Order placed'),
    audit(11, 'order', 4, '2024-02-03T09:20:00', 'admin@example.com', 'UPDATE', [
      { fieldName: 'status', oldValue: 'Pending', newValue: 'Processing' },
    ], 'Approved by manager'),
    audit(12, 'order', 4, '2024-02-05T14:00:00', 'jsmith@example.com', 'UPDATE', [
      { fieldName: 'notes', oldValue: null, newValue: 'Requires executive sign-off.' },
    ]),
  ],
  'product:3': [
    audit(20, 'product', 3, '2023-06-15T08:30:00', 'system', 'INSERT', [
      { fieldName: 'sku', oldValue: null, newValue: 'ELEC-HP-003' },
      { fieldName: 'name', oldValue: null, newValue: 'Noise-Cancelling Headphones' },
      { fieldName: 'price', oldValue: null, newValue: 279.99 },
      { fieldName: 'active', oldValue: null, newValue: true },
    ], 'Product created'),
    audit(21, 'product', 3, '2023-09-01T10:00:00', 'admin@example.com', 'UPDATE', [
      { fieldName: 'price', oldValue: 279.99, newValue: 299.99 },
    ], 'Price adjustment for Q4'),
    audit(22, 'product', 3, '2024-01-15T13:45:00', 'warehouse@example.com', 'UPDATE', [
      { fieldName: 'stockQuantity', oldValue: 45, newValue: 92 },
      { fieldName: 'reorderLevel', oldValue: 10, newValue: 15 },
    ], 'Restocked — adjusted reorder level'),
  ],
  'company:2': [
    audit(30, 'company', 2, '2022-05-10T10:00:00', 'system', 'INSERT', [
      { fieldName: 'name', oldValue: null, newValue: 'Globex Corporation' },
      { fieldName: 'industry', oldValue: null, newValue: 'Technology' },
      { fieldName: 'website', oldValue: null, newValue: 'https://globex.example.com' },
    ], 'Company created'),
    audit(31, 'company', 2, '2023-04-18T15:30:00', 'admin@example.com', 'UPDATE', [
      { fieldName: 'revenue', oldValue: 52000000.00, newValue: 87000000.00 },
      { fieldName: 'employeeCount', oldValue: 800, newValue: 1200 },
    ], 'Annual financials updated'),
  ],
  'supplier:2': [
    audit(40, 'supplier', 2, '2022-08-20T09:00:00', 'system', 'INSERT', [
      { fieldName: 'name', oldValue: null, newValue: 'AudioWave Supplies' },
      { fieldName: 'contactName', oldValue: null, newValue: 'Priya Sharma' },
      { fieldName: 'email', oldValue: null, newValue: 'psharma@audiowave.example.com' },
      { fieldName: 'country', oldValue: null, newValue: 'India' },
    ], 'Supplier onboarded'),
    audit(41, 'supplier', 2, '2023-11-05T11:20:00', 'procurement@example.com', 'UPDATE', [
      { fieldName: 'phone', oldValue: '555-1000', newValue: '555-1002' },
    ]),
  ],
}
