// TanStack Query v5 client configuration with query key factory

import { QueryClient, defaultShouldDehydrateQuery } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes default
      gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
    dehydrate: {
      shouldDehydrateQuery: (query) =>
        defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
    },
  },
})

// Query key factory — ensures consistent keys across all components
export const queryKeys = {
  all: () => ['qqq'] as const,

  // Auth
  auth: () => [...queryKeys.all(), 'auth'] as const,
  authMeta: () => [...queryKeys.auth(), 'metadata'] as const,

  // Metadata
  metadata: () => [...queryKeys.all(), 'metadata'] as const,
  metadataAll: () => [...queryKeys.metadata(), 'all'] as const,
  tableMetadata: (tableName: string) =>
    [...queryKeys.metadata(), 'table', tableName] as const,
  processMetadata: (processName: string) =>
    [...queryKeys.metadata(), 'process', processName] as const,

  // Records
  records: () => [...queryKeys.all(), 'records'] as const,
  tableRecords: (tableName: string) => [...queryKeys.records(), tableName] as const,
  tableRecord: (tableName: string, id: string | number) =>
    [...queryKeys.tableRecords(tableName), id] as const,
  tableCount: (tableName: string, filterHash: string) =>
    [...queryKeys.tableRecords(tableName), 'count', filterHash] as const,

  // Processes
  processes: () => [...queryKeys.all(), 'processes'] as const,
  processStatus: (processName: string, processUUID: string, jobUUID: string) =>
    [...queryKeys.processes(), processName, processUUID, 'status', jobUUID] as const,

  // Widgets
  widgets: () => [...queryKeys.all(), 'widgets'] as const,
  widgetData: (widgetName: string, params?: Record<string, unknown>) =>
    [...queryKeys.widgets(), widgetName, params] as const,

  // Possible Values
  possibleValues: () => [...queryKeys.all(), 'possibleValues'] as const,
  tablePossibleValues: (tableName: string, fieldName: string, searchTerm?: string) =>
    [...queryKeys.possibleValues(), 'table', tableName, fieldName, searchTerm] as const,
}
