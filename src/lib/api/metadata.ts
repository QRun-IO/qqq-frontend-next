// Metadata API functions

import type { QInstance, QTableMetaData, QProcessMetaData } from '@/types'
import apiClient from './client'

export async function loadMetaData(): Promise<QInstance> {
  return apiClient.get<QInstance>('/metaData', {
    params: {
      frontendName: 'qqq-frontend-next',
      frontendVersion: process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0',
    },
  })
}

export async function loadTableMetaData(tableName: string): Promise<QTableMetaData> {
  return apiClient.get<QTableMetaData>(`/metaData/table/${encodeURIComponent(tableName)}`)
}

export async function loadProcessMetaData(processName: string): Promise<QProcessMetaData> {
  return apiClient.get<QProcessMetaData>(`/metaData/process/${encodeURIComponent(processName)}`)
}
