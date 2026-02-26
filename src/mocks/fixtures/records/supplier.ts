// Fixture data for the `supplier` table

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
    },
    displayValues: { id: '1' },
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
    },
    displayValues: { id: '2' },
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
    },
    displayValues: { id: '3' },
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
    },
    displayValues: { id: '4' },
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
    },
    displayValues: { id: '5' },
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
    },
    displayValues: { id: '6' },
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
    },
    displayValues: { id: '7' },
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
    },
    displayValues: { id: '8' },
  },
]
