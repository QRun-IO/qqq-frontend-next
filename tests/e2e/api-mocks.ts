// Playwright route-interception mocks for V1 endpoints and legacy CRUD.
// Used instead of MSW browser mocks — more reliable and server-config-independent.
//
// IMPORTANT: Playwright applies routes in REVERSE registration order (last = highest priority).
// Register GENERIC routes first, SPECIFIC routes last.

import type { Page } from '@playwright/test'

// ─── Minimal fixtures ─────────────────────────────────────────────────────────

const AUTH_META = { name: 'mockAuth', type: 'FULLY_ANONYMOUS', values: {} }

const SESSION = { uuid: 'mock-session-uuid-e2e', values: {} }

// Minimal QInstance — just enough for the app to render
export const METADATA = {
  apps: {
    crm: {
      name: 'crm',
      label: 'CRM',
      iconName: 'people_alt',
      widgets: [],
      children: [
        { name: 'person', label: 'People', type: 'TABLE', iconName: 'person' },
      ],
      sections: [
        {
          name: 'contacts',
          label: 'Contacts',
          icon: { name: 'contacts' },
          tables: ['person'],
          processes: [],
          reports: [],
        },
      ],
    },
  },
  appTree: [
    {
      name: 'crm',
      label: 'CRM',
      type: 'APP',
      iconName: 'people_alt',
      children: [{ name: 'person', label: 'People', type: 'TABLE', iconName: 'person' }],
    },
  ],
  tables: {
    person: {
      name: 'person',
      label: 'People',
      isHidden: false,
      primaryKeyField: 'id',
      fields: {
        id: { name: 'id', label: 'ID', type: 'INTEGER', isEditable: false, isRequired: false, isHeavy: false, isHidden: false, adornments: [] },
        firstName: { name: 'firstName', label: 'First Name', type: 'STRING', isEditable: true, isRequired: true, isHeavy: false, isHidden: false, adornments: [], maxLength: 100 },
        lastName: { name: 'lastName', label: 'Last Name', type: 'STRING', isEditable: true, isRequired: true, isHeavy: false, isHidden: false, adornments: [], maxLength: 100 },
        email: { name: 'email', label: 'Email', type: 'STRING', isEditable: true, isRequired: false, isHeavy: false, isHidden: false, adornments: [], maxLength: 255 },
        status: { name: 'status', label: 'Status', type: 'STRING', isEditable: true, isRequired: true, isHeavy: false, isHidden: false, adornments: [{ type: 'CHIP' }] },
      },
      sections: [
        {
          name: 'identity',
          label: 'Identity',
          tier: 'T1',
          iconName: 'person',
          fieldNames: ['firstName', 'lastName', 'email', 'status'],
          isHidden: false,
          gridColumns: 2,
        },
      ],
      exposedJoins: [],
      capabilities: ['TABLE_QUERY', 'TABLE_GET', 'TABLE_COUNT', 'TABLE_INSERT', 'TABLE_UPDATE', 'TABLE_DELETE'],
      readPermission: true,
      insertPermission: true,
      editPermission: true,
      deletePermission: true,
      usesVariants: false,
      variantTableLabel: '',
    },
  },
  processes: {
    importData: {
      name: 'importData',
      label: 'Import Data',
      tableName: '',
      isHidden: false,
      iconName: 'upload',
      hasPermission: true,
      stepFlow: 'LINEAR',
      minInputRecords: 0,
      frontendSteps: [
        {
          name: 'input',
          label: 'Upload File',
          components: [{ type: 'EDIT_FORM' }],
          formFields: [
            {
              name: 'file',
              label: 'CSV File',
              type: 'STRING',
              isEditable: true,
              isRequired: true,
              isHeavy: false,
              isHidden: false,
              adornments: [],
            },
          ],
        },
        {
          name: 'result',
          label: 'Complete',
          components: [{ type: 'PROCESS_SUMMARY_RESULTS' }],
          formFields: [],
        },
      ],
    },
  },
  reports: {},
  widgets: {},
  branding: {
    companyName: 'Test',
    appName: 'QQQ Test',
    logo: null,
    icon: null,
    accentColor: '#6366f1',
    banners: {},
  },
  helpContents: {},
  environmentValues: {},
}

const PERSON_RECORDS = [
  {
    tableName: 'person', recordLabel: 'Alice Johnson',
    values: { id: 1, firstName: 'Alice', lastName: 'Johnson', email: 'alice@example.com', status: 'Active' },
    displayValues: { id: '1' },
  },
  {
    tableName: 'person', recordLabel: 'Bob Martinez',
    values: { id: 2, firstName: 'Bob', lastName: 'Martinez', email: 'bob@example.com', status: 'Active' },
    displayValues: { id: '2' },
  },
  {
    tableName: 'person', recordLabel: 'Carol Williams',
    values: { id: 3, firstName: 'Carol', lastName: 'Williams', email: 'carol@example.com', status: 'Lead' },
    displayValues: { id: '3' },
  },
]

const PERSON_RECORD_1 = PERSON_RECORDS[0]

// ─── Route setup ──────────────────────────────────────────────────────────────

/**
 * Set up Playwright route interception to mock all /qqq/v1/* API calls.
 * Call this BEFORE page.goto() in each test's beforeEach.
 *
 * Routes are registered from LEAST specific to MOST specific.
 * Playwright checks routes in reverse registration order (last registered = first checked).
 */
export async function setupApiMocks(page: Page): Promise<void> {
  // ── GENERIC routes (registered first = lowest priority) ──────────────────

  // Global search
  await page.route('**/qqq/v1/search**', (route) => {
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ results: [] }) })
  })

  // Possible values
  await page.route('**/possibleValues/**', (route) => {
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ options: [] }) })
  })

  // Audits
  await page.route('**/qqq/v1/table/*/*/audits**', (route) => {
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ records: [] }) })
  })

  // v1 record writes ({ record }); the specific Get handler below passes other methods here.
  await page.route(/\/qqq\/v1\/table\/person(\/\d+)?(\?|$)/, (route) => {
    const method = route.request().method()
    if (method === 'POST') {
      // Insert — return new record with id 99
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ record: { ...PERSON_RECORD_1, values: { ...PERSON_RECORD_1.values, id: 99 } } }),
      })
      return
    }
    if (method === 'PATCH' || method === 'PUT') {
      // Update — return the updated record
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ record: {
          ...PERSON_RECORD_1,
          values: { ...PERSON_RECORD_1.values, firstName: 'Alice Updated' },
        } }),
      })
      return
    }
    if (method === 'DELETE') {
      // Delete — return deletion count
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ deletedRecordCount: 1 }),
      })
      return
    }
    route.continue()
  })

  // Full metadata (with optional query params like ?frontendName=...)
  await page.route('**/qqq/v1/metaData**', (route) => {
    // Default: return full QInstance
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(METADATA) })
  })

  // Logout
  await page.route('**/qqq/v1/logout**', (route) => {
    route.fulfill({ status: 200 })
  })

  // ── SPECIFIC routes (registered last = highest priority, checked first) ────
  //
  // v1 Get ({ record }); the missing-record override is registered last.
  await page.route(/\/qqq\/v1\/table\/person\/\d+(\?|$)/, (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    const url = route.request().url()
    const idMatch = /\/table\/person\/(\d+)/.exec(url)
    if (idMatch) {
      const id = parseInt(idMatch[1], 10)
      const record = PERSON_RECORDS.find((r) => r.values.id === id)
      if (record) {
        route.fulfill({ contentType: 'application/json', body: JSON.stringify({ record }) })
      } else {
        route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: `Record '${id}' not found` }),
        })
      }
      return
    }
    route.continue()
  })

  // Person record 99999 → 404 (must be after per-record handler = higher priority)
  await page.route(/\/qqq\/v1\/table\/person\/99999(\?|$)/, (route) => {
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: "Record '99999' not found in table 'person'" }),
    })
  })

  // Person count (must be after per-record handler = higher priority)
  await page.route('**/qqq/v1/table/person/count**', (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ count: PERSON_RECORDS.length, distinctCount: PERSON_RECORDS.length }),
    })
  })

  // Person query (must be after per-record handler = highest priority among person routes)
  await page.route('**/qqq/v1/table/person/query**', (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ records: PERSON_RECORDS }),
    })
  })

  // ── Process routes (registered after person routes = higher priority) ──────

  // Process job status — polling endpoint
  await page.route('**/qqq/v1/processes/*/*/status/**', (route) => {
    const url = route.request().url()
    const processMatch = /\/processes\/[^/]+\/([^/]+)\/status\//.exec(url)
    const processUUID = processMatch?.[1] ?? 'mock-uuid'
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        jobState: 'COMPLETE',
        processUUID,
        frontendStep: {
          name: 'result',
          label: 'Complete',
          components: [{ type: 'PROCESS_SUMMARY_RESULTS' }],
          formFields: [],
        },
        values: { processedRecordCount: 0 },
        nextStep: 'result',
      }),
    })
  })

  // Process step submission
  await page.route('**/qqq/v1/processes/*/*/step/**', (route) => {
    const url = route.request().url()
    const processMatch = /\/processes\/[^/]+\/([^/]+)\/step\//.exec(url)
    const processUUID = processMatch?.[1] ?? 'mock-uuid'
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        processUUID,
        nextStep: 'result',
        frontendStep: {
          name: 'result',
          label: 'Complete',
          components: [{ type: 'PROCESS_SUMMARY_RESULTS' }],
          formFields: [],
        },
        values: { processedRecordCount: 0 },
      }),
    })
  })

  // Process init — returns first step for any process
  await page.route('**/qqq/v1/processes/*/init**', (route) => {
    const url = route.request().url()
    const processMatch = /\/processes\/([^/]+)\/init/.exec(url)
    const processName = processMatch?.[1] ?? 'unknown'
    const processUUID = `mock-uuid-${processName}`
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        processUUID,
        nextStep: 'input',
        frontendStep: {
          name: 'input',
          label: 'Upload File',
          components: [{ type: 'EDIT_FORM' }],
          formFields: [
            {
              name: 'file',
              label: 'CSV File',
              type: 'STRING',
              isEditable: true,
              isRequired: true,
              isHeavy: false,
              isHidden: false,
              adornments: [],
            },
          ],
        },
        values: {},
      }),
    })
  })

  // v1 process metadata: the process itself (must be after the generic /metaData** handler)
  await page.route('**/qqq/v1/metaData/process/**', (route) => {
    const processName = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop() ?? '')
    const process = (METADATA.processes as Record<string, unknown>)[processName]
    route.fulfill(process
      ? { contentType: 'application/json', body: JSON.stringify(process) }
      : { status: 404, contentType: 'application/json', body: JSON.stringify({ error: `Process '${processName}' not found` }) })
  })

  // Per-table metadata (must be before generic /metaData** handler)
  await page.route('**/qqq/v1/metaData/table/**', (route) => {
    const url = route.request().url()
    const tableMatch = /\/metaData\/table\/([^/?]+)/.exec(url)
    if (tableMatch) {
      const tableName = tableMatch[1]
      const table = (METADATA.tables as Record<string, unknown>)[tableName]
      if (table) {
        route.fulfill({ contentType: 'application/json', body: JSON.stringify(table) })
      } else {
        route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: `Table '${tableName}' not found` }),
        })
      }
    } else {
      route.continue()
    }
  })

  // Auth metadata (MOST specific — must be highest priority / last registered)
  await page.route('**/qqq/v1/metaData/authentication**', (route) => {
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(AUTH_META) })
  })

  // Manage session (high priority)
  await page.route('**/qqq/v1/manageSession**', (route) => {
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(SESSION) })
  })
}
