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
 * @file Fixture data for the `company` table.
 */

import type { QRecord } from '@/types'

export const companyRecords: QRecord[] = [
  {
    tableName: 'company',
    recordLabel: 'Acme Corp',
    values: {
      id: 1,
      name: 'Acme Corp',
      industry: 'Manufacturing',
      website: 'https://acme.example.com',
      revenue: 12500000.00,
      employeeCount: 250,
      city: 'Chicago',
      state: 'IL',
      country: 'USA',
      createDate: '2022-03-10T08:00:00',
      modifyDate: '2024-10-15T14:22:00',
    },
    displayValues: {
      id: '1',
      revenue: '$12,500,000.00',
      employeeCount: '250',
      createDate: '03/10/2022 8:00 AM',
      modifyDate: '10/15/2024 2:22 PM',
    },
  },
  {
    tableName: 'company',
    recordLabel: 'Globex Corporation',
    values: {
      id: 2,
      name: 'Globex Corporation',
      industry: 'Technology',
      website: 'https://globex.example.com',
      revenue: 87000000.00,
      employeeCount: 1200,
      city: 'San Francisco',
      state: 'CA',
      country: 'USA',
      createDate: '2021-11-22T10:30:00',
      modifyDate: '2024-12-01T09:45:00',
    },
    displayValues: {
      id: '2',
      revenue: '$87,000,000.00',
      employeeCount: '1,200',
      createDate: '11/22/2021 10:30 AM',
      modifyDate: '12/01/2024 9:45 AM',
    },
  },
  {
    tableName: 'company',
    recordLabel: 'Initech',
    values: {
      id: 3,
      name: 'Initech',
      industry: 'Finance',
      website: 'https://initech.example.com',
      revenue: 34000000.00,
      employeeCount: 420,
      city: 'Austin',
      state: 'TX',
      country: 'USA',
      createDate: '2022-06-15T14:00:00',
      modifyDate: '2024-11-18T11:30:00',
    },
    displayValues: {
      id: '3',
      revenue: '$34,000,000.00',
      employeeCount: '420',
      createDate: '06/15/2022 2:00 PM',
      modifyDate: '11/18/2024 11:30 AM',
    },
  },
  {
    tableName: 'company',
    recordLabel: 'Umbrella Inc',
    values: {
      id: 4,
      name: 'Umbrella Inc',
      industry: 'Healthcare',
      website: 'https://umbrella.example.com',
      revenue: 210000000.00,
      employeeCount: 5500,
      city: 'Boston',
      state: 'MA',
      country: 'USA',
      createDate: '2021-08-05T09:15:00',
      modifyDate: '2024-12-12T16:00:00',
    },
    displayValues: {
      id: '4',
      revenue: '$210,000,000.00',
      employeeCount: '5,500',
      createDate: '08/05/2021 9:15 AM',
      modifyDate: '12/12/2024 4:00 PM',
    },
  },
  {
    tableName: 'company',
    recordLabel: 'Dunder Mifflin',
    values: {
      id: 5,
      name: 'Dunder Mifflin',
      industry: 'Retail',
      website: 'https://dundermifflin.example.com',
      revenue: 4200000.00,
      employeeCount: 85,
      city: 'Scranton',
      state: 'PA',
      country: 'USA',
      createDate: '2022-09-01T11:45:00',
      modifyDate: '2024-08-20T10:10:00',
    },
    displayValues: {
      id: '5',
      revenue: '$4,200,000.00',
      employeeCount: '85',
      createDate: '09/01/2022 11:45 AM',
      modifyDate: '08/20/2024 10:10 AM',
    },
  },
  {
    tableName: 'company',
    recordLabel: 'Massive Dynamic',
    values: {
      id: 6,
      name: 'Massive Dynamic',
      industry: 'Technology',
      website: 'https://massivedynamic.example.com',
      revenue: 450000000.00,
      employeeCount: 8000,
      city: 'New York',
      state: 'NY',
      country: 'USA',
      createDate: '2021-05-18T13:00:00',
      modifyDate: '2025-01-07T08:30:00',
    },
    displayValues: {
      id: '6',
      revenue: '$450,000,000.00',
      employeeCount: '8,000',
      createDate: '05/18/2021 1:00 PM',
      modifyDate: '01/07/2025 8:30 AM',
    },
  },
  {
    tableName: 'company',
    recordLabel: 'Pied Piper',
    values: {
      id: 7,
      name: 'Pied Piper',
      industry: 'Technology',
      website: 'https://piedpiper.example.com',
      revenue: 1800000.00,
      employeeCount: 12,
      city: 'Palo Alto',
      state: 'CA',
      country: 'USA',
      createDate: '2023-10-02T15:30:00',
      modifyDate: '2025-01-20T12:15:00',
    },
    displayValues: {
      id: '7',
      revenue: '$1,800,000.00',
      employeeCount: '12',
      createDate: '10/02/2023 3:30 PM',
      modifyDate: '01/20/2025 12:15 PM',
    },
  },
  {
    tableName: 'company',
    recordLabel: 'Stark Industries',
    values: {
      id: 8,
      name: 'Stark Industries',
      industry: 'Manufacturing',
      website: 'https://stark.example.com',
      revenue: 1200000000.00,
      employeeCount: 25000,
      city: 'Malibu',
      state: 'CA',
      country: 'USA',
      createDate: '2021-02-14T07:45:00',
      modifyDate: '2024-11-28T17:20:00',
    },
    displayValues: {
      id: '8',
      revenue: '$1,200,000,000.00',
      employeeCount: '25,000',
      createDate: '02/14/2021 7:45 AM',
      modifyDate: '11/28/2024 5:20 PM',
    },
  },
  {
    tableName: 'company',
    recordLabel: 'Wayne Enterprises',
    values: {
      id: 9,
      name: 'Wayne Enterprises',
      industry: 'Finance',
      website: 'https://wayne.example.com',
      revenue: 980000000.00,
      employeeCount: 14000,
      city: 'Gotham City',
      state: 'NJ',
      country: 'USA',
      createDate: '2021-07-20T10:00:00',
      modifyDate: '2024-12-30T13:40:00',
    },
    displayValues: {
      id: '9',
      revenue: '$980,000,000.00',
      employeeCount: '14,000',
      createDate: '07/20/2021 10:00 AM',
      modifyDate: '12/30/2024 1:40 PM',
    },
  },
  {
    tableName: 'company',
    recordLabel: 'Prestige Worldwide',
    values: {
      id: 10,
      name: 'Prestige Worldwide',
      industry: 'Education',
      website: 'https://prestigeworldwide.example.com',
      revenue: 750000.00,
      employeeCount: 8,
      city: 'Miami',
      state: 'FL',
      country: 'USA',
      createDate: '2023-04-12T16:20:00',
      modifyDate: '2024-07-08T11:55:00',
    },
    displayValues: {
      id: '10',
      revenue: '$750,000.00',
      employeeCount: '8',
      createDate: '04/12/2023 4:20 PM',
      modifyDate: '07/08/2024 11:55 AM',
    },
  },
]
