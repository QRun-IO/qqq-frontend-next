// MSW handlers for process endpoints
// Simulates full process flows for importPeople and sendEmail

import { http, HttpResponse } from 'msw'
import type { QJobComplete, QJobStarted } from '@/types'

const BASE = '/qqq/v1'

// Active process sessions (keyed by processUUID)
interface ProcessSession {
  processName: string
  step: string
  values: Record<string, unknown>
}

const activeSessions = new Map<string, ProcessSession>()

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// Process step flow definitions (processName → ordered step names)
const stepFlows: Record<string, string[]> = {
  importPeople: ['upload', 'validate', 'confirm'],
  sendEmail: ['compose', 'preview', 'send'],
}

function getNextStep(processName: string, currentStep: string): string | undefined {
  const steps = stepFlows[processName]
  if (!steps) return undefined
  const idx = steps.indexOf(currentStep)
  if (idx === -1 || idx >= steps.length - 1) return undefined
  return steps[idx + 1]
}

// ─── Mock validation rows for importPeople ─────────────────────────────────

const mockValidationRows = [
  {
    rowNumber: 3,
    fieldName: 'email',
    type: 'WARNING',
    message: 'Email address appears to be invalid: "john.doe@" — will be imported with null email',
  },
  {
    rowNumber: 7,
    fieldName: 'phone',
    type: 'WARNING',
    message: 'Phone number format not recognized: "555-CALL-US" — will be imported as-is',
  },
]

// ─── Mock records for importPeople record list step ───────────────────────

const mockPeopleRecords = [
  { tableName: 'person', recordLabel: 'Alice Johnson', values: { firstName: 'Alice', lastName: 'Johnson', email: 'alice@example.com', status: 'ACTIVE' }, displayValues: { firstName: 'Alice', lastName: 'Johnson', email: 'alice@example.com', status: 'Active' } },
  { tableName: 'person', recordLabel: 'Bob Smith', values: { firstName: 'Bob', lastName: 'Smith', email: 'bob@example.com', status: 'ACTIVE' }, displayValues: { firstName: 'Bob', lastName: 'Smith', email: 'bob@example.com', status: 'Active' } },
  { tableName: 'person', recordLabel: 'Carol White', values: { firstName: 'Carol', lastName: 'White', email: 'carol@example.com', status: 'PROSPECT' }, displayValues: { firstName: 'Carol', lastName: 'White', email: 'carol@example.com', status: 'Prospect' } },
  { tableName: 'person', recordLabel: 'David Brown', values: { firstName: 'David', lastName: 'Brown', email: 'david@example.com', status: 'ACTIVE' }, displayValues: { firstName: 'David', lastName: 'Brown', email: 'david@example.com', status: 'Active' } },
  { tableName: 'person', recordLabel: 'Eve Davis', values: { firstName: 'Eve', lastName: 'Davis', email: 'eve@example.com', status: 'INACTIVE' }, displayValues: { firstName: 'Eve', lastName: 'Davis', email: 'eve@example.com', status: 'Inactive' } },
]

// ─── Step value builders per process/step ────────────────────────────────

function buildStepValues(
  processName: string,
  stepName: string,
  sessionValues: Record<string, unknown>
): Record<string, unknown> {
  // importPeople: validate step → return validation results
  if (processName === 'importPeople' && stepName === 'upload') {
    return {
      ...sessionValues,
      // After upload, return validation results for the next step
      totalRecords: 5,
      validRecords: 3,
      errorRecords: 0,
      warningRecords: 2,
      validationRows: mockValidationRows,
      records: mockPeopleRecords,
    }
  }

  // importPeople: validate step → advance to confirm, carry all values
  if (processName === 'importPeople' && stepName === 'validate') {
    return {
      ...sessionValues,
      records: mockPeopleRecords,
    }
  }

  // importPeople: confirm step → complete with results
  if (processName === 'importPeople' && stepName === 'confirm') {
    return {
      ...sessionValues,
      recordsInserted: 5,
      recordsUpdated: 0,
      successMessage: '5 records imported successfully.',
    }
  }

  // sendEmail: compose step → pass values through for preview
  if (processName === 'sendEmail' && stepName === 'compose') {
    return {
      ...sessionValues,
      recipientCount: 3, // Mock recipient count
    }
  }

  // sendEmail: preview step → nothing additional
  if (processName === 'sendEmail' && stepName === 'preview') {
    return {
      ...sessionValues,
    }
  }

  // sendEmail: send step → complete with results
  if (processName === 'sendEmail' && stepName === 'send') {
    return {
      ...sessionValues,
      sentCount: sessionValues.recipientCount ?? 1,
      failedCount: 0,
      successMessage: `Email sent successfully to ${sessionValues.recipientCount ?? 1} recipient(s).`,
    }
  }

  return { ...sessionValues }
}

export const processHandlers = [
  // POST /processes/:processName/init
  http.post(`${BASE}/processes/:processName/init`, ({ params }) => {
    const { processName } = params as { processName: string }
    const steps = stepFlows[processName]
    if (!steps || steps.length === 0) {
      return HttpResponse.json(
        { error: `Process '${processName}' not found` },
        { status: 404 }
      )
    }

    const processUUID = generateUUID()
    const firstStep = steps[0]

    activeSessions.set(processUUID, {
      processName,
      step: firstStep,
      values: {},
    })

    const response: QJobComplete = {
      processUUID,
      values: {},
      nextStep: firstStep,
    }

    return HttpResponse.json(response)
  }),

  // POST /processes/:processName/:processUUID/step/:stepName
  http.post(
    `${BASE}/processes/:processName/:processUUID/step/:stepName`,
    async ({ params, request }) => {
      const { processName, processUUID, stepName } = params as {
        processName: string
        processUUID: string
        stepName: string
      }

      const session = activeSessions.get(processUUID)
      if (!session) {
        return HttpResponse.json(
          { error: `Process session '${processUUID}' not found` },
          { status: 404 }
        )
      }

      // Parse step values from request
      let stepValues: Record<string, unknown> = {}
      const contentType = request.headers.get('content-type') ?? ''
      try {
        if (contentType.includes('application/json')) {
          const body = (await request.json()) as { values?: Record<string, unknown> }
          stepValues = body.values ?? {}
        } else if (
          contentType.includes('multipart/form-data') ||
          contentType.includes('application/x-www-form-urlencoded')
        ) {
          const fd = await request.formData()
          fd.forEach((v, k) => {
            if (k === 'values') {
              try {
                const parsed = JSON.parse(String(v)) as Record<string, unknown>
                Object.assign(stepValues, parsed)
              } catch {
                stepValues[k] = v
              }
            } else if (k !== 'file') {
              stepValues[k] = v
            }
          })
        }
      } catch {
        // Ignore parse errors
      }

      // Merge step values into session
      session.values = { ...session.values, ...stepValues }
      session.step = stepName

      const nextStep = getNextStep(processName, stepName)
      const outValues = buildStepValues(processName, stepName, session.values)

      const response: QJobComplete = {
        processUUID,
        values: outValues,
        nextStep,
      }

      return HttpResponse.json(response)
    }
  ),

  // GET /processes/:processName/:processUUID/status/:jobUUID
  http.get(
    `${BASE}/processes/:processName/:processUUID/status/:jobUUID`,
    ({ params }) => {
      const { processUUID } = params as { processUUID: string; jobUUID: string; processName: string }
      const session = activeSessions.get(processUUID)

      if (!session) {
        return HttpResponse.json(
          { error: `Process session '${processUUID}' not found` },
          { status: 404 }
        )
      }

      // In mock, async jobs return QJobStarted which resolves immediately
      // Real polling logic is handled by returning a QJobComplete on the next poll
      const response: QJobStarted = {
        processUUID,
        jobUUID: generateUUID(),
      }

      return HttpResponse.json(response)
    }
  ),

  // GET /processes/:processName/:processUUID/records
  http.get(
    `${BASE}/processes/:processName/:processUUID/records`,
    ({ params, request }) => {
      const { processName, processUUID } = params as { processName: string; processUUID: string }
      const session = activeSessions.get(processUUID)

      if (!session) {
        return HttpResponse.json({ totalRecords: 0, records: [] })
      }

      const url = new URL(request.url)
      const skip = parseInt(url.searchParams.get('skip') ?? '0')
      const limit = parseInt(url.searchParams.get('limit') ?? '50')

      let records: typeof mockPeopleRecords = []
      if (processName === 'importPeople') {
        records = mockPeopleRecords.slice(skip, skip + limit)
        return HttpResponse.json({
          totalRecords: mockPeopleRecords.length,
          records,
        })
      }

      return HttpResponse.json({ totalRecords: 0, records: [] })
    }
  ),

  // GET /processes/:processName/:processUUID/cancel
  http.get(
    `${BASE}/processes/:processName/:processUUID/cancel`,
    ({ params }) => {
      const { processUUID } = params as { processUUID: string }
      activeSessions.delete(processUUID)
      return HttpResponse.json(true)
    }
  ),
]
