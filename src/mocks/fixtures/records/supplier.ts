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
 * @file Fixture data for the `supplier` table.
 */

import type { QRecord } from '@/types'

export const supplierRecords: QRecord[] = [
  {
    tableName: 'supplier',
    recordLabel: 'TechSource Global',
    values: {
      id: 1,
      name: 'TechSource Global',
      contactName: 'Marcus Webb',
      email: 'mwebb@techsource.example.com',
      phone: '555-1001',
      country: 'USA',
      createDate: '2022-01-10T08:00:00',
      modifyDate: '2024-10-22T14:30:00',
    },
    displayValues: {
      id: '1',
      createDate: '01/10/2022 8:00 AM',
      modifyDate: '10/22/2024 2:30 PM',
    },
  },
  {
    tableName: 'supplier',
    recordLabel: 'AudioWave Supplies',
    values: {
      id: 2,
      name: 'AudioWave Supplies',
      contactName: 'Priya Sharma',
      email: 'psharma@audiowave.example.com',
      phone: '555-1002',
      country: 'India',
      createDate: '2022-04-18T11:30:00',
      modifyDate: '2024-09-10T09:15:00',
    },
    displayValues: {
      id: '2',
      createDate: '04/18/2022 11:30 AM',
      modifyDate: '09/10/2024 9:15 AM',
    },
  },
  {
    tableName: 'supplier',
    recordLabel: 'OfficeComfort Co.',
    values: {
      id: 3,
      name: 'OfficeComfort Co.',
      contactName: 'Dale Hutchins',
      email: 'dhutchins@officecomfort.example.com',
      phone: '555-1003',
      country: 'Canada',
      createDate: '2022-06-25T14:00:00',
      modifyDate: '2024-11-05T16:45:00',
    },
    displayValues: {
      id: '3',
      createDate: '06/25/2022 2:00 PM',
      modifyDate: '11/05/2024 4:45 PM',
    },
  },
  {
    tableName: 'supplier',
    recordLabel: 'ProTools Manufacturing',
    values: {
      id: 4,
      name: 'ProTools Manufacturing',
      contactName: 'Hans Gruber',
      email: 'hgruber@protools.example.de',
      phone: '555-1004',
      country: 'Germany',
      createDate: '2022-08-14T10:20:00',
      modifyDate: '2024-12-18T11:00:00',
    },
    displayValues: {
      id: '4',
      createDate: '08/14/2022 10:20 AM',
      modifyDate: '12/18/2024 11:00 AM',
    },
  },
  {
    tableName: 'supplier',
    recordLabel: 'Fresh Origins Foods',
    values: {
      id: 5,
      name: 'Fresh Origins Foods',
      contactName: 'Carmen Diaz',
      email: 'cdiaz@freshorigins.example.com',
      phone: '555-1005',
      country: 'Mexico',
      createDate: '2022-10-03T09:45:00',
      modifyDate: '2025-01-08T13:20:00',
    },
    displayValues: {
      id: '5',
      createDate: '10/03/2022 9:45 AM',
      modifyDate: '01/08/2025 1:20 PM',
    },
  },
  {
    tableName: 'supplier',
    recordLabel: 'SafeWear Apparel',
    values: {
      id: 6,
      name: 'SafeWear Apparel',
      contactName: 'Lin Fang',
      email: 'lfang@safewear.example.cn',
      phone: '555-1006',
      country: 'China',
      createDate: '2022-12-12T15:30:00',
      modifyDate: '2024-08-25T10:40:00',
    },
    displayValues: {
      id: '6',
      createDate: '12/12/2022 3:30 PM',
      modifyDate: '08/25/2024 10:40 AM',
    },
  },
  {
    tableName: 'supplier',
    recordLabel: 'ChemTech Solutions',
    values: {
      id: 7,
      name: 'ChemTech Solutions',
      contactName: 'Sophie Laurent',
      email: 'slaurent@chemtech.example.fr',
      phone: '555-1007',
      country: 'France',
      createDate: '2023-02-20T08:15:00',
      modifyDate: '2024-11-30T15:10:00',
    },
    displayValues: {
      id: '7',
      createDate: '02/20/2023 8:15 AM',
      modifyDate: '11/30/2024 3:10 PM',
    },
  },
  {
    tableName: 'supplier',
    recordLabel: 'NorthStar Logistics',
    values: {
      id: 8,
      name: 'NorthStar Logistics',
      contactName: 'Erik Johansson',
      email: 'ejohansson@northstar.example.se',
      phone: '555-1008',
      country: 'Sweden',
      createDate: '2023-05-08T12:00:00',
      modifyDate: '2025-02-14T09:50:00',
    },
    displayValues: {
      id: '8',
      createDate: '05/08/2023 12:00 PM',
      modifyDate: '02/14/2025 9:50 AM',
    },
  },
]
