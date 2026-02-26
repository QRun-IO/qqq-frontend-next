// MSW handlers for metadata endpoints

import { http, HttpResponse } from 'msw'
import { qInstance } from '../fixtures/q-instance'

const BASE = '/qqq/v1'

export const metadataHandlers = [
  // GET /metaData — full QInstance
  http.get(`${BASE}/metaData`, () => {
    return HttpResponse.json(qInstance)
  }),

  // GET /metaData/table/:tableName
  http.get(`${BASE}/metaData/table/:tableName`, ({ params }) => {
    const { tableName } = params as { tableName: string }
    const table = qInstance.tables[tableName]
    if (!table) {
      return HttpResponse.json({ error: `Table '${tableName}' not found` }, { status: 404 })
    }
    return HttpResponse.json(table)
  }),

  // GET /metaData/process/:processName
  http.get(`${BASE}/metaData/process/:processName`, ({ params }) => {
    const { processName } = params as { processName: string }
    const process = qInstance.processes[processName]
    if (!process) {
      return HttpResponse.json({ error: `Process '${processName}' not found` }, { status: 404 })
    }
    return HttpResponse.json(process)
  }),
]
